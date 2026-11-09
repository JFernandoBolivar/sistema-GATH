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
from datetime import date, datetime
from types import SimpleNamespace
from io import BytesIO

from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Image, SimpleDocTemplate, Spacer

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.personal.application.dtos.personal_dtos import EmpleadoDTO
from apps.personal.shared.domain.services.tiempo_servicio import calcular_total_apn
from core.domain.validacion_personas import formatear_telefono
from core.infrastructure.pdf.expediente_estilos import (
    grilla, nota_gris, seccion, sin_registros, tabla, tarjeta_identificacion,
)
from core.infrastructure.pdf.pdf_components import create_header, draw_footer, reducir_imagen_para_pdf
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG

SIN_DATO = "N/A"
MAX_CONTACTOS_PDF = 3


def _val(v) -> str:
    return str(v) if v not in (None, "") else SIN_DATO


def _fecha(v, por_defecto: str = SIN_DATO) -> str:
    if not v:
        return por_defecto
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except ValueError:
        return str(v)


def _a_fecha(v) -> date | None:
    if not v:
        return None
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def _plural(n: int, singular: str, plural: str) -> str:
    return f"{n} {singular if n == 1 else plural}"


def _apn_texto(valor: dict | None) -> str:
    if not valor:
        return "Sin datos"
    return ", ".join([
        _plural(valor['years'], 'año', 'años'),
        _plural(valor['months'], 'mes', 'meses'),
        _plural(valor['days'], 'día', 'días'),
    ])


def _total_apn_texto(dto: EmpleadoDTO) -> str:
    """Total APN oficial: ciclos cerrados + CONATEL en curso (O8)."""
    if dto.apn_total:
        return _apn_texto(dto.apn_total)
    periodos = [
        SimpleNamespace(fecha_ingreso=_a_fecha(a.get('fecha_ingreso')), fecha_egreso=_a_fecha(a.get('fecha_egreso')))
        for a in (dto.antecedentes or []) if a
    ]
    t = calcular_total_apn(periodos, fecha_corte=date.today())
    return _apn_texto(t)


def _fecha_ingreso_organismo(dto: EmpleadoDTO) -> str:
    contratos = dto.contratos if dto.contratos else ([dto.contrato_actual] if dto.contrato_actual else [])
    con_fecha = [c for c in contratos if c and c.get('fecha_ingreso')]
    if not con_fecha:
        return SIN_DATO
    con_fecha.sort(key=lambda c: c['fecha_ingreso'])
    return _fecha(con_fecha[0]['fecha_ingreso'])


def _dato_o_none(valor) -> str | None:
    """El mapper rellena con 'N/A' lo que falta; esa cadena es truthy y no debe ganar un `or`."""
    return valor if valor and valor != SIN_DATO else None


def _direccion_resumida(asig: dict) -> str:
    return (
        _dato_o_none(asig.get('coordinacion'))
        or _dato_o_none(asig.get('direccion_linea'))
        or _dato_o_none(asig.get('direccion_general'))
        or "No especificado"
    )


def _lineas_tarjeta(dto: EmpleadoDTO, cedula_mostrada: str) -> list[str]:
    """Cédula, cargo y Oficina/Gerencia (dirección general, no el nivel «dependencia») actuales."""
    lineas = [f"Cédula {cedula_mostrada}"]
    if dto.asignaciones:
        asig = dto.asignaciones[0]
        cargo = _dato_o_none(asig.get('denominacion_cargo_especifico'))
        direccion = _dato_o_none(asig.get('direccion_general'))
        if cargo:
            lineas.append(f"Cargo: {cargo}")
        if direccion:
            lineas.append(f"Oficina/Gerencia: {direccion}")
    return lineas


def _titular_encargaduria(enc: dict) -> str:
    titular_nombre = enc.get('titular_nombre') or enc.get('empleado_nombre') or ""
    titular_cedula = enc.get('titular_cedula') or enc.get('empleado_cedula') or SIN_DATO
    return f"{titular_nombre} ({titular_cedula})" if titular_nombre else titular_cedula


def _foto_flowable(foto_bytes: bytes | None):
    """Foto 3 x 3,5 cm; si los bytes no son una imagen válida, se omite sin dejar hueco."""
    if not foto_bytes:
        return None
    try:
        foto_bytes = reducir_imagen_para_pdf(foto_bytes, 500)
        ImageReader(BytesIO(foto_bytes)).getSize()
        return Image(BytesIO(foto_bytes), width=30 * mm, height=35 * mm, kind='proportional')
    except Exception:
        return None


def _tabla_o_vacio(columnas, filas, pesos, ancho):
    return tabla(columnas, filas, pesos, ancho) if filas else sin_registros()


