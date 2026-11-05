"""Generadores asíncronos (PDF/Excel) de las estadísticas de fe de vida (O21, O25).

Los invoca el worker de `apps.exportaciones`, que depende de esta capa y nunca
al revés. Los filtros y opciones de generación se validan antes de encolar
(`validar_parametros`) para que cualquier parámetro inválido sea un 400 inmediato.
"""
from datetime import datetime
from io import BytesIO
from typing import Callable

from openpyxl import Workbook

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.fe_de_vida.application.use_cases.estadisticas import (
    calcular_estadisticas,
    listar_pasivos_estadistica,
    normalizar_filtros,
)
from apps.fe_de_vida.domain.entities.estadisticas import EstadisticasFeDeVida, PasivoEstadistica
from apps.fe_de_vida.domain.value_objects.estados import EstadoSolicitud
from apps.fe_de_vida.infrastructure.exportacion_comun import (
    ajustar_anchos,
    escribir_encabezado_institucional,
    escribir_seccion,
    escribir_tabla,
)
from apps.fe_de_vida.infrastructure.pdf.comun import ETIQUETAS_CANAL, ETIQUETAS_ESTADO
from apps.fe_de_vida.infrastructure.pdf.estadisticas_pdf import generar_estadisticas_pdf
from apps.fe_de_vida.infrastructure.repositories.lector_alcance_orm import LectorAlcanceORM
from apps.fe_de_vida.infrastructure.repositories.repo_estadisticas_orm import RepoEstadisticasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from core.domain.exceptions import ValidationError

MAX_FILAS = 20000
ALCANCES_VALIDOS = ('faltan', 'faltantes', 'respondieron', 'respondidas', 'ambos', 'celda')


def _bool(val, default: bool = True) -> bool:
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ('true', '1', 'si', 'sí', 't')


def _opciones(parametros: dict) -> tuple[dict, bool, bool, bool, str]:
    filtros = dict(parametros.get('filtros') or {})
    incluir_resumen = _bool(filtros.get('incluir_resumen'), default=True)
    incluir_graficos = _bool(filtros.get('incluir_graficos'), default=True)
    incluir_listado = _bool(filtros.get('incluir_listado'), default=True)

    alcance = str(filtros.get('alcance_listado') or '').strip().lower()
    if not alcance:
        alcance = str(filtros.get('listado') or '').strip().lower() or 'faltan'

    if alcance not in ALCANCES_VALIDOS:
        raise ValidationError('El alcance del listado a exportar no es válido.', campo='alcance_listado')

    if not (incluir_resumen or incluir_graficos or incluir_listado):
        raise ValidationError('Debe seleccionar al menos una sección para el reporte.')

    if alcance == 'celda' and not filtros.get('estado'):
        raise ValidationError('Para exportar una casilla debe indicar el estado.', campo='estado')

    return filtros, incluir_resumen, incluir_graficos, incluir_listado, alcance


def validar_parametros(parametros: dict) -> None:
    filtros, _res, _graf, _list, _alcance = _opciones(parametros)
    normalizar_filtros(filtros)


def generar_archivo_estadisticas(
    formato: str, parametros: dict, progreso: Callable[[int], None],
) -> tuple[bytes, dict]:
    filtros, incluir_resumen, incluir_graficos, incluir_listado, alcance = _opciones(parametros)
    filtro = normalizar_filtros(filtros)
    estadisticas = calcular_estadisticas(
        RepoEstadisticasORM(), RepoProcesosORM(), LectorAlcanceORM(), filtro=filtro,
    )
    if estadisticas.proceso is None:
        raise ValidationError('No hay un proceso de fe de vida vigente para exportar.')
    progreso(25)

    if incluir_listado:
        pasivos, total = listar_pasivos_estadistica(
            RepoEstadisticasORM(), RepoProcesosORM(), filtro=filtro,
            faltantes=alcance in ('faltan', 'faltantes'),
            alcance=alcance, limite=MAX_FILAS, desplazamiento=0,
        )
    else:
        pasivos, total = [], 0
    progreso(60)

    if formato == 'pdf':
        contenido = generar_estadisticas_pdf(
            estadisticas, pasivos,
            faltantes=alcance in ('faltan', 'faltantes'),
            incluir_resumen=incluir_resumen,
            incluir_graficos=incluir_graficos,
            incluir_listado=incluir_listado,
            alcance_listado=alcance,
            config=construir_config_pdf(),
        )
    else:
        contenido = _excel_estadisticas(
            estadisticas, pasivos,
            incluir_resumen=incluir_resumen,
            incluir_listado=incluir_listado,
            alcance_listado=alcance,
        )
    progreso(85)
    return contenido, {
        'total_encontrados': total,
        'limite': MAX_FILAS,
        'truncado': total > MAX_FILAS,
    }


