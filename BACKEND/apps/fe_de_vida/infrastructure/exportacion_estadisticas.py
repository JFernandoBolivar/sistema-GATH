"""Generadores asíncronos (PDF/Excel) de las estadísticas de fe de vida (O21).

Los invoca el worker de `apps.exportaciones`, que depende de esta capa y nunca
al revés. Los filtros se validan antes de encolar (`validar_parametros`) para
que un parámetro inválido sea un 400 inmediato.
"""
from datetime import datetime
from io import BytesIO
from typing import Callable

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.fe_de_vida.application.use_cases.estadisticas import (
    calcular_estadisticas,
    listar_pasivos_estadistica,
    normalizar_filtros,
)
from apps.fe_de_vida.domain.entities.estadisticas import EstadisticasFeDeVida, PasivoEstadistica
from apps.fe_de_vida.domain.value_objects.estados import EstadoSolicitud
from apps.fe_de_vida.infrastructure.exportacion_comun import (
    AZUL,
    AZUL_CLARO,
    BORDE,
    ajustar_anchos,
    escribir_tabla,
)
from apps.fe_de_vida.infrastructure.pdf.comun import ETIQUETAS_CANAL, ETIQUETAS_ESTADO
from apps.fe_de_vida.infrastructure.pdf.estadisticas_pdf import generar_estadisticas_pdf
from apps.fe_de_vida.infrastructure.repositories.lector_alcance_orm import LectorAlcanceORM
from apps.fe_de_vida.infrastructure.repositories.repo_estadisticas_orm import RepoEstadisticasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from core.domain.exceptions import ValidationError

MAX_FILAS = 20000
LISTADOS = ('faltantes', 'celda')


def _parametros(parametros: dict) -> tuple[dict, str]:
    filtros = dict(parametros.get('filtros') or {})
    listado = str(filtros.get('listado') or 'faltantes').strip()
    if listado not in LISTADOS:
        raise ValidationError('El listado a exportar no es válido.', campo='listado')
    return filtros, listado


def validar_parametros(parametros: dict) -> None:
    filtros, listado = _parametros(parametros)
    normalizar_filtros(filtros)
    if listado == 'celda' and not filtros.get('estado'):
        raise ValidationError('Para exportar una casilla debe indicar el estado.', campo='estado')


def generar_archivo_estadisticas(
    formato: str, parametros: dict, progreso: Callable[[int], None],
) -> tuple[bytes, dict]:
    filtros, listado = _parametros(parametros)
    filtro = normalizar_filtros(filtros)
    estadisticas = calcular_estadisticas(
        RepoEstadisticasORM(), RepoProcesosORM(), LectorAlcanceORM(), filtro=filtro,
    )
    if estadisticas.proceso is None:
        raise ValidationError('No hay un proceso de fe de vida vigente para exportar.')
    progreso(25)
    pasivos, total = listar_pasivos_estadistica(
        RepoEstadisticasORM(), RepoProcesosORM(), filtro=filtro,
        faltantes=listado == 'faltantes', limite=MAX_FILAS, desplazamiento=0,
    )
    progreso(60)
    if formato == 'pdf':
        contenido = generar_estadisticas_pdf(
            estadisticas, pasivos, faltantes=listado == 'faltantes', config=construir_config_pdf(),
        )
    else:
        contenido = _excel_estadisticas(estadisticas, pasivos, faltantes=listado == 'faltantes')
    progreso(85)
    return contenido, {
        'total_encontrados': total,
        'limite': MAX_FILAS,
        'truncado': total > MAX_FILAS,
    }


