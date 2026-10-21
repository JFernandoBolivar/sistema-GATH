"""
Serializers de documentación (drf-spectacular, B1.14/B25) para `auth_views.py`.

`LoginView`/`RefreshView` validan su entrada a mano (credenciales por correo
o cédula, con bloqueo progresivo) en vez de con un `serializer.is_valid()`
formal, así que estos serializers solo describen el cuerpo esperado para el
esquema OpenAPI — no participan en la validación real, que sigue igual que
antes de esta tarea.
"""
from rest_framework import serializers


class LoginDocSerializer(serializers.Serializer):
    """Documenta el cuerpo de `POST /auth/login/` (usuario/correo/cédula + password)."""

    usuario = serializers.CharField(required=False)
    correo = serializers.EmailField(required=False)
    cedula = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True)


class RefreshDocSerializer(serializers.Serializer):
    """Documenta el cuerpo de `POST /auth/refresh/` (el refresh también puede venir por cookie)."""

    refresh = serializers.CharField(required=False)
