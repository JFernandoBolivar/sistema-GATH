"""
Generador del PDF de expediente de un empleado activo, migrado desde
`NextJS/src/modules/personal/ui/empleado-detalle-pdf.tsx` (@react-pdf/
renderer, cliente) a backend con ReportLab -- mismo motor y cintillo
configurable que ya usan `apps.reportes`/`apps.puntocuenta`/`apps.pasivos`.

`EmpleadoDTO` ya trae los nombres de catálogo resueltos (mismo mapper
compartido con `apps.pasivos`, ver `construir_expediente()`); la lógica de
formato replica exactamente la de
`NextJS/.../personal/ui/expediente-detalle-view-model.ts` (fecha de
ingreso al organismo, total de años APN, dirección resumida de cargo,
titular de encargaduría) para no divergir del Sheet de detalle.
"""
from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.personal.application.dtos.personal_dtos import EmpleadoDTO
from core.infrastructure.pdf.pdf_components import create_data_table, create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG, get_paragraph_styles

SIN_DATO = "N/A"


def _val(v) -> str:
    return str(v) if v not in (None, "") else SIN_DATO


def _fecha(v, por_defecto: str = SIN_DATO) -> str:
    if not v:
        return por_defecto
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except ValueError:
        return str(v)


def _info_row(label: str, valor: str, styles) -> Paragraph:
    return Paragraph(f"<b>{escape(label)}:</b> {escape(valor)}", styles['TableCell'])


def _seccion(titulo: str, styles) -> Paragraph:
    return Paragraph(escape(titulo), styles['TableHeader'])


def _tabla_simple(columnas: list[str], filas: list[list[str]], styles):
    if not filas:
        return Paragraph('Sin registros.', styles['TableCell'])
    dicts = [{col: fila[i] for i, col in enumerate(columnas)} for fila in filas]
    return create_data_table(columnas, dicts)


def _total_anos_apn(valor: float | None) -> str:
    total = valor or 0.0
    anos = int(total)
    meses = round((total % 1) * 12)
    return f"{anos} años, {meses} meses, 0 días"


def _fecha_ingreso_organismo(dto: EmpleadoDTO) -> str:
    contratos = dto.contratos if dto.contratos else ([dto.contrato_actual] if dto.contrato_actual else [])
    con_fecha = [c for c in contratos if c and c.get('fecha_ingreso')]
    if not con_fecha:
        return SIN_DATO
    con_fecha.sort(key=lambda c: c['fecha_ingreso'])
    return _fecha(con_fecha[0]['fecha_ingreso'])


def _direccion_resumida(asig: dict) -> str:
    return (
        asig.get('coordinacion')
        or asig.get('direccion_linea')
        or asig.get('direccion_general')
        or "No especificado"
    )


def _titular_encargaduria(enc: dict) -> str:
    titular_nombre = enc.get('titular_nombre') or enc.get('empleado_nombre') or ""
    titular_cedula = enc.get('titular_cedula') or enc.get('empleado_cedula') or SIN_DATO
    return f"{titular_nombre} ({titular_cedula})" if titular_nombre else titular_cedula


