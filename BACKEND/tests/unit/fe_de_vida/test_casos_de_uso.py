"""Casos de uso de fe de vida con repositorios en memoria (C3, C17, C19). Sin Django ni PostgreSQL."""
from datetime import timedelta

import pytest

from apps.fe_de_vida.application.use_cases import consultas, procesos, revision
from apps.fe_de_vida.application.use_cases import solicitudes_pasivo as sp
from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.entities.filtros import FiltroBandeja
from apps.fe_de_vida.domain.value_objects.estados import EstadoProceso, EstadoSolicitud as E, ViaAprobacion
from core.domain.exceptions import (
    AlmacenamientoNoDisponible, ConflictError, NotFoundError, PermissionDeniedError, ValidationError,
)
from tests.unit.fe_de_vida.memoria import (
    ADMINISTRADORA, AHORA, ANALISTA, APERTURA, CIERRE, OTRA_ADMINISTRADORA, OTRO_PASIVO, PASIVO, LectorPasivosMem, Mundo,
    VerificadorMem,
)


@pytest.fixture
def m():
    return Mundo()


def iniciar(m, cedula=PASIVO, ahora=AHORA):
    return sp.iniciar_solicitud(m.procesos, m.solicitudes, m.verificador, m.alcance, proceso_id=m.proceso.id, cedula=cedula, ahora=ahora)


# ── Procesos (C17) ──
def test_proceso_nuevo_nace_borrador_y_se_abre(m):
    p = procesos.crear_proceso(m.procesos, nombre=' Fe de vida 2027 ', fecha_apertura=APERTURA, fecha_cierre=CIERRE, actor='1')
    assert p.estado is EstadoProceso.BORRADOR and p.nombre == 'Fe de vida 2027'
    assert procesos.abrir_proceso(m.procesos, m.publicador, proceso_id=p.id, actor='1').estado is EstadoProceso.ABIERTO
    assert 'fe_de_vida.proceso_abierto' in m.publicador.tipos()


def test_abrir_proceso_inexistente_o_ya_abierto_falla(m):
    with pytest.raises(NotFoundError):
        procesos.abrir_proceso(m.procesos, proceso_id='nada', actor='1')
    with pytest.raises(ConflictError):
        procesos.abrir_proceso(m.procesos, proceso_id=m.proceso.id, actor='1')


def test_cerrar_expira_borradores_y_repeticiones_sin_prorroga_pero_no_las_enviadas(m):
    borrador = iniciar(m)
    enviada = m.solicitud_enviada(OTRO_PASIVO)
    m.verificador.pasivos.add('777')
    con_prorroga = iniciar(m, '777')
    procesos.prorrogar_proceso(
        m.procesos, m.solicitudes, proceso_id=m.proceso.id, cedula='777',
        nueva_fecha_limite=AHORA + timedelta(days=3), motivo='viaje', actor='1', ahora=AHORA,
    )
    cerrado, expiradas = procesos.cerrar_proceso(
        m.procesos, m.solicitudes, m.publicador, proceso_id=m.proceso.id, actor='1', ahora=AHORA,
    )
    assert cerrado.estado is EstadoProceso.CERRADO and expiradas == 1
    assert m.solicitudes.obtener(borrador.id).estado is E.EXPIRADA
    assert m.solicitudes.obtener(enviada.id).estado is E.PENDIENTE_REVISION
    assert m.solicitudes.obtener(con_prorroga.id).estado is E.BORRADOR


def test_cierre_automatico_solo_cierra_abiertos_vencidos(m):
    assert procesos.cerrar_procesos_vencidos(m.procesos, m.solicitudes, ahora=AHORA) == 0
    assert procesos.cerrar_procesos_vencidos(m.procesos, m.solicitudes, ahora=CIERRE + timedelta(minutes=1)) == 1
    assert m.procesos.obtener(m.proceso.id).estado is EstadoProceso.CERRADO


def test_prorroga_valida_fecha_motivo_y_estado(m):
    borrador = procesos.crear_proceso(m.procesos, nombre='x', fecha_apertura=APERTURA, fecha_cierre=CIERRE, actor='1')
    for kw, error in (
        ({'proceso_id': borrador.id, 'nueva_fecha_limite': CIERRE, 'motivo': 'm'}, ConflictError),
        ({'proceso_id': m.proceso.id, 'nueva_fecha_limite': AHORA - timedelta(days=1), 'motivo': 'm'}, ValidationError),
        ({'proceso_id': m.proceso.id, 'nueva_fecha_limite': CIERRE, 'motivo': ' '}, ValidationError),
    ):
        with pytest.raises(error):
            procesos.prorrogar_proceso(m.procesos, m.solicitudes, cedula=PASIVO, actor='1', ahora=AHORA, **kw)


