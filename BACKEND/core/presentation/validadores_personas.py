"""Adaptador DRF de las reglas puras de `core.domain.validacion_personas`."""
from rest_framework import serializers

from core.domain.validacion_personas import validar_cedula, validar_nombre, validar_telefono

__all__ = ['validar_drf', 'validar_cedula', 'validar_nombre', 'validar_telefono']


def validar_drf(regla, value, **kwargs):
    """Ejecuta la regla y convierte su `ValueError` en `serializers.ValidationError`."""
    try:
        return regla(value, **kwargs)
    except ValueError as exc:
        raise serializers.ValidationError(str(exc)) from None
