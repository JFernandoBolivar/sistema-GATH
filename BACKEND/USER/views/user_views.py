"""
User authentication and management views.

Endpoints:
- login_view: Authenticate and issue JWT tokens (HttpOnly cookies + response body)
- logout_view: Blacklist refresh token and clear cookies
- refresh_view: Rotate access token using refresh token
- me_view: Get authenticated user's profile data
- register_view: Create a new user account
- editar_usuario: Update user details
- cambiar_estado_usuario: Toggle user active status
- usuarios_lista: List users with filters
- list_departaments: List departments
- list_rols: List roles
"""

import logging

from rest_framework.exceptions import ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.exceptions import TokenError

from RAC.filters.filters_personal import CuentaFilter
from drf_spectacular.utils import extend_schema

from USER.models import cuenta, departaments, Rol
from USER.serializers import (
    LoginSerializer,
    RegisterSerializer,
    CuentaSerializer,
    UpdateCuentaSerializer,
    CambiarEstadoCuentaSerializer,
    DepartamentoSerializer,
    RolSerializer,
)
from USER.services.token_service import TokenService

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# AUTHENTICATION ENDPOINTS
# ─────────────────────────────────────────────

@extend_schema(
    tags=["Autenticación"],
    summary="Inicio de sesión",
    description="Autentica al usuario y devuelve tokens JWT en cookies HttpOnly.",
    request=LoginSerializer,
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Authenticate user credentials and issue JWT tokens.
    
    Tokens are set as HttpOnly cookies AND returned in the response body
    (for NextJS server actions that use Authorization header).
    """
    serializer = LoginSerializer(data=request.data)
    try:
        serializer.is_valid(raise_exception=True)
        usuario = serializer.validated_data

        # Generate JWT tokens for the authenticated user
        tokens = TokenService.generate_tokens_for_user(usuario)
        datos_usuario = CuentaSerializer(usuario).data

        response = Response({
            'status': "success",
            'message': "Inicio de sesión exitoso",
            'data': datos_usuario,
            'tokens': {
                'access': tokens['access'],
                'refresh': tokens['refresh'],
            },
        }, status=status.HTTP_200_OK)

        # Set HttpOnly cookies
        TokenService.set_token_cookies(response, tokens)

        return response

    except ValidationError:
        error_dict = serializer.errors
        first_error_field = list(error_dict.values())[0]
        clean_message = first_error_field[0] if isinstance(first_error_field, list) else first_error_field

        return Response({
            'status': "error",
            'message': clean_message,
            'data': None
        }, status=status.HTTP_401_UNAUTHORIZED)

    except Exception as e:
        logger.error(f"Error en login: {str(e)}")
        return Response({
            'status': "error",
            'message': "Error interno del servidor",
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["Autenticación"],
    summary="Cerrar sesión",
    description="Blacklistea el refresh token y limpia las cookies de autenticación.",
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout: blacklist the refresh token and clear auth cookies.
    """
    try:
        from django.conf import settings
        refresh_token = request.COOKIES.get(
            settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')
        )

        if refresh_token:
            TokenService.blacklist_refresh_token(refresh_token)

        response = Response({
            'status': "success",
            'message': "Sesión cerrada exitosamente",
        }, status=status.HTTP_200_OK)

        TokenService.clear_token_cookies(response)
        return response

    except Exception as e:
        logger.error(f"Error en logout: {str(e)}")
        # Clear cookies even if blacklisting fails
        response = Response({
            'status': "success",
            'message': "Sesión cerrada",
        }, status=status.HTTP_200_OK)
        TokenService.clear_token_cookies(response)
        return response


@extend_schema(
    tags=["Autenticación"],
    summary="Refrescar token",
    description="Genera un nuevo access token usando el refresh token.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_view(request):
    """
    Refresh access token using the refresh token from cookie or request body.
    Rotates refresh token if configured.
    """
    from django.conf import settings

    # Try to get refresh token from cookie first, then from body
    refresh_token = request.COOKIES.get(
        settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')
    )
    if not refresh_token:
        refresh_token = request.data.get('refresh')

    if not refresh_token:
        return Response({
            'status': "error",
            'message': "No se proporcionó un token de refresco",
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        new_tokens = TokenService.refresh_access_token(refresh_token)

        response = Response({
            'status': "success",
            'message': "Token refrescado exitosamente",
            'tokens': new_tokens,
        }, status=status.HTTP_200_OK)

        TokenService.set_token_cookies(response, new_tokens)
        return response

    except TokenError:
        response = Response({
            'status': "error",
            'message': "El token de refresco es inválido o ha expirado",
        }, status=status.HTTP_401_UNAUTHORIZED)
        TokenService.clear_token_cookies(response)
        return response


@extend_schema(
    tags=["Autenticación"],
    summary="Obtener perfil del usuario autenticado",
    description="Devuelve los datos del usuario autenticado desde el JWT.",
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """
    Return the authenticated user's profile data.
    The user is resolved from the JWT token by the authentication class.
    """
    try:
        usuario = request.user
        datos_usuario = CuentaSerializer(usuario).data

        return Response({
            'status': "success",
            'message': "Datos del usuario obtenidos correctamente",
            'data': datos_usuario,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error en me_view: {str(e)}")
        return Response({
            'status': "error",
            'message': "Error al obtener datos del usuario",
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────
# USER MANAGEMENT ENDPOINTS
# ─────────────────────────────────────────────

@extend_schema(
    tags=["Gestion de Usuarios"],
    summary="Registro de Usuario",
    request=RegisterSerializer,
)
@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    try:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        nueva_cuenta = serializer.save()

        return Response({
            'status': "success",
            'message': 'Usuario registrado exitosamente',
            'data': CuentaSerializer(nueva_cuenta).data
        }, status=status.HTTP_201_CREATED)

    except ValidationError:
        error_dict = serializer.errors
        first_error_field = list(error_dict.values())[0]
        clean_message = first_error_field[0] if isinstance(first_error_field, list) else first_error_field

        return Response({
            'status': "error",
            'message': clean_message,

        }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:

        return Response({
            'status': "error",
            'message': 'Error interno del servidor al procesar el registro.',

        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["Gestion de Usuarios"],
    summary="Editar Usuario",
    request=UpdateCuentaSerializer,
)
@api_view(['PATCH', 'PUT'])
def editar_usuario(request, id):
    try:
        usuario = cuenta.objects.get(id=id)
    except cuenta.DoesNotExist:
        return Response({
            'status': "error",
            'message': 'El usuario no existe.',
            'data': None
        }, status=status.HTTP_404_NOT_FOUND)

    serializer = UpdateCuentaSerializer(usuario, data=request.data, partial=True)

    try:
        serializer.is_valid(raise_exception=True)
        usuario_actualizado = serializer.save()

        return Response({
            'status': "success",
            'message': 'Usuario actualizado exitosamente.',
            'data': CuentaSerializer(usuario_actualizado).data
        }, status=status.HTTP_200_OK)

    except ValidationError:
        error_dict = serializer.errors
        first_error_field = list(error_dict.values())[0]
        clean_message = first_error_field[0] if isinstance(first_error_field, list) else first_error_field

        return Response({
            'status': "error",
            'message': clean_message,
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        return Response({
            'status': "error",
            'message': f"Ocurrió un error inesperado: {str(e)}",
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["Gestion de Usuarios"],
    summary="Editar estatus de Usuario",
    request=CambiarEstadoCuentaSerializer,
)
@api_view(['PATCH'])
def cambiar_estado_usuario(request, id):
    try:
        usuario = cuenta.objects.get(id=id)
        serializer = CambiarEstadoCuentaSerializer(usuario, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        usuario_actualizado = serializer.save()
        estado_str = "activado" if usuario_actualizado.is_active else "suspendido"

        return Response({
            'status': 'success',
            'message': f'Usuario {estado_str} exitosamente.',
            'data': CuentaSerializer(usuario_actualizado).data
        }, status=status.HTTP_200_OK)

    except cuenta.DoesNotExist:
        return Response({
            'status': "error",
            'message': 'El usuario no existe.',
            'data': None
        }, status=status.HTTP_404_NOT_FOUND)

    except ValidationError:
        error_dict = serializer.errors
        first_error_value = list(error_dict.values())[0]
        clean_message = first_error_value[0] if isinstance(first_error_value, list) else first_error_value
        return Response({
            'status': "error",
            'message': clean_message,
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Error al cambiar estado: {str(e)}")
        return Response({
            'status': "error",
            'message': "Error interno del servidor",
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["Gestion de Usuarios"],
    summary="Consulta de usuarios",
)
@api_view(['GET'])
def usuarios_lista(request):
    try:
        queryset = cuenta.objects.select_related('cedula', 'departamento', 'rol').all()

        filterset = CuentaFilter(request.GET, queryset=queryset)

        if not filterset.is_valid():
            return Response({
                'status': "error",
                'message': "Los parámetros de filtro son inválidos.",
                'data': filterset.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        usuarios = filterset.qs[:10]

        serializer = CuentaSerializer(usuarios, many=True)

        return Response({
            'status': 'success',
            'message': 'Lista de usuarios obtenida correctamente',
            'data': serializer.data,

        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error al listar usuarios: {str(e)}")
        return Response({
            'status': "error",
            'message': f"Error al listar: {str(e)}",
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["Gestion de Usuarios"],
    summary="Listar Departamentos",
    description="Devuelve una lista de todas las Depepartamentos disponibles.",
)
@api_view(['GET'])
@permission_classes([AllowAny])
def list_departaments(request):
    try:
        queryset = departaments.objects.all()
        serializer = DepartamentoSerializer(queryset, many=True)

        return Response({
            'status': "success",
            'message': "Departamentos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de Departamentos",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Gestion de Usuarios"],
    summary="Listar Roles",
    description="Devuelve una lista de todas los roles disponibles",
    responses=RolSerializer
)
@api_view(['GET'])
@permission_classes([AllowAny])
def list_rols(request):
    try:
        queryset = Rol.objects.all()
        serializer = RolSerializer(queryset, many=True)

        return Response({
            'status': "success",
            'message': "roles listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de roles",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Autenticación"],
    summary="Cambiar contraseña de primera vez",
    description="Permite a un usuario cambiar su contraseña temporal por primera vez especificando su id y la nueva contraseña.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
def cambiar_password_primera_vez(request):
    user_id = request.data.get('id')
    new_password = request.data.get('password')

    if not user_id or not new_password:
        return Response({
            'status': 'error',
            'message': 'El id de usuario y la nueva contraseña son requeridos.'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        usuario = cuenta.objects.get(id=user_id)
    except cuenta.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Usuario no encontrado.'
        }, status=status.HTTP_404_NOT_FOUND)

    # Establecer la nueva contraseña
    usuario.set_password(new_password)
    usuario.save()

    return Response({
        'status': 'success',
        'message': 'Contraseña actualizada exitosamente.'
    }, status=status.HTTP_200_OK)