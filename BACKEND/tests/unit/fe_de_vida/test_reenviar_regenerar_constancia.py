"""Unitarios (sin BD) de reenviar y regenerar constancia de fe de vida (A8)."""
import itertools
from dataclasses import replace
from datetime import date, datetime, timezone

import pytest

from apps.fe_de_vida.application.use_cases import revision
from apps.fe_de_vida.application.use_cases.constancias import (
    LIMITE_REENVIOS_DIARIOS,
    emitir_constancia,
    reenviar_constancia,
    regenerar_constancia,
)
from apps.fe_de_vida.domain.entities.constancia import ConstanciaFeDeVida, PlantillaConstancia
from apps.fe_de_vida.domain.entities.solicitud import ActorRevision, PermisosRevision
from apps.fe_de_vida.domain.services.constancia import enmascarar_correo, formatear_numero
from apps.fe_de_vida.domain.value_objects.estados import RolRevision
from core.domain.exceptions import ConflictError
from tests.unit.fe_de_vida.memoria import ADMINISTRADORA, AHORA, ANALISTA, PASIVO, LectorPasivosMem, Mundo

URL = 'http://sistema.test/verificar'
PLANTILLA_V1 = PlantillaConstancia(1, 'CONSTANCIA', 'El {fecha} {nombre_completo}, C.I. {cedula}, {condicion}.')
PLANTILLA_V2 = PlantillaConstancia(2, 'CONSTANCIA NUEVA', 'El día {fecha} el ciudadano {nombre_completo}, C.I. {cedula}.')


class RepoConstanciasMem:
    def __init__(self, plantilla=PLANTILLA_V1):
        self.filas = {}
        self._n = itertools.count(1)
        self.plantilla = plantilla
        self.reenvios = []

    def plantilla_activa(self):
        return self.plantilla

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

    def actualizar_plantilla_version(self, constancia_id, version):
        self.filas[constancia_id] = replace(self.filas[constancia_id], plantilla_version=version)

    def contar_reenvios_hoy(self, constancia_id, fecha):
        return sum(1 for r in self.reenvios if r['constancia_id'] == constancia_id and r['fecha'] == fecha)

    def registrar_reenvio(self, constancia_id, actor_cedula, destinatario, copia, fecha):
        self.reenvios.append({
            'constancia_id': constancia_id,
            'actor_cedula': actor_cedula,
            'destinatario': destinatario,
            'copia': copia,
            'fecha': fecha,
        })


class GeneradorMem:
    def __init__(self):
        self.llamadas = []

    def generar(self, **kwargs):
        self.llamadas.append(kwargs)
        return b'%PDF-prueba'


class NotificadorMem:
    def __init__(self):
        self.notificaciones = []

    def notificar(self, notificacion):
        self.notificaciones.append(notificacion)


def test_enmascarar_correo():
    assert enmascarar_correo('juan.perez@gmail.com') == 'j***z@gmail.com'
    assert enmascarar_correo('pasivo@conatel.gob.ve') == 'p***o@conatel.gob.ve'
    assert enmascarar_correo('ab@c.com') == 'a***b@c.com'
    assert enmascarar_correo('a@b.com') == 'a***@b.com'
    assert enmascarar_correo('') == ''
    assert enmascarar_correo('invalido') == ''


