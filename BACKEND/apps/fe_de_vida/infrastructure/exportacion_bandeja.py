"""Exportación asíncrona (PDF/Excel) de la bandeja de fe de vida (O23).

Reutiliza las utilidades de O21 (`exportacion_comun` para Excel y `pdf/comun`
para el PDF) y respeta exactamente los filtros y el criterio de proceso de la
bandeja de Bienestar.
"""
from datetime import datetime
from io import BytesIO
from typing import Callable
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.fe_de_vida.application.use_cases.consultas import normalizar_filtro_bandeja
from apps.fe_de_vida.domain.entities.bandeja_exportacion import PasivoBandeja
from apps.fe_de_vida.domain.entities.filtros import FiltroBandeja
from apps.fe_de_vida.infrastructure.exportacion_comun import (
    AZUL,
    ajustar_anchos,
    escribir_tabla,
)
from apps.fe_de_vida.infrastructure.pdf.comun import (
    ETIQUETAS_ESTADO,
    construir_pdf,
)
from apps.fe_de_vida.infrastructure.repositories.repo_bandeja_exportacion_orm import (
    RepoBandejaExportacionORM,
)
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from core.domain.exceptions import ValidationError
from core.infrastructure.pdf.pdf_components import create_data_table, create_stats_box
from core.infrastructure.pdf.pdf_styles import get_paragraph_styles

MAX_FILAS = 20000
TITULO = 'Bandeja de fe de vida'
COLUMNAS = ['cedula', 'nombres', 'apellidos', 'correo', 'telefono', 'estatus', 'fecha', 'numero_acta']
ANCHOS_PDF = [22 * mm, 32 * mm, 32 * mm, 48 * mm, 26 * mm, 27 * mm, 27 * mm, 34 * mm]


def validar_parametros(parametros: dict) -> None:
    normalizar_filtro_bandeja(parametros.get('filtros') or {})


def _filtro(parametros: dict) -> FiltroBandeja:
    filtro = normalizar_filtro_bandeja(parametros.get('filtros') or {})
    if filtro.proceso_ids is not None:
        raise ValidationError('El proceso indicado no es válido.', campo='proceso_id')
    return filtro


def _descripcion_proceso(filtro: FiltroBandeja) -> str:
    if filtro.proceso_id:
        proceso = RepoProcesosORM().obtener(filtro.proceso_id)
        return proceso.nombre if proceso else filtro.proceso_id
    return 'Histórico de procesos cerrados' if filtro.historico else 'Proceso vigente (abierto)'


def _pares_de_filtros(filtro: FiltroBandeja) -> list[tuple[str, str]]:
    pares = [('Proceso', _descripcion_proceso(filtro))]
    if filtro.estado:
        pares.append(('Estado', ETIQUETAS_ESTADO.get(filtro.estado, filtro.estado)))
    if filtro.texto:
        pares.append(('Cédula o nombre', filtro.texto))
    if filtro.desde:
        pares.append(('Enviadas desde', filtro.desde.strftime('%d/%m/%Y')))
    if filtro.hasta:
        pares.append(('Enviadas hasta', filtro.hasta.strftime('%d/%m/%Y')))
    return pares


def generar_archivo_bandeja(
    formato: str, parametros: dict, progreso: Callable[[int], None],
) -> tuple[bytes, dict]:
    filtro = _filtro(parametros)
    progreso(20)
    filas, total = RepoBandejaExportacionORM().listar(filtro, MAX_FILAS, 0)
    progreso(60)
    if formato == 'pdf':
        contenido = _pdf(filtro, filas, total)
    else:
        contenido = _excel(filtro, filas, total)
    progreso(85)
    return contenido, {'total_encontrados': total, 'limite': MAX_FILAS, 'truncado': total > MAX_FILAS}


def _pdf(filtro: FiltroBandeja, filas: list[PasivoBandeja], total: int) -> bytes:
    generado_en = datetime.now()
    estilos = get_paragraph_styles()
    story = [
        Paragraph(f'<b>{escape(_descripcion_proceso(filtro))}</b>', estilos['Title']),
        Paragraph(f'Documento generado el {generado_en:%d/%m/%Y %H:%M}', estilos['CenterSmall']),
        Spacer(1, 3 * mm),
        Paragraph('<b>Filtros aplicados</b>', estilos['TableCell']),
    ]
    for etiqueta, valor in _pares_de_filtros(filtro):
        story.append(Paragraph(f'<b>{escape(etiqueta)}:</b> {escape(str(valor))}', estilos['TableCell']))
    story.append(Spacer(1, 3 * mm))
    story.append(create_stats_box({'Solicitudes encontradas': total}, width=140 * mm))
    story.append(Spacer(1, 4 * mm))
    if filas:
        story.append(create_data_table(COLUMNAS, [_fila(fila) for fila in filas], col_widths=ANCHOS_PDF))
    else:
        story.append(Paragraph('No hay solicitudes que coincidan con los filtros aplicados.', estilos['TableCell']))
    return construir_pdf(TITULO, story, config=construir_config_pdf(), generado_en=generado_en)


def _fila(pasivo: PasivoBandeja) -> dict:
    return {
        'cedula': pasivo.cedula,
        'nombres': pasivo.nombres,
        'apellidos': pasivo.apellidos,
        'correo': pasivo.correo,
        'telefono': pasivo.telefono,
        'estatus': ETIQUETAS_ESTADO.get(pasivo.estado, pasivo.estado),
        'fecha': pasivo.fecha_envio.strftime('%d/%m/%Y %H:%M') if pasivo.fecha_envio else '',
        'numero_acta': pasivo.numero_acta,
    }


def _excel(filtro: FiltroBandeja, filas: list[PasivoBandeja], total: int) -> bytes:
    libro = Workbook()
    hoja = libro.active
    hoja.title = 'Bandeja'
    hoja['A1'] = TITULO
    hoja['A1'].font = Font(bold=True, size=16, color=AZUL)
    hoja['A2'] = _descripcion_proceso(filtro)
    hoja['A2'].font = Font(bold=True, size=12)
    hoja['A3'] = f"Generado el {datetime.now():%d/%m/%Y %H:%M} · {total} solicitud(es)"
    hoja['A3'].font = Font(italic=True, color='666666')
    fila = 5
    for etiqueta, valor in _pares_de_filtros(filtro):
        hoja.cell(row=fila, column=1, value=etiqueta).font = Font(bold=True)
        hoja.cell(row=fila, column=2, value=valor)
        fila += 1
    fila += 1
    encabezados = ['Cédula', 'Nombres', 'Apellidos', 'Correo', 'Teléfono', 'Estatus', 'Fecha de envío', 'Número de acta']
    datos = [
        [
            pasivo.cedula, pasivo.nombres, pasivo.apellidos, pasivo.correo, pasivo.telefono,
            ETIQUETAS_ESTADO.get(pasivo.estado, pasivo.estado),
            pasivo.fecha_envio.strftime('%d/%m/%Y %H:%M') if pasivo.fecha_envio else '',
            pasivo.numero_acta,
        ]
        for pasivo in filas
    ]
    escribir_tabla(hoja, fila, encabezados, datos)
    ajustar_anchos(hoja, encabezados, datos)
    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()
