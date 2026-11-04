"""
Serializers de la administración de usuarios y de la matriz de permisos (D4).

Solo validan estructura y longitudes; las reglas de negocio viven en el
dominio y en los casos de uso (B8).
"""
from rest_framework import serializers

from apps.identidad.infrastructure.serializers.cuenta_lectura_serializers import (
    UsuarioDetalleSerializer,
)

MOTIVO_MINIMO = 10


def _validar_motivo(valor: str) -> str:
    limpio = (valor or '').strip()
    if len(limpio) < MOTIVO_MINIMO:
        raise serializers.ValidationError(
            f'El motivo es obligatorio y debe tener al menos {MOTIVO_MINIMO} caracteres.'
        )
    return limpio


class GuardarOverridesSerializer(serializers.Serializer):
    """Reemplazo completo de los overrides individuales allow/deny de una cuenta."""

    allow = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False, max_length=500
    )
    deny = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False, max_length=500
    )
    motivo = serializers.CharField(max_length=500)

    def validate_motivo(self, valor):
        return _validar_motivo(valor)

    def validate(self, attrs):
        attrs['allow'] = attrs.get('allow') or []
        attrs['deny'] = attrs.get('deny') or []
        return attrs


class GuardarMatrizSerializer(serializers.Serializer):
    """Conjunto completo de permisos de un rol, con confirmación y motivo."""

    permisos = serializers.ListField(
        child=serializers.CharField(max_length=100), max_length=500
    )
    motivo = serializers.CharField(max_length=500)
    confirmar = serializers.BooleanField()

    def validate_motivo(self, valor):
        return _validar_motivo(valor)

    def validate_confirmar(self, valor):
        if not valor:
            raise serializers.ValidationError(
                'Debe confirmar el cambio de la matriz de permisos.'
            )
        return valor


class FilaMatrizSerializer(serializers.Serializer):
    codigo = serializers.CharField()
    nombre = serializers.CharField()
    modulo = serializers.CharField()


class ColumnaRolSerializer(serializers.Serializer):
    rol_id = serializers.IntegerField()
    nombre = serializers.CharField()
    codigos = serializers.ListField(child=serializers.CharField())


class MatrizPermisosSerializer(serializers.Serializer):
    filas = FilaMatrizSerializer(many=True)
    roles = ColumnaRolSerializer(many=True)


__all__ = [
    'GuardarMatrizSerializer',
    'GuardarOverridesSerializer',
    'MatrizPermisosSerializer',
    'UsuarioDetalleSerializer',
]
