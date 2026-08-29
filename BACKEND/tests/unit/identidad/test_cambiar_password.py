"""
Tests de `cambiar_password` (cierra CRIT-04) con repositorio en memoria.

El validador de fortaleza se inyecta como no-op para no depender de
`django.contrib.auth.password_validation` (mantiene el test sin Django real).
"""
import pytest

from apps.identidad.application.dtos.cuenta_dto import CambiarPasswordDTO
from apps.identidad.application.use_cases.cambiar_password import cambiar_password
from core.domain.exceptions import ValidationError

_SIN_VALIDACION = lambda password: None  # noqa: E731


def test_cambia_la_password_con_la_actual_correcta(repo_cuentas):
    dto = CambiarPasswordDTO(actor_id=1, password_actual='clave-actual', password_nuevo='clave-nueva')

    cambiar_password(repo_cuentas, dto, validar_fortaleza=_SIN_VALIDACION)

    assert repo_cuentas.verificar_password(1, 'clave-nueva')


def test_rechaza_password_actual_incorrecta(repo_cuentas):
    dto = CambiarPasswordDTO(actor_id=1, password_actual='incorrecta', password_nuevo='clave-nueva')

    with pytest.raises(ValidationError):
        cambiar_password(repo_cuentas, dto, validar_fortaleza=_SIN_VALIDACION)

    # La contraseña original sigue vigente: no hubo cambio parcial.
    assert repo_cuentas.verificar_password(1, 'clave-actual')


def test_rechaza_nueva_password_igual_a_la_actual(repo_cuentas):
    dto = CambiarPasswordDTO(actor_id=1, password_actual='clave-actual', password_nuevo='clave-actual')

    with pytest.raises(ValidationError):
        cambiar_password(repo_cuentas, dto, validar_fortaleza=_SIN_VALIDACION)


def test_aplica_el_validador_de_fortaleza_inyectado(repo_cuentas):
    def _rechaza_todo(password):
        raise ValidationError('Contraseña débil.')

    dto = CambiarPasswordDTO(actor_id=1, password_actual='clave-actual', password_nuevo='123')

    with pytest.raises(ValidationError):
        cambiar_password(repo_cuentas, dto, validar_fortaleza=_rechaza_todo)
