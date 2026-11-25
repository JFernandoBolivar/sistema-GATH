"""La configuración del Punto de Cuenta solo administra procesos y correlativo."""
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.configuracion.infrastructure.repositories.repo_parametros_orm import (
    RepoParametrosORM,
)
from apps.puntocuenta.application.use_cases.correlativo_punto_cuenta import (
    obtener_siguiente_correlativo,
)
from apps.puntocuenta.infrastructure.models.configuracion_punto_cuenta_model import (
    ConfiguracionPuntoCuentaModel,
    SecuenciaPuntoCuentaModel,
)
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import (
    RepoSecuenciaPuntoCuentaORM,
)
from core.domain.configuracion import CLAVE_GENERAR_PUNTOS_CUENTA

pytestmark = pytest.mark.django_db
BASE = '/api/v1/puntocuenta/configuracion/'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self):
        self.cedula_id, self.pk, self.id, self.rol = '1', 7, 7, None
        self._permisos = {'configuracion.editar'}

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


def test_get_no_expone_campos_de_texto_o_firmas():
    respuesta = _cliente().get(BASE)
    assert respuesta.status_code == 200, respuesta.content
    datos = respuesta.json()['data']
    assert datos['procesos_habilitados']['cambio_oficina'] is True
    assert datos['version'] == 1
    assert not ({'titulo', 'cuerpo', 'firmas', 'plantillas_procesos', 'mostrar_nivel'} & set(datos))


def test_put_actualiza_procesos_interruptor_y_auditoria_de_version():
    with patch('apps.puntocuenta.presentation.views.punto_cuenta_views.registrar_auditoria') as auditoria:
        respuesta = _cliente().put(
            BASE,
            {'procesos_habilitados': {'cambio_nivel': True}, 'generar': False},
            format='json',
        )
    assert respuesta.status_code == 200, respuesta.content
    datos = respuesta.json()['data']
    assert datos['procesos_habilitados']['cambio_nivel'] is True
    assert datos['version'] == 1 and datos['actualizado_por_id'] == 7
    assert RepoParametrosORM().obtener(CLAVE_GENERAR_PUNTOS_CUENTA).valor == 'false'
    configuracion = ConfiguracionPuntoCuentaModel.objects.get(version=1)
    assert configuracion.actualizado_por_id == 7
    assert auditoria.call_args.kwargs['recurso_id'] == str(configuracion.id)


def test_put_rechaza_la_edicion_de_textos_y_firmas_retirados():
    respuesta = _cliente().put(BASE, {'cuerpo': 'Texto antiguo', 'firmas': []}, format='json')
    assert respuesta.status_code == 400
    assert not ConfiguracionPuntoCuentaModel.objects.exists()


def test_correlativo_sigue_siendo_atomico_y_secuencial():
    repo = RepoSecuenciaPuntoCuentaORM()
    assert obtener_siguiente_correlativo(repo, 2026) == (1, '0001-2026')
    assert obtener_siguiente_correlativo(repo, 2026) == (2, '0002-2026')
    assert SecuenciaPuntoCuentaModel.objects.get(anio=2026).ultimo_numero == 2