def test_prorroga_individual_rehabilita_solo_a_su_cedula_y_la_general_a_todos(m):
    a, b = iniciar(m), m.solicitudes.crear(
        __import__('apps.fe_de_vida.domain.entities.solicitud', fromlist=['x']).SolicitudFeDeVida(
            id='', proceso_id=m.proceso.id, cedula=OTRO_PASIVO,
        ),
    )
    procesos.cerrar_proceso(m.procesos, m.solicitudes, proceso_id=m.proceso.id, actor='1', ahora=AHORA)
    assert m.solicitudes.obtener(a.id).estado is E.EXPIRADA and m.solicitudes.obtener(b.id).estado is E.EXPIRADA
    futuro = AHORA + timedelta(days=5)
    procesos.prorrogar_proceso(m.procesos, m.solicitudes, m.publicador, proceso_id=m.proceso.id, cedula=PASIVO,
                               nueva_fecha_limite=futuro, motivo='enfermedad', actor='1', ahora=AHORA)
    assert m.solicitudes.obtener(a.id).estado is E.BORRADOR and m.solicitudes.obtener(b.id).estado is E.EXPIRADA
    procesos.prorrogar_proceso(m.procesos, m.solicitudes, m.publicador, proceso_id=m.proceso.id, cedula=None,
                               nueva_fecha_limite=futuro, motivo='general', actor='1', ahora=AHORA)
    assert m.solicitudes.obtener(b.id).estado is E.BORRADOR
    assert m.publicador.tipos().count('fe_de_vida.prorroga_concedida') == 2


# ── Trámite del pasivo (C3) ──
def test_solo_pasivos_inician_y_la_solicitud_es_unica_por_proceso(m):
    with pytest.raises(PermissionDeniedError):
        iniciar(m, '123')
    primera = iniciar(m)
    assert iniciar(m).id == primera.id and len(m.solicitudes.filas) == 1


def test_proceso_cerrado_sin_prorroga_rechaza_iniciar_guardar_subir_y_enviar(m):
    s = iniciar(m)
    procesos.cerrar_proceso(m.procesos, m.solicitudes, proceso_id=m.proceso.id, actor='1', ahora=AHORA)
    with pytest.raises(ConflictError):
        iniciar(m, OTRO_PASIVO)
    with pytest.raises(ValidationError):  # expirada: ya no editable
        sp.guardar_borrador(m.procesos, m.solicitudes, m.cambios, m.validador, solicitud_id=s.id, cedula=PASIVO, cambios=[], ahora=AHORA)


def test_envio_en_proceso_cerrado_sin_prorroga_falla_y_con_prorroga_individual_pasa(m):
    s = iniciar(m)
    sp.subir_evidencia(m.procesos, m.solicitudes, m.storage, solicitud_id=s.id, cedula=PASIVO,
                       contenido=b'x', mime='image/png', origen='ARCHIVO', metadatos=None, ahora=AHORA)
    m.procesos.guardar(m.procesos.obtener(m.proceso.id).cerrar('1', AHORA))  # cierre sin expirar (carrera)
    with pytest.raises(ConflictError, match='cerrado'):
        sp.enviar_solicitud(m.procesos, m.solicitudes, solicitud_id=s.id, cedula=PASIVO, ahora=AHORA)
    procesos.prorrogar_proceso(m.procesos, m.solicitudes, proceso_id=m.proceso.id, cedula=OTRO_PASIVO,
                               nueva_fecha_limite=AHORA + timedelta(days=2), motivo='otro', actor='1', ahora=AHORA)
    with pytest.raises(ConflictError):  # la prórroga individual de otra persona no sirve
        sp.enviar_solicitud(m.procesos, m.solicitudes, solicitud_id=s.id, cedula=PASIVO, ahora=AHORA)
    procesos.prorrogar_proceso(m.procesos, m.solicitudes, proceso_id=m.proceso.id, cedula=PASIVO,
                               nueva_fecha_limite=AHORA + timedelta(days=2), motivo='mío', actor='1', ahora=AHORA)
    enviada = sp.enviar_solicitud(m.procesos, m.solicitudes, m.publicador, solicitud_id=s.id, cedula=PASIVO, ahora=AHORA)
    assert enviada.estado is E.PENDIENTE_REVISION


