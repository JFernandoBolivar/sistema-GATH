"""Tarea programada `postulacion.liberar_reservas_vencidas` (E-7), contra la BD: reservas, diferidos y ventanas."""
import pytest
from django.conf import settings
from django.utils import timezone

from apps.postulacion.application.use_cases.vencimientos import procesar_vencimientos
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel, TransicionExpedienteModel
from apps.postulacion.infrastructure.models.presupuesto_models import ReservaPuestoModel
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from tests.integration.postulacion._presupuesto_mundo import (
    Config,
    Notificador,
    ahora_mas,
    crear_expediente,
    reiniciar_dobles,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def limpio():
    reiniciar_dobles()


def reservar_directo(mundo, exp, puesto='p1', vence=None):
    return ReservaPuestoModel.objects.create(
        expediente_id=exp, puesto_id=mundo[puesto].pk, reservado_por='20000001', vence_el=vence or ahora_mas(days=-1),
    )


def correr(notificador=None, ahora=None):
    return procesar_vencimientos(RepoPostulacionORM(), Config(), notificador, ahora=ahora or timezone.now())


def estado(exp):
    return ExpedientePostulacionModel.objects.get(pk=exp).estado


def test_la_reserva_vencida_pasa_a_vencida_y_la_vigente_no_se_toca(mundo):
    vencida_exp, vigente_exp = crear_expediente(mundo), crear_expediente(mundo, '87654321')
    vencida = reservar_directo(mundo, vencida_exp, 'p1')
    vigente = reservar_directo(mundo, vigente_exp, 'p2', vence=ahora_mas(days=5))
    r = correr()
    assert (r.reservas_vencidas, r.vueltos_a_presupuesto, r.errores) == (1, 0, 0)
    vencida.refresh_from_db(), vigente.refresh_from_db()
    assert (vencida.estado, vencida.motivo_liberacion) == ('VENCIDA', 'vencimiento de la reserva') and vencida.cerrada_el
    assert vigente.estado == 'ACTIVA'
    assert estado(vencida_exp) == 'EN_PRESUPUESTO'  # en Presupuesto solo se libera la reserva
    # el puesto vuelve a estar libre: otro expediente puede reservarlo
    tercero = crear_expediente(mundo, '11111111')
    ReservaPuestoModel.objects.create(expediente_id=tercero, puesto_id=mundo['p1'].pk, reservado_por='1', vence_el=ahora_mas(days=1))


def test_es_idempotente(mundo):
    exp = crear_expediente(mundo)
    reservar_directo(mundo, exp)
    assert correr().reservas_vencidas == 1
    segunda = correr()
    assert segunda.total == 0 and segunda.errores == 0
    assert ReservaPuestoModel.objects.filter(estado='VENCIDA').count() == 1


def test_listo_para_asignar_con_la_reserva_vencida_vuelve_a_presupuesto_como_sistema(mundo, django_capture_on_commit_callbacks):
    exp = crear_expediente(mundo, estado='LISTO_PARA_ASIGNAR')
    ExpedientePostulacionModel.objects.filter(pk=exp).update(reserva_vence_el=ahora_mas(days=-1))
    reservar_directo(mundo, exp)
    with django_capture_on_commit_callbacks(execute=True):
        r = correr(Notificador())
    assert (r.reservas_vencidas, r.vueltos_a_presupuesto) == (1, 1)
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.estado == 'EN_PRESUPUESTO' and e.reserva_vence_el is None
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=exp).latest('fecha')
    assert (asiento.estado_origen, asiento.estado_destino) == ('LISTO_PARA_ASIGNAR', 'EN_PRESUPUESTO')
    assert (asiento.actor_tipo, asiento.actor_cedula) == ('SISTEMA', '') and 'venció' in asiento.motivo
    assert asiento.datos_extra['puesto_id'] == mundo['p1'].pk
    (aviso,) = Notificador.emitidas  # Presupuesto se entera de que debe reservar otro puesto
    assert aviso.tipo == 'EXPEDIENTE_EN_PRESUPUESTO' and aviso.enlace == f'/presupuesto/solicitudes/{exp}'
    assert 'se perdió' in aviso.mensaje
    assert correr().total == 0


