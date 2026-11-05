"""
Despacho de los generadores de archivo por tipo de exportación.

Implementa el puerto `GeneradorExportacion` reutilizando, sin cambios, los
generadores que antes corrían dentro de la vista (reportes, movimientos,
auditoría). Solo la infraestructura de un módulo puede importar la de otro (B16).
"""
from typing import Callable

from apps.auditoria.infrastructure import exportacion as exportacion_auditoria
from apps.exportaciones.domain.ports.generador_exportacion import ArchivoGenerado
from apps.exportaciones.domain.value_objects.tipos_exportacion import (
    TIPO_AUDITORIA,
    TIPO_FE_DE_VIDA_BANDEJA,
    TIPO_FE_DE_VIDA_ESTADISTICAS,
    TIPO_MOVIMIENTOS,
    validar_tipo_y_formato,
)
from apps.fe_de_vida.infrastructure import exportacion_bandeja, exportacion_estadisticas
from apps.movimientos.infrastructure import exportacion as exportacion_movimientos
from apps.reportes.infrastructure import exportacion as exportacion_reportes


def validar_parametros(tipo: str, parametros: dict) -> None:
    """Valida los filtros antes de encolar: un filtro inválido es un 400 inmediato."""
    if tipo == TIPO_MOVIMIENTOS:
        exportacion_movimientos.validar_parametros(parametros)
    elif tipo == TIPO_AUDITORIA:
        exportacion_auditoria.validar_parametros(parametros)
    elif tipo == TIPO_FE_DE_VIDA_ESTADISTICAS:
        exportacion_estadisticas.validar_parametros(parametros)
    elif tipo == TIPO_FE_DE_VIDA_BANDEJA:
        exportacion_bandeja.validar_parametros(parametros)
    else:
        exportacion_reportes.validar_parametros(tipo, parametros)


class GeneradorExportacionDjango:
    def generar(
        self, tipo: str, formato: str, parametros: dict, progreso: Callable[[int], None],
    ) -> ArchivoGenerado:
        tipo, formato = validar_tipo_y_formato(tipo, formato)
        if tipo == TIPO_MOVIMIENTOS:
            contenido, metadatos = exportacion_movimientos.generar_archivo_movimientos(
                formato, parametros, progreso,
            )
        elif tipo == TIPO_AUDITORIA:
            contenido, metadatos = exportacion_auditoria.generar_archivo_auditoria(
                formato, parametros, progreso,
            )
        elif tipo == TIPO_FE_DE_VIDA_ESTADISTICAS:
            contenido, metadatos = exportacion_estadisticas.generar_archivo_estadisticas(
                formato, parametros, progreso,
            )
        elif tipo == TIPO_FE_DE_VIDA_BANDEJA:
            contenido, metadatos = exportacion_bandeja.generar_archivo_bandeja(
                formato, parametros, progreso,
            )
        else:
            contenido, metadatos = exportacion_reportes.generar_archivo_reporte(
                tipo, formato, parametros, progreso,
            )
        return ArchivoGenerado(contenido=contenido, metadatos=metadatos)
