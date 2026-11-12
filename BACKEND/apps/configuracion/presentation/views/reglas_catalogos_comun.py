"""Constantes, permisos y helpers compartidos por las vistas de reglas de catÃ¡logos."""
import uuid
from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.configuracion.application.use_cases.gestionar_reglas_catalogos import (
    actualizar_checklist_soporte,
    actualizar_motivo,
    buscar_paises_paginado,
    cambiar_categoria_motivo,
    crear_nomina,
    crear_nuevo_motivo,
    crear_pais,
    crear_parentesco,
    crear_tipo_soporte,
    editar_nomina,
    editar_pais,
    editar_parentesco,
    editar_tipo_soporte,
    eliminar_motivo,
    eliminar_nomina,
    eliminar_pais,
    eliminar_parentesco,
    eliminar_tipo_soporte,
    obtener_todas_las_reglas,
    reordenar_tipos_soporte,
)
from apps.configuracion.domain.reglas_catalogos import (
    ACCION_CHECKLIST_SOPORTE_ACTUALIZADO,
    ACCION_MOTIVO_ACTUALIZADO,
    ACCION_MOTIVO_CATEGORIA_CAMBIADA,
    ACCION_MOTIVO_CREADO,
    ACCION_MOTIVO_ELIMINADO,
    ACCION_NOMINA_ACTUALIZADA,
    ACCION_NOMINA_CREADA,
    ACCION_NOMINA_ELIMINADA,
    ACCION_PARENTESCO_ACTUALIZADO,
    ACCION_PARENTESCO_CREADO,
    ACCION_PARENTESCO_ELIMINADO,
    ACCION_PAIS_ACTUALIZADO,
    ACCION_PAIS_CREADO,
    ACCION_PAIS_ELIMINADO,
    ACCION_TIPO_SOPORTE_ACTUALIZADO,
    ACCION_TIPO_SOPORTE_CREADO,
    ACCION_TIPO_SOPORTE_ELIMINADO,
    MODULO_AUDITORIA_CONFIGURACION,
    RECURSO_REGLAS_MOTIVO,
    RECURSO_REGLAS_NOMINA,
    RECURSO_REGLAS_PAIS,
    RECURSO_REGLAS_PARENTESCO,
    RECURSO_REGLAS_TIPO_SOPORTE,
)
from apps.configuracion.infrastructure.repositories.repo_reglas_catalogos_orm import (
    RepoReglasCatalogosORM,
)
from apps.configuracion.infrastructure.serializers.reglas_catalogos_serializers import (
    ActualizarChecklistSoporteSerializer,
    ActualizarMotivoSerializer,
    ActualizarNominaSerializer,
    ActualizarParentescoSerializer,
    ActualizarPaisSerializer,
    ActualizarTipoSoporteSerializer,
    CambiarCategoriaMotivoSerializer,
    CrearMotivoSerializer,
    CrearNominaSerializer,
    CrearPaisSerializer,
    CrearParentescoSerializer,
    CrearTipoSoporteSerializer,
    ReglaChecklistSoporteSerializer,
    ReglaMotivoSerializer,
    ReglaNominaSerializer,
    ReglaPaisSerializer,
    ReglaParentescoSerializer,
    ReglaTipoSoporteSerializer,
    ReglasCatalogosCompletoSerializer,
    ReordenarTiposSoporteSerializer,
)
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.permissions import HasAnyPermission
from core.presentation.schema import MensajeRespuestaSerializer
from core.domain.tipos_soporte import ItemChecklistSoporte

PERMISO_VER = 'configuracion.ver'
PERMISO_EDITAR = 'configuracion.editar'
PERMISO_CATALOGOS_VER = 'catalogos.ver'
PERMISO_CATALOGOS_EDITAR = 'catalogos.editar'
PERMISO_CATALOGOS_CREAR = 'catalogos.crear'


def _actor(request) -> dict:
    user = request.user
    return {
        'actor_id': getattr(user, 'pk', None),
        'actor_cedula': str(getattr(user, 'cedula_id', '') or ''),
        'actor_rol': str(getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''),
    }


def _trace(request) -> str:
    return getattr(request, 'trace_id', None) or uuid.uuid4().hex


