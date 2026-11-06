"""
Generación de los archivos (PDF/Excel) de los reportes que se exportan en segundo plano.

Es el mismo generador que usaban las vistas síncronas: casos de uso del reporte
+ `generar_reporte_pdf`/`generar_reporte_excel`. Lo invoca el worker de
`apps.exportaciones` (que depende de esta capa, nunca al revés), y la vista llama
a `validar_parametros` antes de encolar para que un filtro inválido sea un 400
inmediato y no un error tardío del trabajo.
"""
from typing import Callable

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.reportes.application.use_cases.generar_reportes import (
    generar_reporte_familiares,
    generar_reporte_pasivos_actuales,
    generar_reporte_personal,
    preparar_consulta_familiares,
)
from apps.reportes.domain.services.filtros_reporte_personal import preparar_consulta_personal
from apps.reportes.domain.value_objects.condicion_trabajador import (
    CONDICION_ACTIVO,
    CONDICION_PASIVO,
)
from apps.reportes.infrastructure.repositories.repo_reportes_orm import RepoReportesORM
from apps.personal.shared.domain.services.tiempo_servicio import formatear_tiempo_servicio
from core.domain.exceptions import ValidationError
from core.infrastructure.pdf.report_excel import generar_reporte_excel
from core.infrastructure.pdf.report_pdf import generar_reporte_pdf
from core.infrastructure.report_field_registry import ReportFieldRegistryORM
from core.infrastructure.reportes import limite_de_reporte

TIPO_PERSONAL_ACTIVO = 'personal_activo'
TIPO_PASIVOS = 'pasivos'
TIPO_FAMILIARES_ACTIVOS = 'familiares_activos'
TIPO_FAMILIARES_PASIVOS = 'familiares_pasivos'

CONDICION_DE_FAMILIARES = {
    TIPO_FAMILIARES_ACTIVOS: CONDICION_ACTIVO,
    TIPO_FAMILIARES_PASIVOS: CONDICION_PASIVO,
}
TIPOS_DE_REPORTE = (
    TIPO_PERSONAL_ACTIVO, TIPO_PASIVOS, TIPO_FAMILIARES_ACTIVOS, TIPO_FAMILIARES_PASIVOS,
)


SIN_FECHA_INGRESO = '—'


def preparar_filas_reporte(filas) -> list[dict]:
    """Filas listas para PDF/Excel (FIX-QA14).

    - Quita `apn_aviso`, que es un dato interno y ya no es una columna.
    - `total_anos_apn` pasa de decimal crudo (0.0082) a texto legible
      («3 días de servicio en APN»).
    - Sin fecha de ingreso se muestra «—», no «0 días».
    """
    preparadas = []
    for fila in filas:
        copia = dict(fila)
        aviso = copia.pop('apn_aviso', '')
        if 'total_anos_apn' in copia:
            copia['total_anos_apn'] = (
                SIN_FECHA_INGRESO
                if aviso
                else formatear_tiempo_servicio(copia['total_anos_apn'])
            )
        preparadas.append(copia)
    return preparadas


def validar_parametros(tipo: str, parametros: dict) -> None:
    """Valida los filtros sin consultar la base (400 si son inválidos, 403 si falta el permiso)."""
    filtros = parametros.get('filtros') or {}
    puede = bool(parametros.get('puede_filtrar_estructura'))
    registro = ReportFieldRegistryORM()
    if tipo in (TIPO_PERSONAL_ACTIVO, TIPO_PASIVOS):
        preparar_consulta_personal(
            filtros=filtros, configuracion=registro.configuracion('empleados'),
            puede_filtrar_estructura=puede,
        )
    elif tipo in CONDICION_DE_FAMILIARES:
        preparar_consulta_familiares(filtros, registro, puede)
    else:
        raise ValidationError(f'Tipo de reporte no exportable: «{tipo}».')


def generar_archivo_reporte(
    tipo: str, formato: str, parametros: dict, progreso: Callable[[int], None],
) -> tuple[bytes, dict]:
    """Devuelve `(contenido, metadatos)` del reporte pedido, con el tope del formato."""
    para_pdf = formato == 'pdf'
    limite = limite_de_reporte(para_pdf=para_pdf)
    repo = RepoReportesORM()
    registro = ReportFieldRegistryORM()
    filtros = parametros.get('filtros') or {}
    puede = bool(parametros.get('puede_filtrar_estructura'))

    if tipo == TIPO_PERSONAL_ACTIVO:
        dto = generar_reporte_personal(
            repo, filtros=filtros, registro=registro, puede_filtrar_estructura=puede, limite=limite,
        )
    elif tipo == TIPO_PASIVOS:
        dto = generar_reporte_pasivos_actuales(
            repo, filtros=filtros, registro=registro, puede_filtrar_estructura=puede, limite=limite,
        )
    elif tipo in CONDICION_DE_FAMILIARES:
        dto = generar_reporte_familiares(
            repo, filtros=filtros, limite=limite, condicion=CONDICION_DE_FAMILIARES[tipo],
            registro=registro, puede_filtrar_estructura=puede,
        )
    else:
        raise ValidationError(f'Tipo de reporte no exportable: «{tipo}».')

    progreso(60)
    filas = preparar_filas_reporte(dto.filas)
    if para_pdf:
        contenido = generar_reporte_pdf(dto.titulo, dto.columnas, filas, config=construir_config_pdf())
    else:
        contenido = generar_reporte_excel(dto.titulo, dto.columnas, filas)
    return contenido, dto.metadatos or {}
