"""API de parámetros del sistema (D9) contra la BD de pruebas."""
import pytest
from rest_framework.test import APIClient

from apps.configuracion.infrastructure.lector_configuracion import LectorConfiguracionORM
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
from core.domain.configuracion import (
    CLAVE_AUTOGESTION_AVISO_DIAS,
    CLAVE_FE_DE_VIDA_RECORDATORIOS,
    CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO,
)
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

BASE = '/api/v1/configuracion/parametros/'
PERMISO = 'configuracion.editar'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, pk=1, cedula='V12345678'):
        self.pk = self.id = pk
        self.cedula_id = cedula
        self.rol = type('Rol', (), {'nombre_rol': 'ADMINISTRADOR'})()
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


def data(respuesta):
    return respuesta.json()['data']


def test_listado_devuelve_los_parametros_agrupables_con_su_defecto():
    respuesta = cliente(PERMISO).get(BASE)

    assert respuesta.status_code == 200
    parametros = data(respuesta)
    assert len(parametros) == 6
    assert {p['grupo'] for p in parametros} == {'notificaciones', 'plazos', 'fe_de_vida'}
    assert all(p['valor'] == p['defecto'] for p in parametros)


def test_sin_permiso_no_se_puede_consultar_ni_editar():
    api = cliente()
    assert api.get(BASE).status_code == 403
    assert api.put(f'{BASE}{CLAVE_AUTOGESTION_AVISO_DIAS}/', {'valor': '2'}, format='json').status_code == 403


def test_editar_guarda_auditoria_y_el_lector_lo_ve_sin_reiniciar():
    api = cliente(PERMISO)
    url = f'{BASE}{CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO}/'

    respuesta = api.put(url, {'valor': 'true'}, format='json')

    assert respuesta.status_code == 200
    assert data(respuesta)['valor'] == 'true'
    assert ParametroSistemaModel.objects.get(
        clave=CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO
    ).valor == 'true'
    assert LectorConfiguracionORM().obtener_booleano(
        CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO
    ) is True

    auditoria = AuditoriaLog.objects.get(recurso_id=CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO)
    assert auditoria.actor_cedula == 'V12345678'
    assert auditoria.estado_previo == {'valor': 'false'}
    assert auditoria.estado_nuevo == {'valor': 'true'}
    assert auditoria.modulo == 'configuracion'


def test_valor_invalido_da_400_y_no_escribe():
    respuesta = cliente(PERMISO).put(
        f'{BASE}{CLAVE_AUTOGESTION_AVISO_DIAS}/', {'valor': '999'}, format='json'
    )
    assert respuesta.status_code == 400
    assert not ParametroSistemaModel.objects.filter(clave=CLAVE_AUTOGESTION_AVISO_DIAS).exists()


def test_historial_pagina_los_cambios_del_parametro():
    api = cliente(PERMISO)
    url = f'{BASE}{CLAVE_AUTOGESTION_AVISO_DIAS}/'
    api.put(url, {'valor': '2'}, format='json')
    api.put(url, {'valor': '3'}, format='json')

    respuesta = api.get(f'{url}historial/?pagina=1&page_size=10')

    assert respuesta.status_code == 200
    cuerpo = data(respuesta)
    assert cuerpo['total'] == 2
    assert [c['valor_nuevo'] for c in cuerpo['resultados']] == ['3', '2']


def test_el_endpoint_de_recordatorios_refleja_el_parametro():
    api = cliente(PERMISO)
    antes = api.get(f'{BASE}recordatorios-fe-de-vida/')
    assert antes.status_code == 200
    assert data(antes)['dias'] == [30, 15, 7, 3, 1]

    api.put(f'{BASE}{CLAVE_FE_DE_VIDA_RECORDATORIOS}/', {'valor': '10,2'}, format='json')
    despues = api.get(f'{BASE}recordatorios-fe-de-vida/')
    assert data(despues)['dias'] == [10, 2]
