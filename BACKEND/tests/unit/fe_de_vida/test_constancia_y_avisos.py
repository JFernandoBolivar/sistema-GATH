"""Unitarios (sin BD) de la emisión de la constancia (C4) y de los avisos por evento (C6)."""
import itertools
from dataclasses import replace

import pytest

from apps.fe_de_vida.application.use_cases import revision
from apps.fe_de_vida.application.use_cases.constancias import emitir_constancia
from apps.fe_de_vida.domain.entities.constancia import ConstanciaFeDeVida, PlantillaConstancia
from apps.fe_de_vida.domain.events import TipoEvento
from apps.fe_de_vida.domain.services.constancia import formatear_numero, texto_constancia
from apps.fe_de_vida.domain.services.notificaciones_eventos import (
    PERMISO_CHECK_ADMINISTRADORA,
    PERMISO_CHECK_ANALISTA,
    PERMISO_REVISAR,
    notificacion_validada,
    solicitudes_de_evento,
)
from core.domain.exceptions import ConflictError
from tests.unit.fe_de_vida.memoria import ADMINISTRADORA, AHORA, ANALISTA, PASIVO, LectorPasivosMem, Mundo

URL = 'http://sistema.test/verificar'
PLANTILLA = PlantillaConstancia(1, 'CONSTANCIA', 'El {fecha} {nombre_completo}, C.I. {cedula}, {condicion}. {otro}')


class RepoConstanciasMem:
    def __init__(self, con_plantilla=True):
        self.filas, self._n, self.con_plantilla = {}, itertools.count(1), con_plantilla

    def plantilla_activa(self):
        return PLANTILLA if self.con_plantilla else None

    def obtener_de_solicitud(self, solicitud_id):
        return next((c for c in self.filas.values() if c.solicitud_id == solicitud_id), None)

    def obtener_por_codigo(self, codigo):
        return next((c for c in self.filas.values() if c.codigo_verificacion == codigo), None)

    def reservar(self, solicitud_id, cedula, anio, certificadores, plantilla_version, ahora):
        n = next(self._n)
        c = ConstanciaFeDeVida(f'c{n}', solicitud_id, formatear_numero(anio, n), f'codigo{n}', certificadores, plantilla_version)
        self.filas[c.id] = c
        return c

    def registrar_pdf(self, constancia_id, clave_pdf):
        self.filas[constancia_id] = replace(self.filas[constancia_id], clave_pdf=clave_pdf)
        return self.filas[constancia_id]


class GeneradorMem:
    def __init__(self):
        self.llamadas = []

    def generar(self, **kwargs):
        self.llamadas.append(kwargs)
        return b'%PDF-prueba'


def _validada_doble_check(m):
    s = m.solicitud_enviada()
    revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ANALISTA, ahora=AHORA)
    return revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ADMINISTRADORA, ahora=AHORA)


def _emitir(m, const, gen):
    return emitir_constancia(
        m.procesos, m.solicitudes, const, LectorPasivosMem(), gen, m.storage, solicitud_id=m.ultima_id,
        url_verificacion_base=URL + '/', ahora=AHORA,
    )


@pytest.fixture
def m():
    mundo = Mundo()
    mundo.ultima_id = _validada_doble_check(mundo).id
    return mundo


def test_emite_constancia_con_ambos_aprobadores_y_es_idempotente(m):
    const, gen = RepoConstanciasMem(), GeneradorMem()
    c = _emitir(m, const, gen)
    assert c.numero == f'FV-{AHORA.year}-000001' and c.clave_pdf.endswith(f'{c.numero}.pdf')
    assert [x.cedula for x in c.certificada_por] == [ANALISTA.cedula, ADMINISTRADORA.cedula]
    pdf = gen.llamadas[0]
    assert pdf['via_directa'] is False and pdf['url_verificacion'] == f'{URL}/{c.codigo_verificacion}'
    assert '{otro}' in pdf['texto'] and PASIVO in pdf['texto']
    assert _emitir(m, const, gen) == c and len(gen.llamadas) == 1  # no se duplica


