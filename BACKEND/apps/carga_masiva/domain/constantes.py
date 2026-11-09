"""Permisos de la carga masiva (códigos, nunca nombres de rol).

FIX-CARGA1: la carga de activos y la de pasivos tienen permisos de entrada
separados. Aplicar, aprobar y revertir siguen siendo transversales.
"""

PERMISO_CARGAR = 'personal.carga_masiva'
PERMISO_CARGAR_PASIVOS = 'pasivos.carga_masiva'
PERMISO_APLICAR = 'personal.carga_masiva_aplicar'
PERMISO_APROBAR = 'personal.carga_masiva_aprobar'
PERMISO_REVERTIR = 'personal.carga_masiva_revertir'

TIPO_NOTIFICACION_PENDIENTE = 'personal.carga_masiva_pendiente'


def permiso_de_poblacion(poblacion: str) -> str:
    """Código de permiso que habilita cargar una población."""
    return PERMISO_CARGAR_PASIVOS if str(poblacion).upper() == 'PASIVOS' else PERMISO_CARGAR
