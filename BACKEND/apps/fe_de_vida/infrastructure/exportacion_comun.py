"""Compatibilidad: el estilo vive en `core.infrastructure.excel.estilo_reporte`.

Los generadores de fe de vida siguen importando desde aquí, pero ya no hay
copias de estilos por módulo (TLF-K).
"""
from core.infrastructure.excel.estilo_reporte import (  # noqa: F401
    AZUL,
    AZUL_CLARO,
    AZUL_MEDIO,
    AMARILLO_SUAVE,
    BORDE,
    FILA_ALTERNA,
    FUENTE,
    GRIS_MUTED,
    GRIS_TEXTO,
    ajustar_anchos,
    configurar_impresion,
    escribir_encabezado_institucional,
    escribir_pie,
    escribir_seccion,
    escribir_tabla,
)
