"""
Tests unitarios del motor de evaluación de políticas IAM / PBAC (AWS style).
Verifica:
1. Concesión directa por código exacto.
2. Prioridad absoluta de Deny sobre Allow.
3. Comodines globales ('*') y por módulo ('modulo.*').
4. Elevación de privilegios de usuario (Analista con permiso extra de Admin sin cambiar rol).
5. Segregación de funciones por Deny en usuario.
6. Fail-closed S2 ante códigos inexistentes o vacíos.
"""
import pytest

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.resolver_permisos import (
    resolver_politica_actor,
    tiene_permiso,
)
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.services.evaluador_permisos import (
    evaluar_permiso,
    patrones_candidatos,
)
from tests.unit.identidad.conftest import RepoPermisosMemoria


def test_patrones_candidatos_calculo():
    assert patrones_candidatos("personal.crear") == {
        "*",
        "personal.*",
        "personal.crear",
    }
    assert patrones_candidatos("super_admin") == {"*", "super_admin"}


def test_evaluacion_concesion_exacta():
    politica = PoliticaAcceso(
        allow=frozenset(["personal.crear", "cargos.ver"]),
        deny=frozenset(),
    )
    assert evaluar_permiso(politica, "personal.crear") is True
    assert evaluar_permiso(politica, "cargos.ver") is True
    assert evaluar_permiso(politica, "personal.editar") is False


def test_evaluacion_wildcard_modulo():
    politica = PoliticaAcceso(
        allow=frozenset(["personal.*"]),
        deny=frozenset(),
    )
    assert evaluar_permiso(politica, "personal.crear") is True
    assert evaluar_permiso(politica, "personal.editar") is True
    assert evaluar_permiso(politica, "personal.ver_salud") is True
    assert evaluar_permiso(politica, "cargos.ver") is False


def test_evaluacion_wildcard_global():
    politica = PoliticaAcceso(
        allow=frozenset(["*"]),
        deny=frozenset(),
    )
    assert evaluar_permiso(politica, "personal.crear") is True
    assert evaluar_permiso(politica, "identidad.eliminar_roles") is True
    assert evaluar_permiso(politica, "cualquier.accion_futura") is True


def test_evaluacion_deny_gana_a_allow_global():
    politica = PoliticaAcceso(
        allow=frozenset(["*"]),
        deny=frozenset(["identidad.eliminar_roles"]),
    )
    assert evaluar_permiso(politica, "personal.crear") is True
    assert evaluar_permiso(politica, "identidad.crear_usuarios") is True
    # Deny explícito bloquea la acción
    assert evaluar_permiso(politica, "identidad.eliminar_roles") is False


def test_evaluacion_deny_puntual_sobre_wildcard_modulo():
    politica = PoliticaAcceso(
        allow=frozenset(["personal.*"]),
        deny=frozenset(["personal.ver_salud"]),
    )
    assert evaluar_permiso(politica, "personal.crear") is True
    assert evaluar_permiso(politica, "personal.editar") is True
    # Deny explícito sobre salud
    assert evaluar_permiso(politica, "personal.ver_salud") is False


def test_evaluacion_fail_closed_por_defecto():
    politica = PoliticaAcceso(allow=frozenset(), deny=frozenset())
    assert evaluar_permiso(politica, "personal.crear") is False
    assert evaluar_permiso(politica, "") is False


def test_analista_recibe_permiso_admin_por_override_sin_cambiar_rol():
    """
    Caso de uso: Analista (rol 2) tiene permisos de personal.*.
    Se le asigna por solicitud 'identidad.crear_usuarios' vía override de usuario.
    """
    repo = RepoPermisosMemoria(
        matriz={2: {"personal.ver", "personal.crear", "cargos.ver"}},
        rol_por_cedula={"V-20111222": 2},
        nombres_rol={2: "ANALISTA"},
    )

    actor = ActorSesionDTO(rol_id=2, cedula="V-20111222")

    # Inicialmente no tiene permiso de crear usuarios de identidad
    assert tiene_permiso(repo, actor, "personal.ver") is True
    assert tiene_permiso(repo, actor, "identidad.crear_usuarios") is False

    # Se le otorga el permiso de admin directamente a su cédula
    repo.guardar_override_usuario(
        cedula="V-20111222",
        custom_allow=["identidad.crear_usuarios"],
        custom_deny=[],
    )

    # Ahora tiene acceso al permiso de admin manteniendo su rol de analista
    assert tiene_permiso(repo, actor, "personal.ver") is True
    assert tiene_permiso(repo, actor, "identidad.crear_usuarios") is True
    # Pero sigue sin tener otros permisos de admin no otorgados
    assert tiene_permiso(repo, actor, "identidad.eliminar_roles") is False


def test_usuario_con_deny_directo_bloquea_permiso_de_su_rol():
    """
    Caso de uso: Administrador (rol 1) tiene '*'.
    Se le restringe puntualmente 'personal.salud_eliminar' vía Deny en su usuario.
    """
    repo = RepoPermisosMemoria(
        matriz={1: {"*"}},
        rol_por_cedula={"V-99999999": 1},
        nombres_rol={1: "ADMINISTRADOR"},
    )

    actor = ActorSesionDTO(rol_id=1, cedula="V-99999999")

    # Inicialmente tiene todo
    assert tiene_permiso(repo, actor, "personal.salud_eliminar") is True

    # Se le aplica Deny directo
    usuario_actualizado = repo.guardar_override_usuario(
        cedula="V-99999999",
        custom_allow=[],
        custom_deny=["personal.salud_eliminar"],
    )

    assert usuario_actualizado.version == 2
    assert tiene_permiso(repo, actor, "personal.crear") is True
    # Bloqueado por Deny
    assert tiene_permiso(repo, actor, "personal.salud_eliminar") is False