def test_proceso_abierto_pero_vencido_exige_prorroga(m):
    s = iniciar(m)
    tarde = CIERRE + timedelta(hours=1)
    with pytest.raises(ConflictError):
        sp.enviar_solicitud(m.procesos, m.solicitudes, solicitud_id=s.id, cedula=PASIVO, ahora=tarde)


def test_guardar_borrador_valida_descarta_sin_cambio_y_rechaza_repetidos(m):
    s = iniciar(m)
    c = CambioActa('contacto', 'MODIFICAR', 'employee', 'telefono_habitacion', '0212-1111111')
    sin_cambio = CambioActa('contacto', 'MODIFICAR', 'employee', 'telefono_movil', '0414-0000000')
    guardados = sp.guardar_borrador(m.procesos, m.solicitudes, m.cambios, m.validador, solicitud_id=s.id,
                                    cedula=PASIVO, cambios=[c, sin_cambio], ahora=AHORA)
    assert guardados == [c]
    with pytest.raises(ValidationError, match='repetido'):
        sp.guardar_borrador(m.procesos, m.solicitudes, m.cambios, m.validador, solicitud_id=s.id, cedula=PASIVO,
                            cambios=[c, c], ahora=AHORA)
    with pytest.raises(ValidationError):  # campo fuera de la lista blanca
        sp.guardar_borrador(m.procesos, m.solicitudes, m.cambios, m.validador, solicitud_id=s.id, cedula=PASIVO,
                            cambios=[CambioActa('contacto', 'MODIFICAR', 'employee', 'cedulaidentidad', '1')], ahora=AHORA)


def test_un_pasivo_no_opera_la_solicitud_de_otro(m):
    s = iniciar(m)
    with pytest.raises(PermissionDeniedError):
        sp.enviar_solicitud(m.procesos, m.solicitudes, solicitud_id=s.id, cedula=OTRO_PASIVO, ahora=AHORA)


def test_subir_evidencia_guarda_hash_origen_y_clave_privada(m):
    s = iniciar(m)
    r = sp.subir_evidencia(m.procesos, m.solicitudes, m.storage, solicitud_id=s.id, cedula=PASIVO,
                           contenido=b'abc', mime='image/jpeg', origen='CAMARA', metadatos={'ancho': 1280}, ahora=AHORA)
    assert r.origen_evidencia.value == 'CAMARA' and r.metadatos_captura == {'ancho': 1280, 'origen': 'CAMARA'}
    assert r.evidencia_clave.startswith(f'fe_de_vida/{s.id}/') and r.evidencia_clave in m.storage.objetos
    assert r.evidencia_sha256 == 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'


def test_subir_evidencia_valida_origen_mime_y_vacio_y_si_falla_el_almacen_no_toca_la_solicitud(m):
    s = iniciar(m)
    base = dict(solicitud_id=s.id, cedula=PASIVO, metadatos=None, ahora=AHORA)
    for kw in ({'contenido': b'x', 'mime': 'image/jpeg', 'origen': 'WEB'}, {'contenido': b'x', 'mime': 'image/gif', 'origen': 'ARCHIVO'},
               {'contenido': b'', 'mime': 'image/png', 'origen': 'ARCHIVO'}):
        with pytest.raises(ValidationError):
            sp.subir_evidencia(m.procesos, m.solicitudes, m.storage, **base, **kw)
    m.storage.falla = True
    with pytest.raises(AlmacenamientoNoDisponible):
        sp.subir_evidencia(m.procesos, m.solicitudes, m.storage, contenido=b'x', mime='image/png', origen='ARCHIVO', **base)
    assert m.solicitudes.obtener(s.id).evidencia_clave == ''


def test_enviar_sin_foto_falla_y_con_foto_publica_evento(m):
    s = iniciar(m)
    with pytest.raises(ValidationError):
        sp.enviar_solicitud(m.procesos, m.solicitudes, solicitud_id=s.id, cedula=PASIVO, ahora=AHORA)
    m.solicitud_enviada(OTRO_PASIVO)
    assert m.publicador.tipos()[-1] == 'fe_de_vida.solicitud_enviada'


