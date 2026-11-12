"""«Guardar configuración» del punto de cuenta persiste el parámetro de generación (antes: 500)."""
import pytest

from apps.configuracion.infrastructure.repositories.repo_parametros_orm import RepoParametrosORM
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import (
    RepoConfiguracionPuntoCuentaORM,
)
from core.domain.configuracion import CLAVE_GENERAR_PUNTOS_CUENTA

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize('generar, esperado', [(True, 'true'), (False, 'false')])
def test_guardar_generar_actualiza_el_parametro(generar, esperado):
    RepoConfiguracionPuntoCuentaORM().guardar_generar(generar, None)

    assert RepoParametrosORM().obtener(CLAVE_GENERAR_PUNTOS_CUENTA).valor == esperado
