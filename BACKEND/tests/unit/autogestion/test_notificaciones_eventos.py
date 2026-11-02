"""
B7: traducción de eventos de autogestión a notificaciones (destinatarios por permiso, correo donde
corresponde), recordatorio de ventana por expirar (idempotente) y borrado de soportes en el almacén.
Sin Django ni BD: puertos en memoria.
"""
from datetime import timedelta

import pytest

from apps.autogestion.application.use_cases.edicion_trabajador import adjuntar_soporte, eliminar_soporte
from apps.autogestion.application.use_cases.solicitud_ciclo import avisar_ventanas_por_expirar
from apps.autogestion.domain.events import EventoAutogestion, TipoEvento
from apps.autogestion.domain.services.notificaciones_eventos import solicitudes_de_evento
from core.domain.exceptions import ConflictError, NotFoundError
from tests.unit.autogestion.memoria_actualizacion import AHORA, BIENESTAR, TRABAJADOR, Mundo
from tests.unit.autogestion.test_actualizacion_flujo import habilitar, soporte, solicitar

SID = '0194c1a0-0000-7000-8000-000000000001'


def evento(tipo, detalle=None, actor=BIENESTAR):
    return EventoAutogestion(tipo, SID, TRABAJADOR, actor, detalle or {})


def solo(tipo, detalle=None, actor=BIENESTAR):
    resultado = solicitudes_de_evento(evento(tipo, detalle, actor))
    assert len(resultado) == 1
    return resultado[0]


def test_solicitud_creada_avisa_a_bienestar_por_permiso_y_no_al_propio_trabajador():
    s = solo(TipoEvento.SOLICITUD_CREADA, {'secciones': ['contacto', 'foto']}, actor=TRABAJADOR)
    assert s.permiso_destino == 'bienestar.habilitar_ventana' and not s.cedula_destino
    assert TRABAJADOR in s.excluir_cedulas and s.correo is None
    assert 'contacto, foto' in s.mensaje and s.enlace.startswith('/')


def test_solicitud_enviada_avisa_a_quienes_pueden_aprobar():
    s = solo(TipoEvento.SOLICITUD_ENVIADA, actor=TRABAJADOR)
    assert s.permiso_destino == 'bienestar.aprobar' and s.correo is None


@pytest.mark.parametrize('tipo,detalle', [
    (TipoEvento.VENTANA_HABILITADA, {'ventana_fin': '2026-11-05T20:00:00+00:00', 'secciones': ['contacto']}),
    (TipoEvento.VENTANA_PRORROGADA, {'ventana_fin': '2026-11-09T20:00:00+00:00', 'motivo': 'Viaje'}),
    (TipoEvento.ACTUALIZACION_APROBADA, {'estado': 'APROBADA', 'aprobados': 2, 'total': 2}),
    (TipoEvento.ACTUALIZACION_APROBADA, {'estado': 'APROBADA_PARCIAL', 'aprobados': 1, 'total': 2}),
    (TipoEvento.SOLICITUD_RECHAZADA, {'motivo': 'Falta soporte'}),
    (TipoEvento.SOLICITUD_DEVUELTA, {'motivo': 'Falta la constancia', 'ventana_fin': '2026-11-05T20:00:00+00:00', 'fecha': 'f1'}),
    (TipoEvento.VENTANA_POR_EXPIRAR, {'ventana_fin': '2026-11-05T20:00:00+00:00'}),
    (TipoEvento.VENTANA_EXPIRADA, {'ventana_fin': '2026-11-05T20:00:00+00:00'}),
])
def test_eventos_al_trabajador_llevan_correo(tipo, detalle):
    s = solo(tipo, detalle)
    assert s.cedula_destino == TRABAJADOR and s.correo is not None and 'CONATEL' in s.correo.asunto
    assert s.enlace == f'/autogestion/solicitudes/{SID}' and s.ref_id == SID


def test_devuelta_lleva_el_motivo_y_cada_devolucion_tiene_su_clave():
    a = solo(TipoEvento.SOLICITUD_DEVUELTA, {'motivo': 'Falta la constancia', 'ventana_fin': '2026-11-05T20:00:00+00:00', 'fecha': 'f1'})
    b = solo(TipoEvento.SOLICITUD_DEVUELTA, {'motivo': 'Otra vez', 'ventana_fin': '2026-11-05T20:00:00+00:00', 'fecha': 'f2'})
    assert 'Falta la constancia' in a.mensaje and a.clave != b.clave and a.modulo == 'autogestion'


def test_correccion_reenviada_avisa_a_bienestar_en_su_modulo_y_con_clave_propia():
    s = solo(TipoEvento.CORRECCION_REENVIADA, {'fecha': 'f1'}, actor=TRABAJADOR)
    assert s.permiso_destino == 'bienestar.aprobar' and s.modulo == 'personal' and s.correo is None
    assert TRABAJADOR in s.excluir_cedulas and s.clave == 'f1'


