"""
M7 con el motor IAM real (no con conjuntos de permisos fabricados).

La decisión «¿puede filtrar por estructura?» la resuelve el mismo camino que
`HasPermission`: `resolver_politica_actor` + `evaluar_permiso` (deny explícito
con prioridad, comodines `*` y `modulo.*`, deny implícito). El dominio solo
recibe el booleano ya evaluado.

Casos obligatorios de la revisión: allow directo, `*`, `organizacion.*`, deny
individual sobre un allow de rol, y ausencia del permiso.
"""
from datetime import date

import pytest

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.resolver_permisos import tiene_permiso
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.entities.usuario_permisos import UsuarioPermisos
from apps.reportes.domain.services.filtros_reporte_personal import (
    preparar_consulta_personal,
)
from apps.reportes.domain.value_objects.permisos_reportes import (
    PERMISO_ESTRUCTURA_ORGANIZATIVA,
)
from core.domain.exceptions import PermissionDeniedError
from core.infrastructure.report_field_registry import ReportFieldRegistryORM

HOY = date(2026, 10, 30)
PERMISO = PERMISO_ESTRUCTURA_ORGANIZATIVA
CEDULA = 'V12345678'
ROL_ID = 2


class _RepoPermisosMemoria:
    """Doble del puerto `RepoPermisos` con la política del rol y del usuario."""

    def __init__(self, politica_rol=None, politica_usuario=None):
        self._politica_rol = politica_rol or PoliticaAcceso()
        self._politica_usuario = politica_usuario

    def obtener_permisos_usuario(self, cedula):
        if self._politica_usuario is None:
            return None
        return UsuarioPermisos(cedula=cedula, rol_id=ROL_ID, politica_efectiva=self._politica_usuario)

    def politica_del_rol(self, rol_id):
        return self._politica_rol


def _permite(politica_rol=None, politica_usuario=None) -> bool:
    """Evalúa el permiso por el camino real de `HasPermission`."""
    repo = _RepoPermisosMemoria(politica_rol, politica_usuario)
    actor = ActorSesionDTO(cuenta_id=1, rol_id=ROL_ID, cedula=CEDULA)
    return tiene_permiso(repo, actor, PERMISO)


@pytest.fixture
def configuracion():
    return ReportFieldRegistryORM().configuracion('empleados')


@pytest.mark.parametrize(
    'politica',
    [
        PoliticaAcceso(allow=frozenset({PERMISO})),
        PoliticaAcceso(allow=frozenset({'*'})),
        PoliticaAcceso(allow=frozenset({'organizacion.*'})),
    ],
    ids=['allow-directo', 'comodin-global', 'comodin-de-modulo'],
)
def test_con_permiso_el_filtro_de_estructura_pasa(configuracion, politica):
    permitido = _permite(politica_usuario=politica)
    assert permitido is True

    consulta = preparar_consulta_personal(
        {'dependencia_id': '3'}, configuracion, puede_filtrar_estructura=permitido, hoy=HOY
    )
    assert consulta.lookups == {'assignments__Dependencia': 3}


@pytest.mark.parametrize(
    'rol, usuario',
    [
        # allow del rol + deny individual del mismo código
        (
            PoliticaAcceso(allow=frozenset({PERMISO})),
            PoliticaAcceso(allow=frozenset({PERMISO}), deny=frozenset({PERMISO})),
        ),
        # deny individual gana incluso sobre el comodín global
        (
            PoliticaAcceso(allow=frozenset({'*'})),
            PoliticaAcceso(allow=frozenset({'*'}), deny=frozenset({PERMISO})),
        ),
        # deny por módulo
        (
            PoliticaAcceso(allow=frozenset({'organizacion.*'})),
            PoliticaAcceso(allow=frozenset({'organizacion.*'}), deny=frozenset({'organizacion.*'})),
        ),
        # sin política alguna (deny implícito)
        (PoliticaAcceso(), None),
    ],
    ids=['deny-individual-sobre-rol', 'deny-sobre-comodin', 'deny-de-modulo', 'sin-permiso'],
)
def test_sin_permiso_el_filtro_de_estructura_da_403(configuracion, rol, usuario):
    permitido = _permite(politica_rol=rol, politica_usuario=usuario)
    assert permitido is False

    with pytest.raises(PermissionDeniedError):
        preparar_consulta_personal(
            {'dependencia_id': '3'},
            configuracion,
            puede_filtrar_estructura=permitido,
            hoy=HOY,
        )


def test_sin_filtros_de_estructura_pasa_aunque_no_tenga_el_permiso(configuracion):
    permitido = _permite()
    assert permitido is False

    consulta = preparar_consulta_personal(
        {'sexo_id': '2'}, configuracion, puede_filtrar_estructura=permitido, hoy=HOY
    )
    assert consulta.lookups == {'sexoid': 2}