def _excel_estadisticas(
    estadisticas: EstadisticasFeDeVida, pasivos: list[PasivoEstadistica], *, faltantes: bool,
) -> bytes:
    libro = Workbook()
    resumen = libro.active
    resumen.title = 'Resumen'
    conteos = estadisticas.conteos
    tipos = {t.id: t.nombre for t in estadisticas.tipos}
    filtro = estadisticas.filtro

    resumen['A1'] = 'Estadísticas de fe de vida'
    resumen['A1'].font = Font(bold=True, size=16, color=AZUL)
    resumen['A2'] = estadisticas.proceso.nombre if estadisticas.proceso else 'Sin proceso'
    resumen['A2'].font = Font(bold=True, size=12)
    resumen['A3'] = f"Generado el {datetime.now():%d/%m/%Y %H:%M}"
    resumen['A3'].font = Font(italic=True, color='666666')

    fila = 5
    resumen.cell(row=fila, column=1, value='Filtros aplicados').font = Font(bold=True, size=11)
    fila += 1
    aplicados = [('Proceso', estadisticas.proceso.nombre if estadisticas.proceso else 'Sin proceso')]
    if filtro.tipo_nomina_id:
        aplicados.append(('Tipo de pasivo', tipos.get(filtro.tipo_nomina_id, str(filtro.tipo_nomina_id))))
    if filtro.estado:
        aplicados.append(('Estado', ETIQUETAS_ESTADO.get(filtro.estado, filtro.estado)))
    if filtro.canal:
        aplicados.append(('Canal', ETIQUETAS_CANAL.get(filtro.canal, filtro.canal)))
    if filtro.desde:
        aplicados.append(('Enviadas desde', filtro.desde.strftime('%d/%m/%Y')))
    if filtro.hasta:
        aplicados.append(('Enviadas hasta', filtro.hasta.strftime('%d/%m/%Y')))
    for etiqueta, valor in aplicados:
        resumen.cell(row=fila, column=1, value=etiqueta).font = Font(bold=True)
        resumen.cell(row=fila, column=2, value=valor)
        fila += 1

    fila += 1
    resumen.cell(row=fila, column=1, value='Indicadores').font = Font(bold=True, size=11)
    fila += 1
    kpis = [
        ('Total de pasivos', conteos.total),
        ('Respondieron', conteos.respondieron),
        ('Faltan por responder', conteos.faltan),
        ('Validadas', conteos.validadas),
        ('% de respuesta', f'{estadisticas.porcentaje_respondieron:.1f}%'),
    ]
    for etiqueta, valor in kpis:
        celda = resumen.cell(row=fila, column=1, value=etiqueta)
        celda.fill = PatternFill('solid', start_color=AZUL_CLARO)
        celda.border = BORDE
        valor_celda = resumen.cell(row=fila, column=2, value=valor)
        valor_celda.font = Font(bold=True)
        valor_celda.border = BORDE
        fila += 1

    fila += 1
    resumen.cell(row=fila, column=1, value='Respondieron por tipo de pasivo').font = Font(bold=True, size=11)
    fila += 1
    filas_tipo = [
        [f.tipo_nomina, f.total, f.respondieron, f.faltan, f.validadas]
        for f in conteos.por_tipo
    ]
    fila = escribir_tabla(
        resumen, fila, ['Tipo de pasivo', 'Total', 'Respondieron', 'Faltan', 'Validadas'], filas_tipo,
    ) + 2

    resumen.cell(row=fila, column=1, value='Matriz tipo de pasivo × estado').font = Font(bold=True, size=11)
    fila += 1
    estados = [e.value for e in EstadoSolicitud]
    celdas = {(f.tipo_nomina_id, f.estado): f.total for f in conteos.matriz}
    filas_matriz = [
        [f.tipo_nomina, *[celdas.get((f.tipo_nomina_id, estado), 0) for estado in estados],
         sum(celdas.get((f.tipo_nomina_id, estado), 0) for estado in estados)]
        for f in conteos.por_tipo
    ]
    fila = escribir_tabla(
        resumen, fila, ['Tipo de pasivo', *estados, 'Total'], filas_matriz,
    )
    ajustar_anchos(resumen, ['Tipo de pasivo', *estados, 'Total'], filas_matriz)

    listado = libro.create_sheet('Listado')
    columnas = ['Cédula', 'Nombre completo', 'Tipo de pasivo', 'Correo', 'Teléfono']
    if not faltantes:
        columnas += ['Estado', 'Canal', 'Fecha de envío']
    filas = []
    for pasivo in pasivos:
        fila_pasivo = [pasivo.cedula, pasivo.nombre_completo, pasivo.tipo_nomina, pasivo.correo, pasivo.telefono]
        if not faltantes:
            fila_pasivo += [
                ETIQUETAS_ESTADO.get(pasivo.estado, pasivo.estado),
                ETIQUETAS_CANAL.get(pasivo.canal, pasivo.canal),
                pasivo.fecha_envio.strftime('%d/%m/%Y %H:%M') if pasivo.fecha_envio else '',
            ]
        filas.append(fila_pasivo)
    escribir_tabla(listado, 1, columnas, filas)
    ajustar_anchos(listado, columnas, filas)

    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()
