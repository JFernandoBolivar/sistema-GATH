"""Generadores asíncronos (PDF/Excel) de las estadísticas de fe de vida (O21, O25).

Los invoca el worker de `apps.exportaciones`, que depende de esta capa y nunca
al revés. Los filtros y opciones de generación se validan antes de encolar
(`validar_parametros`) para que cualquier parámetro inválido sea un 400 inmediato.
"""
from datetime import datetime
from base64 import b64decode, b64encode
from io import BytesIO
from typing import Callable

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from PIL import Image

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
    configurar_impresion,
    escribir_encabezado_institucional,
    escribir_pie,
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

# Gráficos que la pantalla puede enviar como PNG (mismos que dibuja el PDF de respaldo).
GRAFICOS_VALIDOS = ('cobertura', 'tipos', 'estados')
MAX_GRAFICOS = len(GRAFICOS_VALIDOS)
MAX_BYTES_GRAFICO = 2_000_000
MAX_LADO_GRAFICO = 2400
PREFIJO_PNG = 'data:image/png;base64,'


def validar_imagenes_graficos(valor) -> list[dict]:
    """Valida los PNG que envía la pantalla: tipo, tamaño, dimensiones y nombres únicos."""
    if valor in (None, ''):
        return []
    if not isinstance(valor, list) or len(valor) > MAX_GRAFICOS:
        raise ValidationError('Los gráficos enviados no son válidos.', campo='imagenes')
    salida, nombres = [], set()
    for item in valor:
        if not isinstance(item, dict):
            raise ValidationError('Cada gráfico debe ser un objeto con nombre y datos.', campo='imagenes')
        nombre = str(item.get('nombre') or '').strip()
        if nombre not in GRAFICOS_VALIDOS or nombre in nombres:
            raise ValidationError('El gráfico enviado no es válido.', campo='imagenes')
        datos = str(item.get('data') or '').strip()
        if datos.startswith(PREFIJO_PNG):
            datos = datos[len(PREFIJO_PNG):]
        try:
            contenido = b64decode(datos, validate=True)
        except Exception as exc:
            raise ValidationError('El gráfico enviado no es una imagen válida.', campo='imagenes') from exc
        if not contenido or len(contenido) > MAX_BYTES_GRAFICO:
            raise ValidationError('El gráfico supera el tamaño permitido.', campo='imagenes')
        try:
            with Image.open(BytesIO(contenido)) as imagen:
                imagen.verify()
            with Image.open(BytesIO(contenido)) as imagen:
                if imagen.format != 'PNG':
                    raise ValidationError('Los gráficos deben ser PNG.', campo='imagenes')
                ancho, alto = imagen.size
        except ValidationError:
            raise
        except Exception as exc:
            raise ValidationError('El gráfico enviado no es una imagen PNG válida.', campo='imagenes') from exc
        if ancho > MAX_LADO_GRAFICO or alto > MAX_LADO_GRAFICO:
            raise ValidationError('El gráfico tiene dimensiones demasiado grandes.', campo='imagenes')
        nombres.add(nombre)
        salida.append({'nombre': nombre, 'data': b64encode(contenido).decode('ascii')})
    return salida


def imagenes_para_pdf(parametros: dict) -> dict[str, bytes]:
    """Convierte los PNG validados del trabajo en bytes listos para reportlab."""
    return {
        item['nombre']: b64decode(item['data'])
        for item in validar_imagenes_graficos(parametros.get('imagenes'))
    }


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
    validar_imagenes_graficos(parametros.get('imagenes'))


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
            imagenes=imagenes_para_pdf(parametros),
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
            ['% de pasivos que respondieron', estadisticas.porcentaje_respondieron / 100],
        ]
        inicio_kpis = fila
        fila = escribir_tabla(resumen, fila, ['Indicador', 'Valor'], kpis, congelar=False) + 2
        for indice in range(len(kpis)):
            celda = resumen.cell(row=inicio_kpis + 1 + indice, column=2)
            if isinstance(celda.value, float):
                celda.number_format = '0.0%'
        ajustar_anchos(resumen, ['Indicador', 'Valor'], kpis)

        fila = escribir_seccion(resumen, fila, 'Respondieron por tipo de pasivo', 10)
        filas_tipo = [
            [f.tipo_nomina, f.total, f.respondieron, f.faltan, f.validadas]
            for f in conteos.por_tipo
        ]
        inicio_tipos = fila
        fila = escribir_tabla(
            resumen, fila, ['Tipo de pasivo', 'Total', 'Respondieron', 'Faltan', 'Validadas'], filas_tipo,
            congelar=False,
        ) + 2
        ajustar_anchos(resumen, ['Tipo de pasivo', 'Total', 'Respondieron', 'Faltan', 'Validadas'], filas_tipo)
        if filas_tipo:
            grafico = BarChart()
            grafico.type = 'col'
            grafico.style = 10
            grafico.y_axis.title = None
            grafico.x_axis.title = None
            datos = Reference(
                resumen, min_col=3, max_col=4,
                min_row=inicio_tipos, max_row=inicio_tipos + len(filas_tipo),
            )
            categorias = Reference(
                resumen, min_col=1, min_row=inicio_tipos + 1, max_row=inicio_tipos + len(filas_tipo),
            )
            grafico.add_data(datos, titles_from_data=True)
            grafico.set_categories(categorias)
            for serie, color in zip(grafico.series, ('0B4A9E', '8EC5FF')):
                serie.graphicalProperties.solidFill = color
                serie.graphicalProperties.line.solidFill = color
            grafico.height = 7
            grafico.width = 14
            resumen.add_chart(grafico, f'G{inicio_tipos}')

        fila = escribir_seccion(resumen, fila, 'Matriz tipo de pasivo × estado', 10)
        celdas = {(f.tipo_nomina_id, f.estado): f.total for f in conteos.matriz}
        etiquetas_estados = [ETIQUETAS_ESTADO.get(estado, estado) for estado in estados]
        filas_matriz = [
            [f.tipo_nomina, *[celdas.get((f.tipo_nomina_id, estado), 0) for estado in estados],
             sum(celdas.get((f.tipo_nomina_id, estado), 0) for estado in estados)]
            for f in conteos.por_tipo
        ]
        escribir_tabla(
            resumen, fila, ['Tipo de pasivo', *etiquetas_estados, 'Total'], filas_matriz,
        )
        ajustar_anchos(resumen, ['Tipo de pasivo', *etiquetas_estados, 'Total'], filas_matriz)
        escribir_pie(resumen, resumen.max_row + 2, 10, f'Generado el {generado_en:%d/%m/%Y %H:%M}')
        configurar_impresion(resumen, 10, resumen.max_row)

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
        escribir_pie(listado, listado.max_row + 2, len(columnas), f'Generado el {generado_en:%d/%m/%Y %H:%M}')
        configurar_impresion(listado, len(columnas), listado.max_row)

    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()
