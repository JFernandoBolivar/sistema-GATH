"""Permisos de la carga masiva (códigos, nunca nombres de rol)."""
from rest_framework.permissions import IsAuthenticated

from core.presentation.permissions import HasPermission

from apps.carga_masiva.domain.constantes import (
    PERMISO_APLICAR,
    PERMISO_APROBAR,
    PERMISO_CARGAR,
    PERMISO_CARGAR_PASIVOS,
    PERMISO_REVERTIR,
)

CARGAR = PERMISO_CARGAR
CARGAR_PASIVOS = PERMISO_CARGAR_PASIVOS
APLICAR = PERMISO_APLICAR
APROBAR = PERMISO_APROBAR
REVERTIR = PERMISO_REVERTIR