def construir_pdf_expediente_empleado(
    dto: EmpleadoDTO,
    usuario_nombre: str | None = None,
    foto_bytes: bytes | None = None,
    historial_cargos: list[dict] | None = None,
) -> bytes:
    generado_en = datetime.now()
    page_config = PAGE_CONFIG['portrait']
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
    ancho = doc.width

    cedula_mostrada = f"{dto.nacionalidad_codigo}-{dto.cedula}" if dto.nacionalidad_codigo else dto.cedula
    vivienda = dto.datos_vivienda or {}
    salud = dto.perfil_salud or {}
    fisico = dto.perfil_fisico or {}

    # Tarjeta de identificación (cédula, cargo y dependencia actuales).
    lineas = _lineas_tarjeta(dto, cedula_mostrada)

    story = [
        tarjeta_identificacion(dto.nombre_completo, lineas, ancho, _foto_flowable(foto_bytes)),
        *seccion('Datos personales', grilla([
            ('Nombres', _val(dto.nombres)),
            ('Apellidos', _val(dto.apellidos)),
            ('Cédula', cedula_mostrada),
            ('Nacionalidad', _val(dto.nacionalidad_nombre)),
            ('Sexo', _val(dto.sexo_nombre)),
            ('Fecha de nacimiento', _fecha(dto.fecha_nacimiento)),
            ('Estado civil', _val(dto.estado_civil_nombre)),
            ('Correo', _val(dto.correo)),
            ('Teléfono móvil', _val(formatear_telefono(dto.telefono_movil))),
            ('Teléfono habitación', _val(formatear_telefono(dto.telefono_habitacion))),
            ('Código del Carnet de la Patria', _val(dto.carnet_patria)),
            ('Serial del Carnet de la Patria', _val(dto.carnet_patria_serial)),
        ], ancho), ancho),
    ]

    if dto.asignaciones:
        filas = [
            [
                str(idx + 1),
                _val(a.get('codigo')),
                _val(a.get('denominacion_cargo_especifico')),
                _val(a.get('tipo_nomina')),
                _direccion_resumida(a),
            ]
            for idx, a in enumerate(dto.asignaciones)
        ]
        cuerpo = tabla(['#', 'Código', 'Cargo específico', 'Nómina', 'Oficina/Gerencia'], filas, [4, 12, 30, 15, 39], ancho)
    else:
        cuerpo = sin_registros()
    story += seccion('Datos laborales', cuerpo, ancho)
    story.append(Spacer(1, 6))
    story.append(grilla([('Fecha de ingreso', _fecha_ingreso_organismo(dto))], ancho))

    if historial_cargos is not None:
        filas = [
            [
                _fecha(h.get('desde')),
                '—' if h.get('es_egreso') else _fecha(h.get('hasta'), 'Presente'),
                _val(h.get('movimiento')),
                _val(h.get('codigo')),
                _val(h.get('cargo')),
                _val(h.get('oficina')),
            ]
            for h in historial_cargos
        ]
        story += seccion('Historial de cargos', _tabla_o_vacio(
            ['Desde', 'Hasta', 'Movimiento', 'Código', 'Cargo', 'Oficina/Gerencia'], filas, [12, 12, 13, 10, 23, 30], ancho), ancho)

    if dto.contrato_actual:
        c = dto.contrato_actual
        story += seccion('Contrato actual', grilla([
            ('N° de contrato', _val(c.get('n_contrato'))),
            ('Fecha de culminación', _fecha(c.get('fecha_culminacion'), 'Indefinido')),
            ('Política', _val(c.get('politica_nombre'))),
            ('Tipo', 'Fijo' if c.get('es_fijo') else 'Suplente/Contratado'),
        ], ancho), ancho)

    filas = [
        [str(idx + 1), _fecha(a.get('fecha_ingreso')), _fecha(a.get('fecha_egreso'), 'Presente'), _val(a.get('organismo_nombre'))]
        for idx, a in enumerate(dto.antecedentes)
    ]
    story += seccion('Antecedentes laborales', _tabla_o_vacio(
        ['#', 'Fecha de ingreso', 'Fecha de egreso', 'Organismo'], filas, [4, 16, 16, 64], ancho), ancho)
    story.append(Spacer(1, 6))
    filas_apn = [
        ('Antecedentes (ciclos cerrados)', _apn_texto(dto.apn_antecedentes)),
        ('Tiempo en CONATEL (en curso)', _apn_texto(dto.apn_en_curso) if dto.apn_en_curso else 'Sin periodo en curso'),
        ('Total APN', _total_apn_texto(dto)),
    ]
    if dto.apn_incompleto:
        filas_apn.append(('Aviso', 'Fecha de ingreso pendiente: el total APN está incompleto.'))
    story.append(grilla(filas_apn, ancho))

    if dto.encargadurias:
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
        story += seccion('Encargadurías', tabla(
            ['#', 'Cargo encargado', 'Titular', 'Inicio', 'Fin', 'Estatus'], filas, [4, 28, 30, 12, 12, 14], ancho), ancho)

    if dto.datos_vivienda:
        story += seccion('Datos de vivienda', grilla([
            ('Estado', _val(vivienda.get('estado_nombre'))),
            ('Municipio', _val(vivienda.get('municipio_nombre'))),
            ('Parroquia', _val(vivienda.get('parroquia_nombre'))),
            ('Código postal', _val(vivienda.get('codigo_postal_nombre'))),
            ('Condición de vivienda', _val(vivienda.get('condicion_vivienda_nombre'))),
            ('Dirección', _val(vivienda.get('direccion_exacta'))),
        ], ancho), ancho)

    filas = [
        [
            _val(fa.get('nivel_academico_nombre')),
            _val(fa.get('carrera_nombre')),
            _val(fa.get('mencion_nombre')),
            _val(fa.get('institucion_nombre')),
        ]
        for fa in dto.formacion_academica
    ]
    story += seccion('Formación académica', _tabla_o_vacio(
        ['Nivel', 'Carrera', 'Mención', 'Institución'], filas, [16, 30, 20, 34], ancho), ancho)

    filas = [
        [
            _val(fc.get('capacitacion_nombre')),
            _val(fc.get('institucion_nombre')),
            _fecha(fc.get('fecha_inicio')),
            _fecha(fc.get('fecha_fin')),
            _val(fc.get('horas_completadas')),
        ]
        for fc in dto.formacion_complementaria
    ]
    story += seccion('Formación complementaria', _tabla_o_vacio(
        ['Capacitación', 'Institución', 'Inicio', 'Fin', 'Horas'], filas, [28, 28, 12, 12, 12], ancho), ancho)

    contactos = sorted(dto.contacto_emergencia, key=lambda c: (c.get('id') is None, c.get('id') or 0))
    filas = [
        [
            _val(f"{c.get('nombres') or ''} {c.get('apellidos') or ''}".strip()),
            _val(c.get('relacion_nombre')),
            _val(formatear_telefono(c.get('telefono'))),
        ]
        for c in contactos[:MAX_CONTACTOS_PDF]
    ]
    cuerpo = _tabla_o_vacio(['Nombres y apellidos', 'Parentesco', 'Teléfono'], filas, [50, 25, 25], ancho)
    if len(contactos) > MAX_CONTACTOS_PDF:
        cuerpo = [cuerpo, Spacer(1, 3), nota_gris(f"Se muestran {MAX_CONTACTOS_PDF} de {len(contactos)} contactos registrados.")]
    story += seccion('Contacto de emergencia', cuerpo, ancho)

    if dto.perfil_fisico:
        story += seccion('Perfil físico (tallas)', grilla([
            ('Talla de camisa', _val(fisico.get('talla_camisa_nombre'))),
            ('Talla de pantalón', _val(fisico.get('talla_pantalon_nombre'))),
            ('Talla de zapatos', _val(fisico.get('talla_zapatos_nombre'))),
            ('Talla de chaqueta', _val(fisico.get('talla_chaqueta_nombre'))),
        ], ancho), ancho)

    if dto.perfil_salud:
        story += seccion('Salud', grilla([
            ('Grupo sanguíneo', _val(salud.get('grupo_sanguineo_nombre'))),
            ('Alergias', ", ".join(salud.get('alergias_nombres') or []) or 'Ninguna'),
            ('Patologías crónicas', ", ".join(salud.get('patologias_cronicas_nombres') or []) or 'Ninguna'),
            ('Discapacidades', ", ".join(salud.get('discapacidades_nombres') or []) or 'Ninguna'),
        ], ancho), ancho)

    config_pdf = construir_config_pdf()
    quien = f" por {usuario_nombre}" if usuario_nombre else ""
    texto_generado = f"Generado el {generado_en.strftime('%d/%m/%Y')} a las {generado_en.strftime('%H:%M')}{quien}"

    def _encabezado(canvas, doc_):
        canvas.saveState()
        for el in create_header('Expediente del trabajador', width=doc_.width, config=config_pdf):
            el.wrap(doc_.width, doc_.topMargin)
            el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 10)
        canvas.restoreState()

    class _CanvasNumerado(Canvas):
        """Dibuja el pie al final para conocer el total de páginas («Página X de Y»)."""

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._estados = []

        def showPage(self):
            self._estados.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._estados)
            for estado in self._estados:
                self.__dict__.update(estado)
                draw_footer(
                    self, doc, self._pageNumber, total, config=config_pdf,
                    texto_pagina=f"{texto_generado} · Página {self._pageNumber} de {total}",
                )
                super().showPage()
            super().save()

    doc.build(story, onFirstPage=_encabezado, onLaterPages=_encabezado, canvasmaker=_CanvasNumerado)
    buffer.seek(0)
    return buffer.getvalue()