def test_aprobacion_directa_certifica_solo_la_administradora():
    m = Mundo()
    s = m.solicitud_enviada()
    s = revision.aprobar_directo(
        m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ADMINISTRADORA, justificacion='urgente', ahora=AHORA,
    )
    m.ultima_id = s.id
    gen = GeneradorMem()
    c = _emitir(m, RepoConstanciasMem(), gen)
    assert [x.cedula for x in c.certificada_por] == [ADMINISTRADORA.cedula] and gen.llamadas[0]['via_directa'] is True


def test_no_emite_sin_validada_ni_sin_plantilla(m):
    sin_plantilla = RepoConstanciasMem(con_plantilla=False)
    with pytest.raises(ConflictError):
        _emitir(m, sin_plantilla, GeneradorMem())
    otro = Mundo()
    otro.ultima_id = otro.solicitud_enviada().id
    with pytest.raises(ConflictError):
        _emitir(otro, RepoConstanciasMem(), GeneradorMem())


def test_texto_constancia_solo_sustituye_marcadores_conocidos():
    pasivo = LectorPasivosMem().datos(PASIVO)
    assert texto_constancia(PLANTILLA, pasivo, AHORA).startswith(f'El {AHORA:%d/%m/%Y} Nombre {PASIVO}')


def _evento(m, tipo, **detalle):
    from apps.fe_de_vida.domain.events import EventoFeDeVida
    return EventoFeDeVida(tipo, m.proceso.id, 'sol-1', PASIVO, ANALISTA.cedula, detalle)


def test_avisos_de_envio_van_al_pasivo_y_a_bienestar(m):
    primera, reenvio = (solicitudes_de_evento(_evento(m, TipoEvento.SOLICITUD_ENVIADA, envio=n)) for n in (1, 2))
    assert [s.modulo for s in primera] == ['autogestion', 'personal']
    assert primera[0].cedula_destino == PASIVO and primera[0].correo is not None
    assert primera[1].permiso_destino == PERMISO_REVISAR and 'Nueva' in primera[1].titulo
    assert 'reenviada' in reenvio[1].titulo and reenvio[1].clave == '2'


def test_primer_check_avisa_al_otro_rol(m):
    a = solicitudes_de_evento(_evento(m, TipoEvento.PRIMER_CHECK, rol='ANALISTA', envio=1))
    b = solicitudes_de_evento(_evento(m, TipoEvento.PRIMER_CHECK, rol='ADMINISTRADORA', envio=1))
    assert a[0].permiso_destino == PERMISO_CHECK_ADMINISTRADORA and b[0].permiso_destino == PERMISO_CHECK_ANALISTA
    assert solicitudes_de_evento(_evento(m, TipoEvento.PRIMER_CHECK, rol='OTRO')) == []


def test_repeticion_y_rechazo_llevan_motivo_y_correo(m):
    for tipo in (TipoEvento.REPETICION_SOLICITADA, TipoEvento.RECHAZADA):
        [aviso] = solicitudes_de_evento(_evento(m, tipo, motivo='foto borrosa', envio=1))
        assert 'foto borrosa' in aviso.mensaje and aviso.correo and aviso.cedula_destino == PASIVO
    assert solicitudes_de_evento(_evento(m, TipoEvento.EVIDENCIA_CONSULTADA)) == []


def test_validada_adjunta_pdf_y_copia_al_alternativo(m):
    aviso = notificacion_validada(
        _evento(m, TipoEvento.VALIDADA), numero='FV-2026-000001', proceso_nombre='Proceso', clave_pdf='fe_de_vida/c.pdf',
        nombre_pdf='FV-2026-000001.pdf', correos_copia=('alterno@correo.test',),
    )
    assert aviso.correo.copia_a == ('alterno@correo.test',) and aviso.correo.adjuntos[0].clave_almacen == 'fe_de_vida/c.pdf'
    assert 'FV-2026-000001' in aviso.mensaje and aviso.modulo == 'autogestion'


def test_correo_a_bienestar_solo_si_el_ajuste_lo_activa(m):
    apagado = solicitudes_de_evento(_evento(m, TipoEvento.SOLICITUD_ENVIADA, envio=1))
    encendido = solicitudes_de_evento(_evento(m, TipoEvento.SOLICITUD_ENVIADA, envio=1), correo_a_bienestar=True)
    assert apagado[1].correo is None and encendido[1].correo is not None
    assert apagado[0].correo is not None and encendido[0].correo is not None
