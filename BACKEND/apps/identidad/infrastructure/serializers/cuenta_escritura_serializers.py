"""
Serializers de escritura de cuentas (gestión de usuarios).

Solo validan estructura de entrada; las reglas de negocio (unicidad,
existencia, verificación de contraseña actual) viven en
`application/use_cases/` (B8).
"""
from rest_framework import serializers


class RegistrarCuentaSerializer(serializers.Serializer):
    """Alta de cuenta (CRIT-05: protegida en la vista con permiso admin)."""

    cedula = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, min_length=1)
    departamento_id = serializers.IntegerField(required=False, allow_null=True)
    rol_id = serializers.IntegerField(required=False, allow_null=True)


class ActualizarCuentaSerializer(serializers.Serializer):
    """Edición parcial de departamento/rol/contraseña de una cuenta existente."""

    departamento_id = serializers.IntegerField(required=False, allow_null=True)
    rol_id = serializers.IntegerField(required=False, allow_null=True)
    password = serializers.CharField(required=False, allow_null=True, write_only=True)


class CambiarEstadoCuentaSerializer(serializers.Serializer):
    """Activación/desactivación. `is_active` ausente alterna el estado actual."""

    is_active = serializers.BooleanField(required=False)


class CambiarPasswordSerializer(serializers.Serializer):
    """Cambio de contraseña propia (CRIT-04: exige la contraseña actual)."""

    password_actual = serializers.CharField(required=False, write_only=True)
    current_password = serializers.CharField(required=False, write_only=True)
    password_nuevo = serializers.CharField(required=False, write_only=True)
    new_password = serializers.CharField(required=False, write_only=True)
    password = serializers.CharField(required=False, write_only=True)

    def validate(self, attrs):
        current = attrs.get('password_actual') or attrs.get('current_password')
        new = attrs.get('password_nuevo') or attrs.get('new_password') or attrs.get('password')
        if not current:
            raise serializers.ValidationError({'password_actual': 'La contraseña actual es requerida.'})
        if not new:
            raise serializers.ValidationError({'password_nuevo': 'La nueva contraseña es requerida.'})
        return {'password_actual': current, 'password_nuevo': new}

