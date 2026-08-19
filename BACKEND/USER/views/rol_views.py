"""
Gestión de roles: alta, actualización y eliminación.

La consulta de roles NO está aquí: ya la resuelve `list_rols`
(GET /api/accounts/roles/), que es la que consume el módulo de Seguridad del
frontend. Este archivo sólo agrega las tres operaciones que faltaban.

Sigue la misma lógica que el sistema usa hoy: el rol es un registro de la tabla
USER_rol y el control de qué puede hacer cada rol vive en el frontend (los
arreglos `roleAccept` de los sidebars). No se agregan validaciones de rol en el
backend.
"""

import logging

from django.db.models import ProtectedError
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from USER.models import cuenta, Rol
from USER.serializers import RolEscrituraSerializer

logger = logging.getLogger(__name__)


AVISO_FRONTEND = (
    "El rol quedó creado. Para que aparezca en el sistema hay que incluirlo en "
    "los arreglos roleAccept de los sidebars del frontend; mientras no esté, no "
    "verá ninguna opción de menú."
)


@extend_schema(
    tags=["Roles"],
    summary="Crear rol",
    description="Da de alta un rol en el catálogo USER_rol. El nombre se "
                "normaliza a mayúsculas y se valida que no exista otro igual. "
                "El acceso a cada opción se define en los sidebars del frontend.",
    request=RolEscrituraSerializer,
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_rol(request):
    try:
        serializer = RolEscrituraSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': "error",
                'message': "Datos inválidos",
                'data': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        rol = serializer.save()

        return Response({
            'status': "success",
            'message': AVISO_FRONTEND,
            'data': RolEscrituraSerializer(rol).data,
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Error al crear rol: {e}")
        return Response({
            'status': "error",
            'message': "No se pudo crear el rol",
            'data': None,
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["Roles"],
    summary="Actualizar rol",
    description="Cambia el nombre o la descripción de un rol. Si se cambia el "
                "nombre hay que actualizar también los roleAccept del frontend, "
                "porque allí los roles se comparan por su texto.",
    request=RolEscrituraSerializer,
)
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def actualizar_rol(request, id):
    try:
        rol = Rol.objects.filter(id=id).first()
        if rol is None:
            return Response({
                'status': "error",
                'message': "El rol no existe",
                'data': None,
            }, status=status.HTTP_404_NOT_FOUND)

        nombre_anterior = rol.nombre_rol
        serializer = RolEscrituraSerializer(rol, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({
                'status': "error",
                'message': "Datos inválidos",
                'data': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        rol = serializer.save()

        mensaje = "Rol actualizado correctamente"
        if rol.nombre_rol != nombre_anterior:
            mensaje = (f"Rol actualizado de '{nombre_anterior}' a '{rol.nombre_rol}'. "
                       f"Recuerde actualizar los arreglos roleAccept del frontend, "
                       f"que comparan el rol por su nombre.")

        return Response({
            'status': "success",
            'message': mensaje,
            'data': RolEscrituraSerializer(rol).data,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error al actualizar rol {id}: {e}")
        return Response({
            'status': "error",
            'message': "No se pudo actualizar el rol",
            'data': None,
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["Roles"],
    summary="Eliminar rol",
    description="Elimina un rol. Se rechaza con 409 si tiene cuentas asociadas, "
                "para no dejar usuarios sin rol.",
)
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def eliminar_rol(request, id):
    try:
        rol = Rol.objects.filter(id=id).first()
        if rol is None:
            return Response({
                'status': "error",
                'message': "El rol no existe",
                'data': None,
            }, status=status.HTTP_404_NOT_FOUND)

        en_uso = cuenta.objects.filter(rol=rol).count()
        if en_uso:
            return Response({
                'status': "error",
                'message': (f"No se puede eliminar: el rol '{rol.nombre_rol}' está "
                            f"asignado a {en_uso} cuenta(s). Reasígnelas primero."),
                'data': {'cuentas_asociadas': en_uso},
            }, status=status.HTTP_409_CONFLICT)

        nombre = rol.nombre_rol
        rol.delete()
        return Response({
            'status': "success",
            'message': f"Rol '{nombre}' eliminado correctamente",
            'data': None,
        }, status=status.HTTP_200_OK)

    except ProtectedError:
        return Response({
            'status': "error",
            'message': "El rol está referenciado por otros registros y no se puede eliminar",
            'data': None,
        }, status=status.HTTP_409_CONFLICT)
    except Exception as e:
        logger.error(f"Error al eliminar rol {id}: {e}")
        return Response({
            'status': "error",
            'message': "No se pudo eliminar el rol",
            'data': None,
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