def test_fechas_en_hora_de_venezuela_y_clave_por_ocurrencia():
    a = solo(TipoEvento.VENTANA_HABILITADA, {'ventana_fin': '2026-11-05T20:00:00+00:00', 'secciones': ['contacto']})
    b = solo(TipoEvento.VENTANA_PRORROGADA, {'ventana_fin': '2026-11-09T20:00:00+00:00', 'motivo': 'x'})
    assert '05/11/2026 04:00 PM' in a.mensaje  # UTC-4
    assert a.clave != b.clave


def test_aprobacion_parcial_no_se_presenta_como_total():
    s = solo(TipoEvento.ACTUALIZACION_APROBADA, {'estado': 'APROBADA_PARCIAL', 'aprobados': 1, 'total': 3})
    assert 'parcialmente' in s.titulo and '1 de 3' in s.mensaje


def test_foto_aprobada_alerta_a_carnetizacion_por_permiso():
    s = solo(TipoEvento.FOTO_APROBADA)
    assert s.permiso_destino == 'carnetizacion.emitir' and 'reemitirse' in s.mensaje


def test_eventos_sin_aviso_devuelven_lista_vacia():
    assert solicitudes_de_evento(evento(TipoEvento('autogestion.ventana_expirada'), {})) != []


def test_ventana_por_expirar_avisa_solo_dentro_del_umbral_de_24_horas():
    m = Mundo()
    habilitada = habilitar(m, solicitar(m), dias=5)           # vence en 5 días
    assert avisar_ventanas_por_expirar(m.solicitudes, m.publicador, AHORA, 24) == 0
    cerca = AHORA + timedelta(days=4, hours=1)                # faltan 23 h
    assert avisar_ventanas_por_expirar(m.solicitudes, m.publicador, cerca, 24) == 1
    evento_aviso = m.publicador.eventos[-1]
    assert evento_aviso.tipo is TipoEvento.VENTANA_POR_EXPIRAR and evento_aviso.solicitud_id == habilitada.id
    vencida = AHORA + timedelta(days=6)                       # ya venció: no es "por expirar"
    assert avisar_ventanas_por_expirar(m.solicitudes, m.publicador, vencida, 24) == 0


def test_eliminar_soporte_borra_tambien_el_objeto_del_almacen():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('formacion',)))
    sop = soporte(m, sol, 'formacion', 'TITULO')
    assert len(m.almacen.objetos) == 1
    eliminar_soporte(m.solicitudes, m.soportes, m.cambios, m.almacen,
                     solicitud_id=sol.id, soporte_id=sop.id, cedula=TRABAJADOR, ahora=AHORA)
    assert m.almacen.objetos == {} and m.soportes.obtener(sop.id) is None


def test_eliminar_soporte_ajeno_o_fuera_de_plazo_no_toca_el_almacen():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('formacion',)), dias=1)
    sop = soporte(m, sol, 'formacion', 'TITULO')
    with pytest.raises(NotFoundError):
        eliminar_soporte(m.solicitudes, m.soportes, m.cambios, m.almacen,
                         solicitud_id=sol.id, soporte_id=sop.id, cedula='20999999', ahora=AHORA)
    with pytest.raises(ConflictError):
        eliminar_soporte(m.solicitudes, m.soportes, m.cambios, m.almacen,
                         solicitud_id=sol.id, soporte_id=sop.id, cedula=TRABAJADOR, ahora=AHORA + timedelta(days=3))
    assert len(m.almacen.objetos) == 1


def test_reemplazar_la_foto_borra_la_anterior_del_almacen():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('foto',)))
    for _ in range(2):
        adjuntar_soporte(
            m.solicitudes, m.soportes, m.cambios, m.ficha, m.almacen, solicitud_id=sol.id, cedula=TRABAJADOR,
            seccion='foto', tipo='FOTO', contenido=b'\xff\xd8\xff data', mime='image/jpeg', extension='.jpg',
            nombre_original='yo.jpg', ahora=AHORA,
        )
    assert len(m.almacen.objetos) == 1


@pytest.mark.parametrize('tipo', [TipoEvento.SOLICITUD_CREADA, TipoEvento.SOLICITUD_ENVIADA, TipoEvento.CORRECCION_REENVIADA])
def test_correo_a_bienestar_solo_con_el_ajuste_activado(tipo):
    apagado = solicitudes_de_evento(evento(tipo, {'fecha': 'f1'}, TRABAJADOR))[0]
    encendido = solicitudes_de_evento(evento(tipo, {'fecha': 'f1'}, TRABAJADOR), correo_a_bienestar=True)[0]
    assert apagado.correo is None and encendido.correo is not None and 'CONATEL' in encendido.correo.asunto
    assert encendido.permiso_destino and not encendido.cedula_destino