def test_reenviar_constancia_exitoso():
    m = Mundo()
    s = m.solicitud_enviada()
    revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ANALISTA, ahora=AHORA)
    s_val = revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ADMINISTRADORA, ahora=AHORA)

    repo_const = RepoConstanciasMem()
    lector = LectorPasivosMem()
    generador = GeneradorMem()
    notificador = NotificadorMem()

    emitir_constancia(
        m.procesos, m.solicitudes, repo_const, lector, generador, m.storage,
        solicitud_id=s_val.id, url_verificacion_base=URL, ahora=AHORA,
    )

    res = reenviar_constancia(
        m.solicitudes, repo_const, m.procesos, lector, notificador,
        solicitud_id=s_val.id, actor_cedula=ADMINISTRADORA.cedula, ahora=AHORA,
    )

    assert res['numero'].startswith('FV-2026-')
    assert res['destinatario'] == f'{PASIVO}@correo.test'
    assert res['destinatario_enmascarado'] == enmascarar_correo(f'{PASIVO}@correo.test')
    assert res['copia'] == f'alterno{PASIVO}@correo.test'
    assert res['reenvios_hoy'] == 1
    assert res['limite_diario'] == LIMITE_REENVIOS_DIARIOS
    assert len(notificador.notificaciones) == 1
    assert notificador.notificaciones[0].correo.copia_a == (f'alterno{PASIVO}@correo.test',)


def test_reenviar_constancia_limite_diario():
    m = Mundo()
    s = m.solicitud_enviada()
    revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ANALISTA, ahora=AHORA)
    s_val = revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ADMINISTRADORA, ahora=AHORA)

    repo_const = RepoConstanciasMem()
    lector = LectorPasivosMem()
    generador = GeneradorMem()
    notificador = NotificadorMem()

    emitir_constancia(
        m.procesos, m.solicitudes, repo_const, lector, generador, m.storage,
        solicitud_id=s_val.id, url_verificacion_base=URL, ahora=AHORA,
    )

    # 3 reenvíos permitidos
    for i in range(3):
        res = reenviar_constancia(
            m.solicitudes, repo_const, m.procesos, lector, notificador,
            solicitud_id=s_val.id, actor_cedula=ADMINISTRADORA.cedula, ahora=AHORA,
        )
        assert res['reenvios_hoy'] == i + 1

    # El 4to debe ser rechazado
    with pytest.raises(ConflictError, match="límite de 3 reenvíos por día"):
        reenviar_constancia(
            m.solicitudes, repo_const, m.procesos, lector, notificador,
            solicitud_id=s_val.id, actor_cedula=ADMINISTRADORA.cedula, ahora=AHORA,
        )


def test_regenerar_constancia_conserva_numero_y_actualiza_plantilla():
    m = Mundo()
    s = m.solicitud_enviada()
    revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ANALISTA, ahora=AHORA)
    s_val = revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ADMINISTRADORA, ahora=AHORA)

    repo_const = RepoConstanciasMem(plantilla=PLANTILLA_V1)
    lector = LectorPasivosMem()
    generador = GeneradorMem()

    c1 = emitir_constancia(
        m.procesos, m.solicitudes, repo_const, lector, generador, m.storage,
        solicitud_id=s_val.id, url_verificacion_base=URL, ahora=AHORA,
    )
    assert c1.plantilla_version == 1
    numero_original = c1.numero
    codigo_original = c1.codigo_verificacion

    # Ahora la plantilla activa cambia a v2
    repo_const.plantilla = PLANTILLA_V2

    c2 = regenerar_constancia(
        m.procesos, m.solicitudes, repo_const, lector, generador, m.storage,
        solicitud_id=s_val.id, url_verificacion_base=URL, ahora=AHORA,
    )

    assert c2.numero == numero_original
    assert c2.codigo_verificacion == codigo_original
    assert c2.plantilla_version == 2
    assert repo_const.obtener_de_solicitud(s_val.id).plantilla_version == 2


def test_acciones_disponibles_en_solicitud_validada():
    m = Mundo()
    s = m.solicitud_enviada()
    revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ANALISTA, ahora=AHORA)
    s_val = revision.dar_check(m.solicitudes, m.aplicador, m.publicador, solicitud_id=s.id, actor=ADMINISTRADORA, ahora=AHORA)

    actor_revisor = ActorRevision('30000001', RolRevision.ANALISTA)
    permisos = PermisosRevision(revisar=True)

    acciones = s_val.acciones_disponibles(actor_revisor, permisos)
    assert 'reenviar_constancia' in acciones
    assert 'regenerar_constancia' in acciones
