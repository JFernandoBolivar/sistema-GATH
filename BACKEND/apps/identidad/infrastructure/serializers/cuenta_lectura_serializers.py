"""
Serializers de lectura de cuentas (gestión de usuarios).

Solo transforman salida hacia el sobre C-1; ninguna regla de negocio (B8).
Serializan la entidad de dominio `Cuenta` (no el modelo ORM, B6): por eso son
`serializers.Serializer` planos, no `ModelSerializer` (ver patrones-drf).

D3: `departamento_id` ya no se expone. La autorización se explica por rol y
permisos efectivos, no por la unidad organizativa.
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
    correo_alternativo = serializers.CharField(allow_null=True, required=False)
    telefono = serializers.CharField(allow_null=True)
    rol_id = serializers.IntegerField(allow_null=True)
    rol_nombre = serializers.CharField(allow_null=True)
    rol_nombre_visible = serializers.CharField(allow_null=True, required=False)
    is_active = serializers.BooleanField()
    ultimo_acceso = serializers.DateTimeField(allow_null=True)
    condicion = serializers.CharField(allow_null=True)
    password_inicial_pendiente = serializers.BooleanField()
    debe_cambiar_password = serializers.SerializerMethodField()

    @extend_schema_field(serializers.BooleanField(allow_null=True))
    def get_debe_cambiar_password(self, obj):
        """True si la contraseña actual es igual a la cédula (alta por defecto).

        Si la entidad ya trae el valor calculado (perfil de sesión, sin consulta
        extra) se usa ese; si no, requiere `context['repo']`; en último término
        usa la marca ya calculada por el listado/DTO y `None` para seguir siendo
        usable en contextos que no necesiten este campo.
        """
        calculado = getattr(obj, 'debe_cambiar_password', None)
        if calculado is not None:
            return calculado
        repo = self.context.get('repo')
        if repo is not None:
            return repo.verificar_password(obj.id, obj.cedula)
        if isinstance(obj, dict):
            return obj.get('password_inicial_pendiente')
        return getattr(obj, 'password_inicial_pendiente', None)


class PermisosDeUsuarioSerializer(serializers.Serializer):
    """Permisos del rol, overrides y permiso efectivo calculado en servidor (D4)."""

    rol_id = serializers.IntegerField(allow_null=True)
    rol_nombre = serializers.CharField(allow_null=True)
    rol_nombre_visible = serializers.CharField(allow_null=True, required=False)
    del_rol = serializers.ListField(child=serializers.CharField())
    allow = serializers.ListField(child=serializers.CharField())
    deny = serializers.ListField(child=serializers.CharField())
    efectivos = serializers.ListField(child=serializers.CharField())
    version = serializers.IntegerField()


class UsuarioDetalleSerializer(CuentaLecturaSerializer):
    """Detalle de una cuenta con su permiso efectivo ya resuelto por el motor IAM."""

    permisos = PermisosDeUsuarioSerializer()
