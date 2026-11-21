"""Correo al postulante (D-9): contenido, condiciones, momento (tras el commit) y puerto de correo directo (sin BD)."""
from datetime import datetime, timezone

import pytest

from apps.notificaciones.application.use_cases.correo_outbox import enviar_correo
from apps.notificaciones.application.use_cases.servicio_notificaciones import ServicioNotificaciones
from apps.postulacion.application.use_cases.avisos import correo_al_postulante, programar_avisos
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente as E
from core.domain.exceptions import ValidationError
from core.domain.notificaciones import SolicitudCorreoDirecto
from tests.unit.notificaciones.memoria import (
    AlmacenMem,
    CacheMem,
    EnviadorMem,
    PlanificadorMem,
    RepoNotifMem,
    RepoOutboxMem,
    ResolutorMem,
)

AHORA = datetime(2026, 11, 21, 16, tzinfo=timezone.utc)
VENCE = datetime(2026, 12, 6, 16, tzinfo=timezone.utc)  # 12:00 en Venezuela
CAPTACION = Actor(cedula='20000001', permisos=frozenset({'postulacion.verificar'}))
CEDULA_SECRETA = '12345678'


def postulante(correo='ana@correo.com'):
    return Postulante(id='2', cedula=CEDULA_SECRETA, nombres='Ana', apellidos='Pérez', correo=correo)


def expediente(estado, vence=VENCE):
    return ExpedientePostulacion(id='7', numero='EXP-2026-00007', postulante_id='2', estado=estado, ventana_vence_el=vence)


def correo(origen, destino, motivo='Falta el segundo apellido', p=None, actor=CAPTACION, vence=VENCE):
    return correo_al_postulante(expediente(destino, vence), p or postulante(), origen, destino, actor, 'asiento-1', motivo)


def test_devolver_con_observaciones_incluye_numero_motivo_enlace_y_plazo():
    c = correo(E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS)
    assert c.destinatario_correo == 'ana@correo.com' and c.asunto == 'Tu postulación necesita correcciones'
    assert 'EXP-2026-00007' in c.mensaje and 'Falta el segundo apellido' in c.mensaje
    assert 'contraseña' in c.mensaje and '06/12/2026 a las 12:00' in c.mensaje
    assert c.enlace == '/postulacion/acceso' and c.clave == 'asiento-1' and c.ref_id == '7'


def test_reabrir_ventana_2_felicita_e_incluye_enlace_y_plazo():
    c = correo(E.APROBADO, E.CONSOLIDANDO, motivo='')
    assert c.asunto == '¡Tu ingreso fue aprobado! Completa tus datos'
    assert 'EXP-2026-00007' in c.mensaje and '06/12/2026' in c.mensaje and c.enlace == '/postulacion/acceso'


def test_rechazo_es_cordial_y_no_revela_el_motivo_interno():
    c = correo(E.ENVIADO_CAPTACION, E.RECHAZADO_CAPTACION, motivo='Antecedentes: detalle interno confidencial')
    assert 'detalle interno' not in c.mensaje and 'EXP-2026-00007' in c.mensaje and c.enlace == ''


def test_sin_plazo_conocido_el_texto_remite_al_portal():
    c = correo(E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS, vence=None)
    assert 'ventana que reabrimos' in c.mensaje and 'None' not in c.mensaje


@pytest.mark.parametrize('c', [
    lambda: correo(E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS),
    lambda: correo(E.APROBADO, E.CONSOLIDANDO),
    lambda: correo(E.ENVIADO_CAPTACION, E.RECHAZADO_CAPTACION),
])
def test_nunca_incluye_la_cedula_ni_pide_la_contrasena(c):
    c = c()
    texto = f'{c.asunto} {c.titulo} {c.mensaje} {c.enlace}'
    assert CEDULA_SECRETA not in texto and 'ana@correo.com' not in texto


def test_sin_correo_o_en_otros_pasos_no_hay_correo():
    assert correo(E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS, p=postulante('')) is None
    assert correo(E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS, p=postulante('  ')) is None
    assert correo(E.EN_REVISION_FINAL, E.CONSOLIDANDO) is None
    assert correo(E.ENVIADO_CAPTACION, E.EN_PRESUPUESTO) is None
    # El propio postulante enviando su ventana no se avisa por correo.
    assert correo(E.EN_CORRECCION_DATOS, E.ENVIADO_CAPTACION, actor=Actor.postulante(CEDULA_SECRETA)) is None


# ----------------------------------------------------------------------------------------------- momento: tras el commit
class RepoCommit:
    def __init__(self):
        self.pendientes = []

    def al_confirmar(self, accion):
        self.pendientes.append(accion)

    def confirmar(self):
        for a in self.pendientes:
            a()

    def revertir(self):
        self.pendientes.clear()


