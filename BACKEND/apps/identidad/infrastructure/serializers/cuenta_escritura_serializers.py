"""
Serializers de escritura de cuentas (gestión de usuarios).

Solo validan estructura de entrada; las reglas de negocio (unicidad,
existencia, verificación de contraseña actual, reglas de autogestión
administrativa) viven en el dominio y en `application/use_cases/` (B8).

D3: el departamento dejó de ser parte del contrato de identidad.
"""
from rest_framework import serializers


class RegistrarCuentaSerializer(serializers.Serializer):
    """Alta de cuenta (CRIT-05: protegida en la vista con permiso admin)."""

    cedula = serializers.CharField(max_length=20, trim_whitespace=True)
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    rol_id = serializers.IntegerField(required=False, allow_null=True)


class ActualizarCuentaSerializer(serializers.Serializer):
    """Edición de rol de una cuenta existente (D4/M2: la contraseña NO se cambia aquí)."""

    rol_id = serializers.IntegerField(required=False, allow_null=True)
    motivo = serializers.CharField(required=False, allow_blank=False, max_length=500)

    def validate(self, attrs):
        if 'password' in self.initial_data:
            raise serializers.ValidationError(
                {'password': 'La contraseña no se cambia por este endpoint. Use «Restablecer acceso» '
                             'o el cambio de contraseña propio.'}
            )
        return attrs


class CambiarEstadoCuentaSerializer(serializers.Serializer):
    """Activación/desactivación. `is_active` y `motivo` son obligatorios en D4."""

    is_active = serializers.BooleanField()
    motivo = serializers.CharField(max_length=500)


class CambiarPasswordSerializer(serializers.Serializer):
    """Cambio de contraseña propia (CRIT-04: exige la contraseña actual)."""

    password_actual = serializers.CharField(required=False, write_only=True, max_length=128)
    current_password = serializers.CharField(required=False, write_only=True, max_length=128)
    password_nuevo = serializers.CharField(
        required=False, write_only=True, min_length=8, max_length=128
    )
    new_password = serializers.CharField(
        required=False, write_only=True, min_length=8, max_length=128
    )
    password = serializers.CharField(
        required=False, write_only=True, min_length=8, max_length=128
    )

    def validate(self, attrs):
        current = attrs.get('password_actual') or attrs.get('current_password')
        new = attrs.get('password_nuevo') or attrs.get('new_password') or attrs.get('password')
        if not current:
            raise serializers.ValidationError({'password_actual': 'La contraseña actual es requerida.'})
        if not new:
            raise serializers.ValidationError({'password_nuevo': 'La nueva contraseña es requerida.'})
        return {'password_actual': current, 'password_nuevo': new}


class CambiarCorreoAccesoSerializer(serializers.Serializer):
    """Elección del correo de acceso: el institucional actual, el alternativo del trabajador u otro."""

    fuente = serializers.ChoiceField(choices=['INSTITUCIONAL', 'ALTERNATIVO', 'OTRO'])
    correo = serializers.EmailField(required=False, allow_blank=True, max_length=254)
    motivo = serializers.CharField(max_length=500)

    def validate_motivo(self, valor):
        if len((valor or '').strip()) < 10:
            raise serializers.ValidationError('El motivo es obligatorio y debe tener al menos 10 caracteres.')
        return valor.strip()

    def validate(self, attrs):
        if attrs['fuente'] == 'OTRO' and not attrs.get('correo'):
            raise serializers.ValidationError({'correo': 'Indique el correo cuando la fuente es OTRO.'})
        return attrs


class RestablecerAccesoSerializer(serializers.Serializer):
    """«Restablecer acceso» exige motivo para la auditoría (A1)."""

    motivo = serializers.CharField(max_length=500)

    def validate_motivo(self, valor):
        if len((valor or '').strip()) < 10:
            raise serializers.ValidationError('El motivo es obligatorio y debe tener al menos 10 caracteres.')
        return valor.strip()