# ── Revisión (C3) y aplicación del acta (C19) ──
def test_doble_check_valida_aplica_el_acta_una_vez_y_publica_eventos(m):
    s = m.solicitud_enviada()
    primero = revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ANALISTA, ahora=AHORA)
    assert primero.estado is E.PENDIENTE_SEGUNDO_CHECK and m.aplicador.llamadas == []
    final = revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ADMINISTRADORA, ahora=AHORA)
    assert final.estado is E.VALIDADA and final.via_aprobacion is ViaAprobacion.DOBLE_CHECK
    assert m.aplicador.llamadas == [(s.id, PASIVO, ADMINISTRADORA.cedula)]
    assert m.publicador.tipos()[-2:] == ['fe_de_vida.primer_check', 'fe_de_vida.validada']


def test_misma_persona_no_da_dos_checks_y_no_se_aplica_nada(m):
    s = m.solicitud_enviada()
    revision.dar_check(m.solicitudes, m.aplicador, solicitud_id=s.id, actor=ADMINISTRADORA, ahora=AHORA)
    with pytest.raises(ConflictError):
        revision.dar_check(m.solicitudes, m.aplicador, solicitud_id=s.id, actor=ADMINISTRADORA, ahora=AHORA)
    assert m.solicitudes.obtener(s.id).estado is E.PENDIENTE_SEGUNDO_CHECK and m.aplicador.llamadas == []


def test_analista_sola_no_valida_ni_aplica(m):
    s = m.solicitud_enviada()
    revision.dar_check(m.solicitudes, m.aplicador, solicitud_id=s.id, actor=ANALISTA, ahora=AHORA)
    assert m.solicitudes.obtener(s.id).estado is not E.VALIDADA and m.aplicador.llamadas == []


def test_aprobacion_directa_aplica_y_audita_con_justificacion(m):
    s = m.solicitud_enviada()
    v = revision.aprobar_directo(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ADMINISTRADORA,
                                 justificacion='fallecimiento inminente del familiar', ahora=AHORA)
    assert v.estado is E.VALIDADA and v.via_aprobacion is ViaAprobacion.DIRECTA_ADMINISTRADORA
    assert m.publicador.tipos()[-2:] == ['fe_de_vida.aprobacion_directa', 'fe_de_vida.validada']
    assert len(m.aplicador.llamadas) == 1


def test_aprobacion_directa_sin_justificacion_o_de_analista_falla(m):
    s = m.solicitud_enviada()
    with pytest.raises(ValidationError):
        revision.aprobar_directo(m.solicitudes, m.aplicador, solicitud_id=s.id, actor=ADMINISTRADORA, justificacion=' ', ahora=AHORA)
    with pytest.raises(ConflictError):
        revision.aprobar_directo(m.solicitudes, m.aplicador, solicitud_id=s.id, actor=ANALISTA, justificacion='x', ahora=AHORA)
    assert m.aplicador.llamadas == []


def test_rechazo_y_repeticion_con_motivo_y_sin_aplicar(m):
    m.verificador.pasivos.add('888')
    s1, s2 = m.solicitud_enviada(), m.solicitud_enviada(OTRO_PASIVO)
    r = revision.rechazar(m.solicitudes, m.publicador, solicitud_id=s1.id, actor=ANALISTA, motivo='no es la persona', ahora=AHORA)
    rep = revision.devolver(m.solicitudes, m.publicador, solicitud_id=s2.id, actor=OTRA_ADMINISTRADORA, motivo='borrosa', ahora=AHORA)
    assert r.estado is E.RECHAZADA and rep.estado is E.DEVUELTA and m.aplicador.llamadas == []
    s3 = m.solicitud_enviada('888')
    with pytest.raises(ValidationError):
        revision.rechazar(m.solicitudes, solicitud_id=s3.id, actor=ANALISTA, motivo='', ahora=AHORA)
    assert {'fe_de_vida.rechazada', 'fe_de_vida.devuelta'} <= set(m.publicador.tipos())