_REGLAS_PARENTESCO_VISTA = (
    'es_hijo', 'menor_a_cargo', 'sin_cedula_hasta_edad', 'edad_minima',
    'diferencia_minima', 'diferencia_tipo', 'sexo_permitido', 'soporte_sugerido',
    'activo',
)


def _regla_parentesco_de(serializer) -> dict | None:
    datos = {
        campo: serializer.validated_data[campo]
        for campo in _REGLAS_PARENTESCO_VISTA
        if campo in serializer.validated_data
    }
    return datos or None

__all__ = [
    'ACCION_CHECKLIST_SOPORTE_ACTUALIZADO',
    'ACCION_MOTIVO_ACTUALIZADO',
    'ACCION_MOTIVO_CATEGORIA_CAMBIADA',
    'ACCION_MOTIVO_CREADO',
    'ACCION_MOTIVO_ELIMINADO',
    'ACCION_NOMINA_ACTUALIZADA',
    'ACCION_NOMINA_CREADA',
    'ACCION_NOMINA_ELIMINADA',
    'ACCION_PAIS_ACTUALIZADO',
    'ACCION_PAIS_CREADO',
    'ACCION_PAIS_ELIMINADO',
    'ACCION_PARENTESCO_ACTUALIZADO',
    'ACCION_PARENTESCO_CREADO',
    'ACCION_PARENTESCO_ELIMINADO',
    'ACCION_TIPO_SOPORTE_ACTUALIZADO',
    'ACCION_TIPO_SOPORTE_CREADO',
    'ACCION_TIPO_SOPORTE_ELIMINADO',
    'APIView',
    'ActualizarChecklistSoporteSerializer',
    'ActualizarMotivoSerializer',
    'ActualizarNominaSerializer',
    'ActualizarPaisSerializer',
    'ActualizarParentescoSerializer',
    'ActualizarTipoSoporteSerializer',
    'CambiarCategoriaMotivoSerializer',
    'CrearMotivoSerializer',
    'CrearNominaSerializer',
    'CrearPaisSerializer',
    'CrearParentescoSerializer',
    'CrearTipoSoporteSerializer',
    'HasAnyPermission',
    'IsAuthenticated',
    'ItemChecklistSoporte',
    'MODULO_AUDITORIA_CONFIGURACION',
    'MensajeRespuestaSerializer',
    'OpenApiParameter',
    'PERMISO_CATALOGOS_CREAR',
    'PERMISO_CATALOGOS_EDITAR',
    'PERMISO_CATALOGOS_VER',
    'PERMISO_EDITAR',
    'PERMISO_VER',
    'RECURSO_REGLAS_MOTIVO',
    'RECURSO_REGLAS_NOMINA',
    'RECURSO_REGLAS_PAIS',
    'RECURSO_REGLAS_PARENTESCO',
    'RECURSO_REGLAS_TIPO_SOPORTE',
    'ReglaChecklistSoporteSerializer',
    'ReglaMotivoSerializer',
    'ReglaNominaSerializer',
    'ReglaPaisSerializer',
    'ReglaParentescoSerializer',
    'ReglaTipoSoporteSerializer',
    'ReglasCatalogosCompletoSerializer',
    'ReordenarTiposSoporteSerializer',
    'RepoReglasCatalogosORM',
    '_REGLAS_PARENTESCO_VISTA',
    '_actor',
    '_regla_parentesco_de',
    '_trace',
    'actualizar_checklist_soporte',
    'actualizar_motivo',
    'buscar_paises_paginado',
    'cambiar_categoria_motivo',
    'crear_nomina',
    'crear_nuevo_motivo',
    'crear_pais',
    'crear_parentesco',
    'crear_tipo_soporte',
    'editar_nomina',
    'editar_pais',
    'editar_parentesco',
    'editar_tipo_soporte',
    'eliminar_motivo',
    'eliminar_nomina',
    'eliminar_pais',
    'eliminar_parentesco',
    'eliminar_tipo_soporte',
    'extend_schema',
    'inline_serializer',
    'obtener_todas_las_reglas',
    'ok',
    'origen_de_peticion',
    'registrar_auditoria',
    'reordenar_tipos_soporte',
    'serializers',
    'transaction',
    'uuid',
]
