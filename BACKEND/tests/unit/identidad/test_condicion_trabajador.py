"""Condición del trabajador (ACTIVO/PASIVO): caso de uso y guard `RequiereCondicion` (sin BD)."""
import pytest

from apps.identidad.application.use_cases.obtener_condicion_trabajador import (
    obtener_condicion_trabajador,
)
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.providers.resolutor_core import ResolutorCondicionIdentidad
from core.infrastructure.providers import (
    registrar_resolutor_condicion,
    reiniciar_proveedores,
)
from core.presentation.permissions import RequiereCondicion


class _RepoFalso:
    def __init__(self, datos):
        self.datos = datos
        self.consultas = []

    def condicion_por_cedula(self, cedula):
        self.consultas.append(cedula)
        return self.datos.get(cedula, CondicionTrabajador.SIN_ASIGNACION)


class _Cedula:
    def __init__(self, valor):
        self.cedulaidentidad = valor


class _Usuario:
    pk = 1
    is_authenticated = True

    def __init__(self, cedula):
        self.cedula = _Cedula(cedula)


class _Request:
    def __init__(self, user):
        self.user = user


REPO = _RepoFalso({'111': CondicionTrabajador.PASIVO, '222': CondicionTrabajador.ACTIVO})


@pytest.fixture(autouse=True)
def _limpiar():
    reiniciar_proveedores()
    yield
    reiniciar_proveedores()


def test_caso_de_uso_devuelve_la_condicion_del_repositorio():
    assert obtener_condicion_trabajador(REPO, '111') is CondicionTrabajador.PASIVO
    assert obtener_condicion_trabajador(REPO, ' 222 ') is CondicionTrabajador.ACTIVO
    assert obtener_condicion_trabajador(REPO, '999') is CondicionTrabajador.SIN_ASIGNACION


@pytest.mark.parametrize('cedula', [None, '', '   '])
def test_sin_cedula_es_sin_asignacion_y_no_consulta(cedula):
    repo = _RepoFalso({})
    assert obtener_condicion_trabajador(repo, cedula) is CondicionTrabajador.SIN_ASIGNACION
    assert repo.consultas == []


def test_guard_permite_solo_la_condicion_exigida():
    registrar_resolutor_condicion(ResolutorCondicionIdentidad(REPO))
    solo_pasivos = RequiereCondicion('PASIVO')()
    assert solo_pasivos.has_permission(_Request(_Usuario('111')), None) is True
    assert solo_pasivos.has_permission(_Request(_Usuario('222')), None) is False
    assert solo_pasivos.has_permission(_Request(_Usuario('999')), None) is False
    assert RequiereCondicion('ACTIVO')().has_permission(_Request(_Usuario('222')), None) is True


def test_guard_falla_cerrado_sin_resolutor_o_sin_autenticar():
    assert RequiereCondicion('PASIVO')().has_permission(_Request(_Usuario('111')), None) is False
    registrar_resolutor_condicion(ResolutorCondicionIdentidad(REPO))
    anonimo = _Usuario('111')
    anonimo.is_authenticated = False
    assert RequiereCondicion('PASIVO')().has_permission(_Request(anonimo), None) is False