def test_flujo_de_repeticion_completo_hasta_validada(m):
    s = m.solicitud_enviada()
    revision.devolver(m.solicitudes, solicitud_id=s.id, actor=ANALISTA, motivo='sin cédula visible', ahora=AHORA)
    sp.subir_evidencia(m.procesos, m.solicitudes, m.storage, solicitud_id=s.id, cedula=PASIVO,
                       contenido=b'nueva', mime='image/jpeg', origen='ARCHIVO', metadatos=None, ahora=AHORA)
    sp.enviar_solicitud(m.procesos, m.solicitudes, solicitud_id=s.id, cedula=PASIVO, ahora=AHORA)
    revision.dar_check(m.solicitudes, m.aplicador, solicitud_id=s.id, actor=ANALISTA, ahora=AHORA)
    final = revision.dar_check(m.solicitudes, m.aplicador, solicitud_id=s.id, actor=ADMINISTRADORA, ahora=AHORA)
    assert final.estado is E.VALIDADA and final.envios == 2


def test_revisar_solicitud_inexistente_falla(m):
    with pytest.raises(NotFoundError):
        revision.dar_check(m.solicitudes, m.aplicador, solicitud_id='nada', actor=ANALISTA, ahora=AHORA)


# ── Consultas ──
def test_consulta_propia_historial_bandeja_y_evidencia(m):
    s = m.solicitud_enviada()
    detalle = consultas.obtener_mi_solicitud(m.solicitudes, m.cambios, solicitud_id=s.id, cedula=PASIVO)
    assert detalle.solicitud.id == s.id and detalle.cambios == []
    with pytest.raises(PermissionDeniedError):
        consultas.obtener_mi_solicitud(m.solicitudes, m.cambios, solicitud_id=s.id, cedula=OTRO_PASIVO)
    historial, total = consultas.listar_mis_solicitudes(m.solicitudes, cedula=PASIVO)
    assert [x.id for x in historial] == [s.id] and total == 1
    filas, total = consultas.bandeja_revision(
        m.solicitudes, LectorPasivosMem(), filtro=FiltroBandeja(estado='PENDIENTE_REVISION'), limite=500,
    )
    assert total == 1 and filas[0][0].id == s.id and filas[0][1] == f'Nombre {PASIVO}'
    url = consultas.url_evidencia(m.solicitudes, m.storage, m.publicador, solicitud_id=s.id, actor_cedula=ANALISTA.cedula)
    assert url.endswith('exp=90') and m.publicador.tipos()[-1] == 'fe_de_vida.evidencia_consultada'
    procesos_abiertos, total = consultas.listar_procesos(m.procesos, estado='ABIERTO')
    assert len(procesos_abiertos) == 1 and total == 1
    assert consultas.listar_prorrogas(m.procesos, proceso_id=m.proceso.id) == ([], 0)


def test_paginacion_tiene_tope_y_defecto():
    from apps.fe_de_vida.application.use_cases._comun import normalizar_pagina, paginar
    assert normalizar_pagina(None, None) == (10, 0)
    assert normalizar_pagina(500, -3) == (50, 0)
    pagina, total = paginar(list(range(120)), 500, 10)
    assert len(pagina) == 50 and total == 120 and pagina[0] == 10


def test_proceso_vigente_por_plazo_y_por_prorroga(m):
    vigente = consultas.obtener_proceso_vigente(m.procesos, m.solicitudes, m.alcance, cedula=PASIVO, ahora=AHORA)
    assert vigente.proceso.id == m.proceso.id and vigente.puede_enviar and vigente.solicitud is None
    despues = CIERRE + timedelta(days=1)
    assert consultas.obtener_proceso_vigente(m.procesos, m.solicitudes, m.alcance, cedula=PASIVO, ahora=despues) is None
    procesos.prorrogar_proceso(
        m.procesos, m.solicitudes, proceso_id=m.proceso.id, cedula=PASIVO, nueva_fecha_limite=despues + timedelta(days=5),
        motivo='viaje', actor=ANALISTA.cedula, ahora=despues,
    )
    assert consultas.obtener_proceso_vigente(m.procesos, m.solicitudes, m.alcance, cedula=PASIVO, ahora=despues).puede_enviar
    assert consultas.obtener_proceso_vigente(m.procesos, m.solicitudes, m.alcance, cedula=OTRO_PASIVO, ahora=despues) is None


def test_url_evidencia_sin_foto_falla(m):
    s = iniciar(m)
    with pytest.raises(NotFoundError):
        consultas.url_evidencia(m.solicitudes, m.storage, solicitud_id=s.id, actor_cedula=ANALISTA.cedula)


def test_verificador_doble_basico():
    assert VerificadorMem().es_pasivo(PASIVO) and not VerificadorMem().es_pasivo('1')
