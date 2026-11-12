"""Permiso `EsSuperadministrador`: cédula exacta y fallo cerrado sin configuración."""
from types import SimpleNamespace

from apps.identidad.presentation.permissions.identidad_permissions import (
    EsSuperadministrador,
)


def _request(cedula: str | None, autenticado: bool = True):
    user = SimpleNamespace(
        is_authenticated=autenticado,
        cedula_id=cedula,
        cedula=None,
    )
    return SimpleNamespace(user=user)


def test_acepta_la_cedula_configurada(settings):
    settings.SUPERADMIN_CEDULA = '12345678'
    assert EsSuperadministrador().has_permission(_request('12345678'), None) is True


def test_rechaza_otra_cedula(settings):
    settings.SUPERADMIN_CEDULA = '12345678'
    assert EsSuperadministrador().has_permission(_request('87654321'), None) is False


def test_sin_cedula_en_la_sesion_rechaza(settings):
    settings.SUPERADMIN_CEDULA = '12345678'
    assert EsSuperadministrador().has_permission(_request(None), None) is False


def test_sin_superadmin_configurado_falla_cerrado(settings):
    settings.SUPERADMIN_CEDULA = ''
    assert EsSuperadministrador().has_permission(_request('30799436'), None) is False


def test_anonimo_rechaza(settings):
    settings.SUPERADMIN_CEDULA = '12345678'
    assert EsSuperadministrador().has_permission(_request('12345678', autenticado=False), None) is False