def _excel_estadisticas(
    estadisticas: EstadisticasFeDeVida,
    pasivos: list[PasivoEstadistica],
    *,
    incluir_resumen: bool = True,
    incluir_listado: bool = True,
    alcance_listado: str = 'faltan',
) -> bytes:
    libro = Workbook()
    tipos = {t.id: t.nombre for t in estadisticas.tipos}
    filtro = estadisticas.filtro
    generado_en = datetime.now()
    estados = [e.value for e in EstadoSolicitud]

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

    if incluir_resumen:
        resumen = libro.active
        resumen.title = 'Resumen e indicadores'
        conteos = estadisticas.conteos

        fila = escribir_encabezado_institucional(
            resumen, titulo='Estadísticas de fe de vida',
            subtitulo=estadisticas.proceso.nombre if estadisticas.proceso else 'Sin proceso',
            filtros=aplicados, generado_en=generado_en, columnas=10,
        )

        fila = escribir_seccion(resumen, fila, 'Indicadores del proceso', 10)
        kpis = [
            ['Total de pasivos', conteos.total],
            ['Respondieron', conteos.respondieron],
            ['Faltan por responder', conteos.faltan],
            ['Validadas', conteos.validadas],
            ['% de pasivos que respondieron', f'{estadisticas.porcentaje_respondieron:.1f}%'],
        ]
        fila = escribir_tabla(resumen, fila, ['Indicador', 'Valor'], kpis, congelar=False) + 2
        ajustar_anchos(resumen, ['Indicador', 'Valor'], kpis)

        fila = escribir_seccion(resumen, fila, 'Respondieron por tipo de pasivo', 10)
        filas_tipo = [
            [f.tipo_nomina, f.total, f.respondieron, f.faltan, f.validadas]
            for f in conteos.por_tipo
        ]
        fila = escribir_tabla(
            resumen, fila, ['Tipo de pasivo', 'Total', 'Respondieron', 'Faltan', 'Validadas'], filas_tipo,
            congelar=False,
        ) + 2
        ajustar_anchos(resumen, ['Tipo de pasivo', 'Total', 'Respondieron', 'Faltan', 'Validadas'], filas_tipo)

        fila = escribir_seccion(resumen, fila, 'Matriz tipo de pasivo × estado', 10)
        celdas = {(f.tipo_nomina_id, f.estado): f.total for f in conteos.matriz}
        filas_matriz = [
            [f.tipo_nomina, *[celdas.get((f.tipo_nomina_id, estado), 0) for estado in estados],
             sum(celdas.get((f.tipo_nomina_id, estado), 0) for estado in estados)]
            for f in conteos.por_tipo
        ]
        escribir_tabla(
            resumen, fila, ['Tipo de pasivo', *estados, 'Total'], filas_matriz,
        )
        ajustar_anchos(resumen, ['Tipo de pasivo', *estados, 'Total'], filas_matriz)
        resumen.freeze_panes = 'A5'

    if incluir_listado:
        if incluir_resumen:
            listado = libro.create_sheet('Listado de pasivos')
        else:
            listado = libro.active
            listado.title = 'Listado de pasivos'

        solo_faltantes = alcance_listado in ('faltan', 'faltantes')
        columnas = ['Cédula', 'Nombre completo', 'Tipo de pasivo', 'Correo', 'Teléfono']
        if not solo_faltantes:
            columnas += ['Estado', 'Canal', 'Fecha de envío']

        filas = []
        for pasivo in pasivos:
            fila_pasivo = [pasivo.cedula, pasivo.nombre_completo, pasivo.tipo_nomina, pasivo.correo, pasivo.telefono]
            if not solo_faltantes:
                fila_pasivo += [
                    ETIQUETAS_ESTADO.get(pasivo.estado, pasivo.estado),
                    ETIQUETAS_CANAL.get(pasivo.canal, pasivo.canal),
                    pasivo.fecha_envio.strftime('%d/%m/%Y %H:%M') if pasivo.fecha_envio else '',
                ]
            filas.append(fila_pasivo)

        fila = escribir_encabezado_institucional(
            listado, titulo='Estadísticas de fe de vida · Listado de pasivos',
            subtitulo=estadisticas.proceso.nombre if estadisticas.proceso else 'Sin proceso',
            filtros=[*aplicados, ('Registros exportados', str(len(filas)))],
            generado_en=generado_en, columnas=len(columnas),
        )
        escribir_tabla(listado, fila, columnas, filas)
        ajustar_anchos(listado, columnas, filas)

    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()
