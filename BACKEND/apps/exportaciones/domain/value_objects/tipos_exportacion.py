"""
Catálogo cerrado de exportaciones asíncronas (PDF/Excel grandes).

Cada tipo corresponde a un reporte o historial que antes se generaba dentro de
la petición HTTP. El tipo y el formato son valores validados: nunca un texto
libre que decida qué código se ejecuta en el worker.
"""
from core.domain.exceptions import ValidationError

FORMATO_PDF = 'pdf'
FORMATO_EXCEL = 'excel'
FORMATOS = (FORMATO_PDF, FORMATO_EXCEL)

TIPO_PERSONAL_ACTIVO = 'personal_activo'
TIPO_PASIVOS = 'pasivos'
TIPO_FAMILIARES_ACTIVOS = 'familiares_activos'
TIPO_FAMILIARES_PASIVOS = 'familiares_pasivos'
TIPO_MOVIMIENTOS = 'movimientos'
TIPO_AUDITORIA = 'auditoria'
TIPO_FE_DE_VIDA_ESTADISTICAS = 'fe_de_vida_estadisticas'
TIPO_FE_DE_VIDA_BANDEJA = 'fe_de_vida_bandeja'
TIPOS = (
    TIPO_PERSONAL_ACTIVO,
    TIPO_PASIVOS,
    TIPO_FAMILIARES_ACTIVOS,
    TIPO_FAMILIARES_PASIVOS,
    TIPO_MOVIMIENTOS,
    TIPO_AUDITORIA,
    TIPO_FE_DE_VIDA_ESTADISTICAS,
    TIPO_FE_DE_VIDA_BANDEJA,
)

TIPO_CONTENIDO = {
    FORMATO_PDF: 'application/pdf',
    FORMATO_EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
EXTENSION = {FORMATO_PDF: 'pdf', FORMATO_EXCEL: 'xlsx'}

# Nombre base del archivo descargado (sin extensión).
NOMBRE_BASE = {
    TIPO_PERSONAL_ACTIVO: 'reporte_personal_activo',
    TIPO_PASIVOS: 'reporte_pasivos',
    TIPO_FAMILIARES_ACTIVOS: 'reporte_familiares',
    TIPO_FAMILIARES_PASIVOS: 'reporte_familiares_pasivos',
    TIPO_MOVIMIENTOS: 'historial-movimientos',
    TIPO_AUDITORIA: 'bitacora-auditoria',
    TIPO_FE_DE_VIDA_ESTADISTICAS: 'estadisticas-fe-de-vida',
    TIPO_FE_DE_VIDA_BANDEJA: 'bandeja-fe-de-vida',
}


def validar_tipo_y_formato(tipo: str, formato: str) -> tuple[str, str]:
    if tipo not in TIPOS:
        raise ValidationError(f'Tipo de exportación no válido: «{tipo}».', campo='tipo')
    if formato not in FORMATOS:
        raise ValidationError(f'Formato de exportación no válido: «{formato}».', campo='formato')
    return tipo, formato
