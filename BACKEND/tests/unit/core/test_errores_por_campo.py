"""El handler conserva los errores por campo para marcarlos en el formulario."""
from rest_framework import serializers
from rest_framework.exceptions import ValidationError as DRFValidationError

from core.domain.exceptions import ValidationError
from core.presentation.exception_handler import aplanar_errores, custom_exception_handler


def test_aplanar_errores_anidados():
    detalle = {'cedula': ['Requerido.'], 'contactos': [{}, {'telefono': ['Inválido.']}], 'non_field_errors': ['X']}
    assert aplanar_errores(detalle) == {
        'cedula': ['Requerido.'], 'contactos.1.telefono': ['Inválido.'], 'non_field_errors': ['X'],
    }


def test_validacion_drf_devuelve_errores_por_campo():
    class S(serializers.Serializer):
        cedula = serializers.CharField(max_length=3)
        nombres = serializers.CharField()

    s = S(data={'cedula': '123456'})
    try:
        s.is_valid(raise_exception=True)
    except DRFValidationError as exc:
        resp = custom_exception_handler(exc, {})
    assert resp.status_code == 400
    assert set(resp.data['data']['errores']) == {'cedula', 'nombres'}
    assert 'campos marcados en rojo' in resp.data['message']


def test_un_solo_error_usa_su_mensaje():
    exc = DRFValidationError({'cedula': ['La cédula ya está registrada.']})
    resp = custom_exception_handler(exc, {})
    assert resp.data['message'] == 'La cédula ya está registrada.'


def test_error_de_dominio_con_campo():
    resp = custom_exception_handler(ValidationError('Correo duplicado.', campo='correo'), {})
    assert resp.status_code == 400
    assert resp.data['data'] == {'errores': {'correo': ['Correo duplicado.']}}


def test_error_de_dominio_sin_campo_no_cambia():
    resp = custom_exception_handler(ValidationError('Regla.'), {})
    assert resp.data['message'] == 'Regla.' and resp.data['data'] is None