def test_otros_estados_con_reserva_vencida_solo_marcan_la_reserva(mundo):
    for n, est in (('10000001', 'EN_DIRECCION_GENERAL'), ('10000002', 'APROBADO'), ('10000003', 'CONSOLIDANDO')):
        reservar_directo(mundo, crear_expediente(mundo, n, estado=est), puesto={'10000001': 'p1', '10000002': 'p2', '10000003': 'p3'}[n])
    r = correr()
    assert (r.reservas_vencidas, r.vueltos_a_presupuesto) == (3, 0)
    assert {ExpedientePostulacionModel.objects.get(postulante__cedula=n).estado for n in ('10000001', '10000002', '10000003')} == {
        'EN_DIRECCION_GENERAL', 'APROBADO', 'CONSOLIDANDO'}


def test_el_diferido_con_la_espera_vencida_pasa_a_desistido(mundo):
    vencido, vigente = crear_expediente(mundo, '10000001', estado='DIFERIDO_PRESUPUESTO'), crear_expediente(
        mundo, '10000002', estado='DIFERIDO_PRESUPUESTO')
    ExpedientePostulacionModel.objects.filter(pk=vencido).update(diferido_vence_el=ahora_mas(days=-1))
    ExpedientePostulacionModel.objects.filter(pk=vigente).update(diferido_vence_el=ahora_mas(days=30))
    r = correr()
    assert (r.desistidos, r.errores) == (1, 0)
    assert (estado(vencido), estado(vigente)) == ('DESISTIDO', 'DIFERIDO_PRESUPUESTO')
    e = ExpedientePostulacionModel.objects.get(pk=vencido)
    assert e.fecha_cierre is not None and e.diferido_vence_el is None
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=vencido).latest('fecha')
    assert (asiento.estado_destino, asiento.actor_tipo, asiento.actor_cedula) == ('DESISTIDO', 'SISTEMA', '')
    assert correr().total == 0


def test_los_expedientes_con_la_ventana_vencida_expiran_y_los_vigentes_no(mundo):
    pre, captura, vigente = (crear_expediente(mundo, c, estado=e) for c, e in (
        ('10000001', 'PRE_REGISTRADO'), ('10000002', 'EN_CAPTURA'), ('10000003', 'EN_CAPTURA')))
    ExpedientePostulacionModel.objects.filter(pk__in=[pre, captura]).update(ventana_vence_el=ahora_mas(days=-1))
    ExpedientePostulacionModel.objects.filter(pk=vigente).update(ventana_vence_el=ahora_mas(days=3))
    r = correr()
    assert (r.expirados, r.errores) == (2, 0)
    assert (estado(pre), estado(captura), estado(vigente)) == ('EXPIRADO', 'EXPIRADO', 'EN_CAPTURA')
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=pre).latest('fecha')
    assert (asiento.actor_tipo, asiento.estado_destino) == ('SISTEMA', 'EXPIRADO')
    assert correr().total == 0


def test_consolidando_con_la_ventana_vencida_expira_libera_la_reserva_y_avisa(mundo, django_capture_on_commit_callbacks):
    exp = crear_expediente(mundo, estado='CONSOLIDANDO')
    ExpedientePostulacionModel.objects.filter(pk=exp).update(ventana_vence_el=ahora_mas(days=-1))
    reserva = reservar_directo(mundo, exp, 'p1', vence=ahora_mas(days=15))  # vigente: no la vence el paso de reservas
    with django_capture_on_commit_callbacks(execute=True):
        r = correr(Notificador())
    assert (r.expirados, r.reservas_vencidas, r.errores) == (1, 0, 0)
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.estado == 'EXPIRADO' and e.fecha_cierre is not None and e.contacto_pendiente_desde is None
    reserva.refresh_from_db()
    assert (reserva.estado, reserva.motivo_liberacion, reserva.cerrada_el is not None) == (
        'LIBERADA', 'vencimiento de la ventana del postulante', True)
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=exp).latest('fecha')
    assert (asiento.estado_origen, asiento.estado_destino, asiento.actor_tipo, asiento.actor_cedula) == (
        'CONSOLIDANDO', 'EXPIRADO', 'SISTEMA', '')
    (aviso,) = Notificador.emitidas  # Captación se entera y el puesto vuelve a estar libre
    assert aviso.tipo == 'EXPEDIENTE_EXPIRADO' and aviso.enlace == f'/captacion/expedientes/{exp}'
    assert 'Ventana 2' in aviso.mensaje and 'quedó libre' in aviso.mensaje
    assert correr().total == 0  # idempotente


