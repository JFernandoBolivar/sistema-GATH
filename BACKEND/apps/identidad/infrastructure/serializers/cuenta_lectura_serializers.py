"""
Serializers de lectura de cuentas (gestión de usuarios).

Solo transforman salida hacia el sobre C-1; ninguna regla de negocio (B8).
Serializan la entidad de dominio `Cuenta` (no el modelo ORM, B6): por eso son
`serializers.Serializer` planos, no `ModelSerializer` (ver patrones-drf).

Nota de alcance documentada: a diferencia de `USER_serializers.CuentaSerializer`
(legado), este serializer expone `departamento_id`/`rol_id` como identificadores
planos, sin anidar el objeto completo ni los campos de asignación organizacional
(`direccion_general`, `direccion_linea`, `coordinacion`, `dependencia`): esos
datos viven en `AsigTrabajo` (RAC) y su espejo aún no existe en
`apps.organizacion`/`apps.cargos` (mismo hallazgo que R-01, Fase B4.5). El
frontend puede resolver los nombres con los catálogos `/departamentos/` y
`/roles/` de este mismo módulo.
"""
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class CuentaLecturaSerializer(serializers.Serializer):
    """Representación de una `Cuenta` de dominio para lectura."""

    id = serializers.IntegerField()
    cedula = serializers.CharField()
    nombres = serializers.CharField()
    apellidos = serializers.CharField()
    correo = serializers.EmailField(allow_null=True)
    telefono = serializers.CharField(allow_null=True)
    departamento_id = serializers.IntegerField(allow_null=True)
    rol_id = serializers.IntegerField(allow_null=True)
    is_active = serializers.BooleanField()
    debe_cambiar_password = serializers.SerializerMethodField()

    @extend_schema_field(serializers.BooleanField(allow_null=True))
    def get_debe_cambiar_password(self, obj):
        """True si la contraseña actual es igual a la cédula (alta por defecto).

        Requiere `context['repo']` (un `RepoCuentas`); sin él devuelve `None`
        en vez de fallar, para que este serializer siga siendo usable en
        contextos que no necesiten este campo (p. ej. la respuesta de login).
        """
        repo = self.context.get('repo')
        if repo is None:
            return None
        return repo.verificar_password(obj.id, obj.cedula)
