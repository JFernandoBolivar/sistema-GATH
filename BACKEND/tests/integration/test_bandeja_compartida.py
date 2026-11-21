"""H-4 contra la BD de pruebas: aviso por permiso, resolución compartida y lista de la API con 'atendida por'."""
import pytest
from rest_framework.test import APIClient

from apps.notificaciones.application.use_cases.servicio_notificaciones import ServicioNotificaciones
from apps.notificaciones.infrastructure.cache_conteo_django import CacheConteoDjango
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.notificaciones.infrastructure.planificador_envio_celery import PlanificadorEnvioCelery
from apps.notificaciones.infrastructure.repositories.repo_notificaciones_orm import RepoNotificacionesORM
from apps.notificaciones.infrastructure.repositories.repo_outbox_orm import RepoOutboxORM
from core.domain.notificaciones import SolicitudNotificacion

CEDULAS = ['20000001', '20000002', '20000003']


class Resolutor:
    def cedulas_con_permiso(self, codigo):
        return CEDULAS

    def nombre_de(self, cedula):
        return {'20000002': 'Ana Pérez'}.get(cedula, '')

    def correo_de(self, cedula):
        return ''


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula):
        self.cedula_id, self.pk, self.id = cedula, 1, 1

    def tiene_permiso(self, codigo):
        return True


@pytest.fixture
def servicio():
    return ServicioNotificaciones(
        RepoNotificacionesORM(), RepoOutboxORM(), Resolutor(), CacheConteoDjango(), PlanificadorEnvioCelery(),
    )


@pytest.mark.django_db
def test_resolver_marca_atendidas_las_copias_del_grupo_y_la_api_lo_informa(servicio):
    servicio.notificar(SolicitudNotificacion(
        tipo='carnetizacion.solicitud_nueva', titulo='Solicitud', mensaje='M', permiso_destino='x.y',
        ref_tipo='solicitud', ref_id='9',
    ))
    assert NotificacionModel.objects.values('grupo').distinct().count() == 1
    assert NotificacionModel.objects.filter(leida=False).count() == 3

    assert servicio.resolver_avisos('solicitud', '9', por_cedula='20000002') == 3
    assert servicio.resolver_avisos('solicitud', '9', por_cedula='20000003') == 0  # idempotente
    assert NotificacionModel.objects.filter(atendida=True, atendida_por_cedula='20000002', leida=True).count() == 3

    c = APIClient()
    c.force_authenticate(user=Usuario('20000001'))
    r = c.get('/api/v1/notificaciones/')
    assert r.status_code == 200, r.content
    fila = r.json()['data']['results'][0]
    assert fila['atendida'] is True and fila['atendida_por_nombre'] == 'Ana Pérez' and fila['fecha_atendida']
    assert RepoNotificacionesORM().contar_no_leidas('20000001') == 0
