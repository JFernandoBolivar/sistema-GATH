"""
Motor genérico de reportes PDF (Fase 2.4 del plan de reparación,
`PLAN_REPARACION_GATH.md`; R-06/R-07 del plan original).

Réplica funcional simplificada de `RAC/services/pdf/base_generator.py`: en
vez de una jerarquía de clases con un generador por tipo de entidad (el
legado tenía uno por cada de los 5 tipos: activo, pasivo, familiar,
asignación, graduados), esta única función renderiza cualquier
`ResultadoReporte` (`apps/reportes/domain/entities/resultado_reporte.py`) —
el mismo objeto ya devuelto por `RepoReportesORM` para JSON. Un reporte
nuevo que se agregue a `apps.reportes` obtiene el PDF gratis con solo
producir un `ResultadoReporte`, sin escribir una plantilla nueva.
"""
from datetime import datetime
from io import BytesIO

from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Spacer

from core.infrastructure.pdf.pdf_components import create_data_table, create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG


def generar_reporte_pdf(
    titulo: str, columnas: list[str], filas: list[dict], orientation: str = 'landscape', config: dict | None = None,
) -> bytes:
    """
    `config` (opcional, HU 0009): dict plano con el cintillo configurado
    (ver `core/infrastructure/pdf/pdf_components.py`). `None` preserva el
    comportamiento hardcodeado anterior a esta HU.
    """
    generado_en = datetime.now()
    page_config = PAGE_CONFIG.get(orientation, PAGE_CONFIG['landscape'])
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_config['pagesize'],
        leftMargin=page_config['leftMargin'],
        rightMargin=page_config['rightMargin'],
        topMargin=page_config['topMargin'],
        bottomMargin=page_config['bottomMargin'],
        title=titulo,
        author='GATH - CONATEL',
        subject=f"Reporte generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
    )
    ancho_disponible = doc.pagesize[0] - page_config['leftMargin'] - page_config['rightMargin']

    # Estadísticas automáticas
    stats = {}
    if 'cedula_familiar' in columnas:
        total_fam = len(filas)
        cedulas_emp = len({f.get('cedula_empleado') for f in filas if f.get('cedula_empleado')})
        masc = sum(1 for f in filas if str(f.get('sexo', '')).strip().upper() in ('M', 'MASCULINO'))
        fem = sum(1 for f in filas if str(f.get('sexo', '')).strip().upper() in ('F', 'FEMENINO'))
        stats = {'Total Empleados': cedulas_emp, 'Total Familiares': total_fam, 'Masculino': masc, 'Femenino': fem}
    elif 'sexo' in columnas and 'cedula' in columnas:
        total = len(filas)
        masc = sum(1 for f in filas if str(f.get('sexo', '')).strip().upper() in ('M', 'MASCULINO'))
        fem = sum(1 for f in filas if str(f.get('sexo', '')).strip().upper() in ('F', 'FEMENINO'))
        stats = {'Total Empleados': total, 'Masculino': masc, 'Femenino': fem}
    elif 'motivo_egreso' in columnas or 'fecha_egreso' in columnas:
        stats = {'Total Egresados': len(filas)}
    elif 'codigo' in columnas and 'estatus' in columnas:
        total = len(filas)
        ocupados = sum(1 for f in filas if str(f.get('estatus', '')).strip().upper() == 'ACTIVO')
        vacantes = sum(1 for f in filas if str(f.get('estatus', '')).strip().upper() == 'VACANTE')
        stats = {'Total Cargos': total, 'Ocupados': ocupados, 'Vacantes': vacantes}
    else:
        stats = {'Total de Registros': len(filas)}

    # Proporciones de columnas reconocidas idénticas al formato legado
    col_widths = None
    if columnas == ['#', 'codigo', 'cedula', 'nombres', 'apellidos', 'fecha_ingreso', 'sexo', 'tipo_nomina', 'cargo', 'organismo_adscrito']:
        col_widths = [10 * mm, 17 * mm, 22 * mm, 30 * mm, 30 * mm, 22 * mm, 15 * mm, 30 * mm, 40 * mm, 45 * mm]
    elif columnas == ['#', 'cedula_empleado', 'nombre_empleado', 'cedula_familiar', 'nombre_familiar', 'parentesco', 'fecha_nacimiento', 'sexo']:
        col_widths = [10 * mm, 24 * mm, 48 * mm, 24 * mm, 48 * mm, 25 * mm, 25 * mm, 15 * mm]
    elif columnas == ['#', 'cedula', 'nombre_completo', 'fecha_ingreso', 'fecha_egreso', 'motivo_egreso', 'ultimo_cargo']:
        col_widths = [10 * mm, 22 * mm, 55 * mm, 25 * mm, 25 * mm, 45 * mm, 75 * mm]
    elif columnas == ['#', 'codigo', 'cedula', 'empleado', 'cargo', 'cargo_especifico', 'grado', 'tipo_nomina', 'organismo_adscrito', 'estatus']:
        col_widths = [10 * mm, 17 * mm, 22 * mm, 40 * mm, 33 * mm, 35 * mm, 13 * mm, 25 * mm, 36 * mm, 25 * mm]
    elif columnas:
        col_widths = [ancho_disponible / len(columnas)] * len(columnas)

    from core.infrastructure.pdf.pdf_components import create_stats_box

    story = [
        create_stats_box(stats, width=ancho_disponible),
        Spacer(1, 4 * mm),
        create_data_table(columnas, filas, col_widths=col_widths),
    ]

    def _en_pagina(canvas, doc_):
        canvas.saveState()
        for el in create_header(titulo, width=doc_.width, config=config):
            w, h = el.wrap(doc_.width, doc_.topMargin)
            el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 10 * mm)
        canvas.restoreState()
        # `total_pages` no se conoce hasta terminar el build (reportlab necesita
        # dos pasadas para eso, igual que el legado `base_generator.py`, que
        # tampoco lo resolvía) — se muestra solo el número de página actual.
        draw_footer(canvas, doc_, doc_.page, 0, f"Generado: {generado_en.strftime('%d/%m/%Y %H:%M')}", config=config)

    doc.build(story, onFirstPage=_en_pagina, onLaterPages=_en_pagina)

    buffer.seek(0)
    return buffer.getvalue()