class NotificadorFalso:
    def __init__(self, falla=False):
        self.correos, self.falla = [], falla

    def notificar(self, s):
        return 1

    def resolver_avisos(self, *a, **k):
        return 0

    def enviar_correo_directo(self, s):
        if self.falla:
            raise RuntimeError('outbox caído')
        self.correos.append(s)
        return True


def programar(repo, notificador, p=None):
    programar_avisos(
        repo, notificador, exp=expediente(E.EN_CORRECCION_DATOS), postulante=p or postulante(), origen=E.ENVIADO_CAPTACION,
        destino=E.EN_CORRECCION_DATOS, actor=CAPTACION, asiento_id='a1', motivo='Corrija el domicilio',
    )


def test_el_correo_se_encola_solo_despues_del_commit():
    repo, n = RepoCommit(), NotificadorFalso()
    programar(repo, n)
    assert n.correos == []  # la transacción sigue abierta
    repo.confirmar()
    assert len(n.correos) == 1 and 'Corrija el domicilio' in n.correos[0].mensaje


def test_si_la_transaccion_se_revierte_no_hay_correo():
    repo, n = RepoCommit(), NotificadorFalso()
    programar(repo, n)
    repo.revertir()
    repo.confirmar()
    assert n.correos == []


def test_sin_correo_del_postulante_no_se_encola():
    repo, n = RepoCommit(), NotificadorFalso()
    programar(repo, n, p=postulante(''))
    repo.confirmar()
    assert n.correos == []


def test_un_fallo_del_outbox_no_rompe_la_transicion():
    repo, n = RepoCommit(), NotificadorFalso(falla=True)
    programar(repo, n)
    repo.confirmar()  # no lanza: queda en el log


# ----------------------------------------------------------------------------------------------- puerto en notificaciones
def montar():
    outbox, plan = RepoOutboxMem(), PlanificadorMem()
    return ServicioNotificaciones(RepoNotifMem(), outbox, ResolutorMem(), CacheMem(), plan), outbox, plan


def solicitud(**extra):
    base = dict(
        tipo='POSTULACION_CORRECCION', destinatario_correo='ana@correo.com', asunto='Asunto', titulo='Título',
        mensaje='Cuerpo', enlace='/postulacion/acceso', ref_tipo='expediente_postulacion', ref_id='7', clave='a1',
    )
    return SolicitudCorreoDirecto(**{**base, **extra})


def test_correo_directo_usa_el_outbox_sin_cuenta_ni_campana_y_se_deduplica():
    servicio, outbox, plan = montar()
    assert servicio.enviar_correo_directo(solicitud()) is True
    assert servicio.enviar_correo_directo(solicitud()) is False  # reintento del mismo hecho
    assert len(outbox.filas) == 1 and len(plan.programados) == 1
    msg = next(iter(outbox.filas.values()))
    assert msg.destinatario == 'ana@correo.com' and msg.destinatario_cedula == '' and msg.enlace == '/postulacion/acceso'
    assert msg.idempotency_key.endswith(':ana@correo.com:EMAIL')
    assert servicio.enviar_correo_directo(solicitud(clave='a2')) is True  # otro asiento = otro correo


def test_el_envio_real_antepone_la_url_del_frontend_y_escapa_el_html():
    servicio, outbox, _ = montar()
    servicio.enviar_correo_directo(solicitud(mensaje='Corrige <b>esto</b>'))
    msg = next(iter(outbox.filas.values()))
    enviador = EnviadorMem()
    res = enviar_correo(outbox, enviador, AlmacenMem(), msg.id, AHORA, url_base='https://gath.conatel.gob.ve/')
    assert res.estado == 'ENVIADO'
    enviado = enviador.enviados[0]
    assert enviado['destinatario'] == 'ana@correo.com' and enviado['asunto'] == 'Asunto'
    assert 'https://gath.conatel.gob.ve/postulacion/acceso' in enviado['texto']
    assert '&lt;b&gt;' in enviado['html'] and '<b>esto' not in enviado['html']


@pytest.mark.parametrize('extra', [
    {'destinatario_correo': ''}, {'destinatario_correo': 'sin-arroba'}, {'destinatario_correo': 'a@b.com, c@d.com'},
    {'destinatario_correo': 'a b@c.com'}, {'asunto': 'Hola\nBcc: x@y.com'}, {'asunto': ' '}, {'mensaje': ''},
    {'enlace': 'https://externo.com'}, {'tipo': ''},
])
def test_solicitud_de_correo_directo_valida(extra):
    with pytest.raises(ValidationError):
        solicitud(**extra)