def test_consolidando_con_la_ventana_vigente_no_expira_ni_libera_la_reserva(mundo):
    exp = crear_expediente(mundo, estado='CONSOLIDANDO')
    ExpedientePostulacionModel.objects.filter(pk=exp).update(ventana_vence_el=ahora_mas(days=3))
    reserva = reservar_directo(mundo, exp, 'p1', vence=ahora_mas(days=15))
    assert correr().total == 0
    assert estado(exp) == 'CONSOLIDANDO'
    reserva.refresh_from_db()
    assert reserva.estado == 'ACTIVA'


def test_consolidando_vencido_sin_reserva_activa_tambien_expira(mundo):
    exp = crear_expediente(mundo, estado='CONSOLIDANDO')
    ExpedientePostulacionModel.objects.filter(pk=exp).update(ventana_vence_el=ahora_mas(days=-1))
    r = correr()
    assert (r.expirados, r.errores) == (1, 0)
    assert estado(exp) == 'EXPIRADO'


def test_un_expediente_en_correccion_de_datos_no_expira_aunque_su_ventana_venza(mundo):
    exp = crear_expediente(mundo, estado='EN_CORRECCION_DATOS')
    ExpedientePostulacionModel.objects.filter(pk=exp).update(ventana_vence_el=ahora_mas(days=-1))
    assert correr().total == 0 and estado(exp) == 'EN_CORRECCION_DATOS'


def test_un_fallo_en_un_expediente_no_detiene_a_los_demas(mundo, monkeypatch):
    malo, bueno = crear_expediente(mundo, '10000001', estado='DIFERIDO_PRESUPUESTO'), crear_expediente(
        mundo, '10000002', estado='DIFERIDO_PRESUPUESTO')
    ExpedientePostulacionModel.objects.filter(pk__in=[malo, bueno]).update(diferido_vence_el=ahora_mas(days=-1))
    original = RepoPostulacionORM.guardar_expediente

    def guardar(self, e):
        if e.id == malo:
            raise RuntimeError('fallo simulado')
        return original(self, e)

    monkeypatch.setattr(RepoPostulacionORM, 'guardar_expediente', guardar)
    r = correr()
    assert (r.desistidos, r.errores) == (1, 1)
    assert (estado(malo), estado(bueno)) == ('DIFERIDO_PRESUPUESTO', 'DESISTIDO')


def test_la_tarea_celery_esta_registrada_y_programada_cada_15_minutos(mundo, monkeypatch):
    from apps.postulacion.infrastructure.tasks import vencimientos_tasks
    assert vencimientos_tasks.liberar_reservas_vencidas_tarea.name == 'postulacion.liberar_reservas_vencidas'
    entrada = settings.CELERY_BEAT_SCHEDULE['postulacion-liberar-reservas-vencidas']
    assert entrada['task'] == 'postulacion.liberar_reservas_vencidas' and entrada['schedule'] == 900.0
    exp = crear_expediente(mundo)
    reservar_directo(mundo, exp)
    monkeypatch.setattr(vencimientos_tasks, 'obtener_lector_configuracion', lambda: Config())
    monkeypatch.setattr(vencimientos_tasks, 'obtener_notificador', lambda: Notificador())
    resultado = vencimientos_tasks.liberar_reservas_vencidas_tarea()
    assert resultado['reservas_vencidas'] == 1 and resultado['errores'] == 0
    assert vencimientos_tasks.liberar_reservas_vencidas_tarea()['reservas_vencidas'] == 0
    monkeypatch.setattr(vencimientos_tasks, 'obtener_lector_configuracion', lambda: None)
    assert vencimientos_tasks.liberar_reservas_vencidas_tarea() == {'omitida': True}