def construir_pdf_expediente_empleado(dto: EmpleadoDTO, usuario_nombre: str | None = None) -> bytes:
    generado_en = datetime.now()
    page_config = PAGE_CONFIG['portrait']
    styles = get_paragraph_styles()
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_config['pagesize'],
        leftMargin=page_config['leftMargin'],
        rightMargin=page_config['rightMargin'],
        topMargin=page_config['topMargin'],
        bottomMargin=page_config['bottomMargin'],
        title=f"Expediente de empleado {dto.cedula}",
        author='GATH - CONATEL',
        subject=f"Expediente generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
    )

    cedula_mostrada = f"{dto.nacionalidad_codigo}-{dto.cedula}" if dto.nacionalidad_codigo else dto.cedula
    texto_generacion = (
        f"Usuario: {usuario_nombre}, " if usuario_nombre else ""
    ) + f"Fecha de generación: {generado_en.strftime('%d/%m/%Y %H:%M:%S')}"

    vivienda = dto.datos_vivienda or {}
    salud = dto.perfil_salud or {}
    fisico = dto.perfil_fisico or {}

    story = [
        Paragraph(escape(texto_generacion), styles['CenterSmall']),
        Spacer(1, 4),
        Paragraph(escape(f"{dto.nombre_completo} — Cédula {cedula_mostrada}"), styles['CenterSmall']),
        Spacer(1, 6),
        _seccion('DATOS PERSONALES', styles),
        _info_row('Sexo', _val(dto.sexo_nombre), styles),
        _info_row('Fecha de nacimiento', _fecha(dto.fecha_nacimiento), styles),
        _info_row('Estado civil', _val(dto.estado_civil_nombre), styles),
        _info_row('Carnet de la patria', _val(dto.carnet_patria), styles),
        _info_row('Correo', _val(dto.correo), styles),
        _info_row('Teléfono móvil', _val(dto.telefono_movil), styles),
        _info_row('Teléfono habitación', _val(dto.telefono_habitacion), styles),
        _info_row('Total APN', _total_anos_apn(dto.total_anos_apn), styles),
        Spacer(1, 6),
        _seccion('DATOS LABORALES', styles),
    ]

    if dto.asignaciones:
        columnas = ['#', 'Código', 'Cargo Específico', 'Grado', 'Nómina', 'Dirección']
        filas = [
            [
                str(idx + 1),
                _val(asig.get('codigo')),
                _val(asig.get('denominacion_cargo_especifico')),
                _val(asig.get('grado')),
                _val(asig.get('tipo_nomina')),
                _direccion_resumida(asig),
            ]
            for idx, asig in enumerate(dto.asignaciones)
        ]
        story.append(_tabla_simple(columnas, filas, styles))
    else:
        story.append(Paragraph('Sin cargos asignados registrados', styles['TableCell']))
    story.append(_info_row('Fecha de ingreso', _fecha_ingreso_organismo(dto), styles))

    if dto.contrato_actual:
        c = dto.contrato_actual
        story.append(Spacer(1, 6))
        story.append(_seccion('CONTRATO ACTUAL', styles))
        story.append(_info_row('N° contrato', _val(c.get('n_contrato')), styles))
        story.append(_info_row('Fecha de culminación', _fecha(c.get('fecha_culminacion'), 'Indefinido'), styles))
        story.append(_info_row('Política', _val(c.get('politica_nombre')), styles))
        story.append(_info_row('Tipo', 'Fijo' if c.get('es_fijo') else 'Suplente/Contratado', styles))

    story.append(Spacer(1, 6))
    story.append(_seccion('ANTECEDENTES LABORALES', styles))
    if dto.antecedentes:
        columnas = ['#', 'Fecha Ingreso', 'Fecha Egreso', 'Organismo']
        filas = [
            [
                str(idx + 1),
                _fecha(a.get('fecha_ingreso')),
                _fecha(a.get('fecha_egreso'), 'Presente'),
                _val(a.get('organismo_nombre')),
            ]
            for idx, a in enumerate(dto.antecedentes)
        ]
        story.append(_tabla_simple(columnas, filas, styles))
        story.append(_info_row('Total APN', _total_anos_apn(dto.total_anos_apn), styles))
    else:
        story.append(Paragraph('Sin antecedentes registrados', styles['TableCell']))

    if dto.encargadurias:
        story.append(Spacer(1, 6))
        story.append(_seccion('ENCARGADURÍAS', styles))
        columnas = ['#', 'Cargo Encargado', 'Titular', 'Fecha Inicio', 'Fecha Fin', 'Estatus']
        filas = [
            [
                str(idx + 1),
                _val(enc.get('cargo_encargado')),
                _titular_encargaduria(enc),
                _fecha(enc.get('fecha_inicio')),
                _fecha(enc.get('fecha_fin'), 'Presente'),
                _val(enc.get('estatus_nombre') or 'ACTIVO'),
            ]
            for idx, enc in enumerate(dto.encargadurias)
        ]
        story.append(_tabla_simple(columnas, filas, styles))

    if dto.datos_vivienda:
        story.append(Spacer(1, 6))
        story.append(_seccion('DATOS DE VIVIENDA', styles))
        story.append(_info_row('Estado', _val(vivienda.get('estado_nombre')), styles))
        story.append(_info_row('Municipio', _val(vivienda.get('municipio_nombre')), styles))
        story.append(_info_row('Parroquia', _val(vivienda.get('parroquia_nombre')), styles))
        story.append(_info_row('Dirección', _val(vivienda.get('direccion_exacta')), styles))
        story.append(_info_row('Condición de vivienda', _val(vivienda.get('condicion_vivienda_nombre')), styles))
        story.append(_info_row('Código postal', _val(vivienda.get('codigo_postal_nombre')), styles))

    story.append(Spacer(1, 6))
    story.append(_seccion('FORMACIÓN ACADÉMICA', styles))
    columnas_fa = ['Nivel', 'Carrera', 'Mención', 'Institución']
    filas_fa = [
        [
            _val(fa.get('nivel_academico_nombre')),
            _val(fa.get('carrera_nombre')),
            _val(fa.get('mencion_nombre')),
            _val(fa.get('institucion_nombre')),
        ]
        for fa in dto.formacion_academica
    ]
    story.append(_tabla_simple(columnas_fa, filas_fa, styles))

    story.append(Spacer(1, 6))
    story.append(_seccion('FORMACIÓN COMPLEMENTARIA', styles))
    columnas_fc = ['Capacitación', 'Institución', 'Inicio', 'Fin', 'Horas']
    filas_fc = [
        [
            _val(fc.get('capacitacion_nombre')),
            _val(fc.get('institucion_nombre')),
            _fecha(fc.get('fecha_inicio')),
            _fecha(fc.get('fecha_fin')),
            _val(fc.get('horas_completadas')),
        ]
        for fc in dto.formacion_complementaria
    ]
    story.append(_tabla_simple(columnas_fc, filas_fc, styles))

    story.append(Spacer(1, 6))
    story.append(_seccion('CONTACTO DE EMERGENCIA', styles))
    columnas_ce = ['Nombre', 'Teléfono', 'Relación']
    filas_ce = [
        [
            _val(f"{c.get('nombres', '')} {c.get('apellidos', '')}".strip()),
            _val(c.get('telefono')),
            _val(c.get('relacion_nombre')),
        ]
        for c in dto.contacto_emergencia
    ]
    story.append(_tabla_simple(columnas_ce, filas_ce, styles))

    if dto.perfil_fisico:
        story.append(Spacer(1, 6))
        story.append(_seccion('PERFIL FÍSICO (TALLAS)', styles))
        story.append(_info_row('Talla camisa', _val(fisico.get('talla_camisa_nombre')), styles))
        story.append(_info_row('Talla pantalón', _val(fisico.get('talla_pantalon_nombre')), styles))
        story.append(_info_row('Talla zapatos', _val(fisico.get('talla_zapatos_nombre')), styles))
        story.append(_info_row('Talla chaqueta', _val(fisico.get('talla_chaqueta_nombre')), styles))

    if dto.perfil_salud:
        story.append(Spacer(1, 6))
        story.append(_seccion('SALUD', styles))
        story.append(_info_row('Grupo sanguíneo', _val(salud.get('grupo_sanguineo_nombre')), styles))
        story.append(_info_row('Alergias', ", ".join(salud.get('alergias_nombres') or []) or 'Ninguna', styles))
        story.append(_info_row('Patologías crónicas', ", ".join(salud.get('patologias_cronicas_nombres') or []) or 'Ninguna', styles))
        story.append(_info_row('Discapacidades', ", ".join(salud.get('discapacidades_nombres') or []) or 'Ninguna', styles))

    config_pdf = construir_config_pdf()

    def _en_pagina(canvas, doc_):
        canvas.saveState()
        for el in create_header('Expediente del trabajador', width=doc_.width, config=config_pdf):
            el.wrap(doc_.width, doc_.topMargin)
            el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 10)
        canvas.restoreState()
        draw_footer(canvas, doc_, doc_.page, 0, f"Generado: {generado_en.strftime('%d/%m/%Y %H:%M')}", config=config_pdf)

    doc.build(story, onFirstPage=_en_pagina, onLaterPages=_en_pagina)
    buffer.seek(0)
    return buffer.getvalue()
