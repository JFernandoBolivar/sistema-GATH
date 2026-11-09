"""Generador de la plantilla Excel de carga masiva (O28-F1, FIX-CARGA1)."""
from io import BytesIO

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

from django.db.models import Count

from apps.carga_masiva.domain.registro_campos import (
    POBLACION_ACTIVOS,
    POBLACION_PASIVOS,
    POBLACIONES,
    TIPOS_POR_CLAVE,
    Campo,
    TipoCarga,
    tipos_para,
)
from apps.cargos.infrastructure.models.cargo_models import (
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    GradoModel,
    NacionalidadModel,
    PaisModel,
    ParentescoModel,
    SexoModel,
    TipoNominaModel,
)
from apps.catalogos.infrastructure.models.geografia_models import EstadoModel, MunicipioModel, ParroquiaModel
from apps.catalogos.infrastructure.repositories.motivos_por_categoria import (
    listar_motivos_de_operacion,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
    OrganismoAdscritoModel,
)
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CarreraModel,
    CodigoPostalModel,
    CondicionViviendaModel,
    DiscapacidadModel,
    InstitucionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
    TallaModel,
)
from core.domain.categorias_motivo import Operacion

AZUL = '0B4A9E'
AZUL_CLARO = 'E8EEF8'
AMARILLO = 'F59E0B'
GRIS = '6B7280'
BORDE = 'D5DAE3'
HOJA_CATALOGOS = 'Catalogos'
MAX_CATALOGO = 5000


def _catalogo_municipio() -> tuple[str, ...]:
    repetidos = set(
        MunicipioModel.objects.values('municipio')
        .annotate(c=Count('id'))
        .filter(c__gt=1)
        .values_list('municipio', flat=True)
    )
    resultado: list[str] = []
    qs = MunicipioModel.objects.select_related('estadoid').order_by('municipio', 'estadoid__estado')
    for m in qs:
        nom = (m.municipio or '').strip()
        if not nom:
            continue
        if nom in repetidos:
            edo = (m.estadoid.estado or '').strip() if m.estadoid else ''
            resultado.append(f"{nom} ({edo})")
        else:
            resultado.append(nom)
    return tuple(dict.fromkeys(resultado))


def _catalogo_parroquia() -> tuple[str, ...]:
    repetidos = set(
        ParroquiaModel.objects.values('parroquia')
        .annotate(c=Count('id'))
        .filter(c__gt=1)
        .values_list('parroquia', flat=True)
    )
    resultado: list[str] = []
    qs = ParroquiaModel.objects.select_related('municipioid__estadoid').order_by('parroquia', 'municipioid__municipio')
    for p in qs:
        nom = (p.parroquia or '').strip()
        if not nom:
            continue
        if nom in repetidos:
            mun = (p.municipioid.municipio or '').strip() if p.municipioid else ''
            edo = (p.municipioid.estadoid.estado or '').strip() if (p.municipioid and p.municipioid.estadoid) else ''
            contexto = f"{mun} - {edo}" if (mun and edo) else (mun or edo)
            resultado.append(f"{nom} ({contexto})" if contexto else nom)
        else:
            resultado.append(nom)
    return tuple(dict.fromkeys(resultado))


def _catalogo(nombre: str) -> tuple[str, ...]:
    if nombre == 'sexo':
        return tuple(dict.fromkeys(s.strip() for s in SexoModel.objects.values_list('sexo', flat=True) if s))
    if nombre == 'nacionalidad':
        return tuple(dict.fromkeys(n.strip() for n in NacionalidadModel.objects.values_list('nombre', flat=True) if n))
    if nombre == 'estado_civil':
        return tuple(dict.fromkeys(e.strip() for e in EstadoCivilModel.objects.values_list('estadoCivil', flat=True) if e))
    if nombre == 'tipo_nomina':
        return tuple(dict.fromkeys(t.strip() for t in TipoNominaModel.objects.values_list('nomina', flat=True) if t))
    if nombre == 'tipo_nomina_activo':
        return tuple(dict.fromkeys(t.strip() for t in TipoNominaModel.objects.filter(es_activo=True).values_list('nomina', flat=True) if t))
    if nombre == 'tipo_nomina_pasivo':
        return tuple(dict.fromkeys(t.strip() for t in TipoNominaModel.objects.filter(es_activo=False).values_list('nomina', flat=True) if t))
    if nombre == 'motivo_pase_a_pasivo':
        return tuple(dict.fromkeys(str(m['nombre']).strip() for m in listar_motivos_de_operacion(Operacion.PASE_A_PASIVO) if m.get('nombre')))
    if nombre == 'motivo_ingreso':
        return tuple(dict.fromkeys(str(m['nombre']).strip() for m in listar_motivos_de_operacion(Operacion.ASIGNAR_CARGO) if m.get('nombre')))
    if nombre == 'parentesco':
        return tuple(dict.fromkeys(p.strip() for p in ParentescoModel.objects.values_list('descripcion_parentesco', flat=True) if p))
    if nombre == 'parentesco_familiar':
        return tuple(dict.fromkeys(p.strip() for p in ParentescoModel.objects.filter(aplica_familiar=True).values_list('descripcion_parentesco', flat=True) if p))
    if nombre == 'nivel_academico':
        return tuple(dict.fromkeys(n.strip() for n in NivelAcademicoModel.objects.values_list('nivelacademico', flat=True) if n))
    if nombre == 'carrera':
        return tuple(dict.fromkeys(c.strip() for c in CarreraModel.objects.values_list('nombre_carrera', flat=True) if c))
    if nombre == 'institucion':
        return tuple(dict.fromkeys(i.strip() for i in InstitucionModel.objects.values_list('nombre_institucion', flat=True) if i))
    if nombre == 'condicion_vivienda':
        return tuple(dict.fromkeys(c.strip() for c in CondicionViviendaModel.objects.values_list('condicion', flat=True) if c))
    if nombre == 'alergia':
        return tuple(dict.fromkeys(a.strip() for a in AlergiaModel.objects.values_list('alergia', flat=True) if a))
    if nombre == 'patologia':
        return tuple(dict.fromkeys(p.strip() for p in PatologiaCronicaModel.objects.values_list('patologia', flat=True) if p))
    if nombre == 'discapacidad':
        return tuple(dict.fromkeys(d.strip() for d in DiscapacidadModel.objects.values_list('discapacidad', flat=True) if d))
    if nombre == 'estado':
        return tuple(dict.fromkeys(e.strip() for e in EstadoModel.objects.values_list('estado', flat=True) if e))
    if nombre == 'municipio':
        return _catalogo_municipio()
    if nombre == 'parroquia':
        return _catalogo_parroquia()
    if nombre == 'organismo':
        return tuple(dict.fromkeys(o.strip() for o in OrganismoAdscritoModel.objects.values_list('Organismoadscrito', flat=True) if o))
    if nombre == 'pais':
        return tuple(dict.fromkeys(p.strip() for p in PaisModel.objects.values_list('nombre', flat=True) if p))
    if nombre == 'talla_camisa':
        return tuple(dict.fromkeys(t.strip() for t in TallaModel.objects.filter(tipo_prenda__categoria__icontains='camisa').values_list('valor', flat=True) if t))
    if nombre == 'talla_pantalon':
        return tuple(dict.fromkeys(t.strip() for t in TallaModel.objects.filter(tipo_prenda__categoria__icontains='pantalon').values_list('valor', flat=True) if t))
    if nombre == 'talla_zapato':
        return tuple(dict.fromkeys(t.strip() for t in TallaModel.objects.filter(tipo_prenda__categoria__icontains='zapato').values_list('valor', flat=True) if t))
    if nombre == 'codigo_postal':
        return tuple(dict.fromkeys(
            c.strip() for c in CodigoPostalModel.objects.values_list('codigo', flat=True) if c
        ))
    if nombre == 'denominacion_cargo':
        return tuple(dict.fromkeys(
            c.strip() for c in DenominacionCargoModel.objects.values_list('cargo', flat=True) if c
        ))
    if nombre == 'denominacion_cargo_especifica':
        return tuple(dict.fromkeys(
            c.strip() for c in DenominacionCargoEspecificoModel.objects.values_list('cargo', flat=True) if c
        ))
    if nombre == 'dependencia':
        return tuple(dict.fromkeys(
            d.strip() for d in DependenciaModel.objects.values_list('dependencia', flat=True) if d
        ))
    if nombre == 'direccion_general':
        return tuple(dict.fromkeys(
            d.strip() for d in DireccionGeneralModel.objects.values_list('direccion_general', flat=True) if d
        ))
    if nombre == 'direccion_linea':
        return tuple(dict.fromkeys(
            d.strip() for d in DireccionLineaModel.objects.values_list('direccion_linea', flat=True) if d
        ))
    if nombre == 'coordinacion':
        return tuple(dict.fromkeys(
            c.strip() for c in CoordinacionModel.objects.values_list('coordinacion', flat=True) if c
        ))
    if nombre == 'grado':
        return tuple(dict.fromkeys(
            g.strip() for g in GradoModel.objects.values_list('grado', flat=True) if g
        ))
    return ()


def _titulo(hoja, texto: str, columnas: int, fila: int = 1):
    hoja.merge_cells(start_row=fila, start_column=1, end_row=fila, end_column=max(columnas, 1))
    celda = hoja.cell(row=fila, column=1, value=texto)
    celda.font = Font(bold=True, size=12, color=AZUL)
    celda.alignment = Alignment(vertical='center')
    hoja.row_dimensions[fila].height = 20


def _encabezados(
    hoja, tipo: TipoCarga, fila: int, campos: tuple[Campo, ...], poblacion: str,
):
    for indice, campo in enumerate(campos, start=1):
        obligatorio = campo.es_obligatorio(poblacion)
        celda = hoja.cell(row=fila, column=indice, value=f"{campo.etiqueta}{' *' if obligatorio else ''}")
        celda.font = Font(bold=True, color='FFFFFF')
        celda.fill = PatternFill('solid', start_color=AZUL if obligatorio else AMARILLO)
        celda.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        nota = [
            f"Tipo: {campo.tipo}",
            f"Obligatorio: {'sí' if obligatorio else 'no'}",
        ]
        if campo.formato:
            nota.append(f"Formato: {campo.formato}")
        if campo.ayuda:
            nota.append(campo.ayuda)
        if campo.catalogo:
            nota.append(f"Use un valor de la lista (catálogo {campo.catalogo}).")
        celda.comment = Comment('\n'.join(nota), 'GATH')
    hoja.row_dimensions[fila].height = 34
    hoja.freeze_panes = f'A{fila + 2}'
    hoja.auto_filter.ref = f'A{fila}:{get_column_letter(len(campos))}{fila + 2000}'


def _fila_ejemplo(hoja, campos: tuple[Campo, ...], fila: int):
    for indice, campo in enumerate(campos, start=1):
        celda = hoja.cell(row=fila, column=indice, value=campo.ejemplo or '')
        celda.font = Font(italic=True, color=GRIS)
        celda.fill = PatternFill('solid', start_color=AZUL_CLARO)
        celda.alignment = Alignment(vertical='top')
    for indice in range(1, len(campos) + 1):
        hoja.cell(row=fila, column=indice).comment = Comment('Fila de ejemplo: elimínela antes de cargar.', 'GATH')


def _anchos(hoja, campos: tuple[Campo, ...]):
    for indice, campo in enumerate(campos, start=1):
        largo = max(len(campo.etiqueta) + 2, len(campo.ejemplo) + 2, 14)
        hoja.column_dimensions[get_column_letter(indice)].width = min(max(14, largo), 42)


def _hoja_catalogos(libro: Workbook, tipos: list[TipoCarga], poblacion: str) -> dict[str, str]:
    requeridos = sorted({
        c.catalogo for t in tipos for c in t.campos_para(poblacion)
        # FIX-CARGA3: el código postal se sirve como lista dependiente del
        # estado en su propia hoja oculta, no en el catálogo plano.
        if c.catalogo and c.catalogo != 'codigo_postal'
    })
    hoja = libro.create_sheet(HOJA_CATALOGOS)
    hoja.sheet_state = 'hidden'
    rangos: dict[str, str] = {}
    for columna, nombre in enumerate(requeridos, start=1):
        letra = get_column_letter(columna)
        hoja.cell(row=1, column=columna, value=nombre).font = Font(bold=True)
        valores = _catalogo(nombre)[:MAX_CATALOGO]
        for fila, valor in enumerate(valores, start=2):
            hoja.cell(row=fila, column=columna, value=valor)
        if valores:
            rangos[nombre] = f"'{HOJA_CATALOGOS}'!${letra}$2:${letra}${len(valores) + 1}"
        hoja.column_dimensions[letra].width = 30
    return rangos


HOJA_CODIGOS_POSTALES = 'CodigosPostales'
HOJA_ESTADOS_CP = 'EstadosCodigosPostales'


def _hoja_codigos_postales(libro: Workbook, tipos: list[TipoCarga], poblacion: str) -> int:
    """Hoja oculta con un rango por estado para la lista dependiente del código postal.

    Devuelve cuántos estados se sembraron (0 si ninguna hoja usa el campo).
    """
    if not any(
        c.catalogo == 'codigo_postal'
        for t in tipos for c in t.campos_para(poblacion)
    ):
        return 0
    estados = list(EstadoModel.objects.order_by('estado').values_list('id', 'estado'))
    por_estado: dict[int, list[str]] = {}
    for estado_id, codigo in CodigoPostalModel.objects.order_by(
        'estado_id_id', 'codigo',
    ).values_list('estado_id_id', 'codigo'):
        if codigo:
            por_estado.setdefault(estado_id, []).append(str(codigo).strip())

    hoja = libro.create_sheet(HOJA_CODIGOS_POSTALES)
    hoja.sheet_state = 'hidden'
    hoja_estados = libro.create_sheet(HOJA_ESTADOS_CP)
    hoja_estados.sheet_state = 'hidden'
    hoja_estados.cell(row=1, column=1, value='estado')
    for indice, (estado_id, nombre) in enumerate(estados, start=1):
        letra = get_column_letter(indice)
        hoja_estados.cell(row=indice + 1, column=1, value=nombre)
        codigos = por_estado.get(estado_id, [])
        for fila, codigo in enumerate(codigos, start=2):
            hoja.cell(row=fila, column=indice, value=codigo)
        fila_fin = max(len(codigos), 1) + 1
        libro.defined_names.add(DefinedName(
            f'CP_{indice}',
            attr_text=f"'{HOJA_CODIGOS_POSTALES}'!${letra}$2:${letra}${fila_fin}",
        ))
    return len(estados)


HOJA_NIVELES_DG = 'NivelesDirecciones'
HOJA_DG_LINEAS = 'DireccionesLineas'
HOJA_LINEA_COORD = 'LineasCoordinaciones'


def _hoja_dependencias(libro: Workbook, tipos: list[TipoCarga], poblacion: str) -> dict | None:
    """Hojas ocultas con la jerarquía nivel → dirección → línea → coordinación.

    Devuelve los conteos para las fórmulas INDIRECT (o None si la plantilla no
    incluye cargo y asignación).
    """
    if not any(t.clave == 'cargo_asignacion' and t.aplica_a(poblacion) for t in tipos):
        return None

    dependencias = list(
        DependenciaModel.objects.order_by('dependencia').values_list('id', 'dependencia')
    )
    dgs = list(
        DireccionGeneralModel.objects.order_by('direccion_general').values_list(
            'id', 'direccion_general',
        )
    )
    lineas = list(
        DireccionLineaModel.objects.order_by('direccion_linea').values_list(
            'id', 'direccion_linea',
        )
    )
    dg_por_dependencia: dict[int, list[str]] = {}
    for _dg_id, nombre, dependencia_id in DireccionGeneralModel.objects.order_by(
        'direccion_general',
    ).values_list('id', 'direccion_general', 'dependenciaId_id'):
        dg_por_dependencia.setdefault(dependencia_id, []).append(nombre)
    lineas_por_dg: dict[int, list[str]] = {}
    for _dl_id, nombre, dg_id in DireccionLineaModel.objects.order_by(
        'direccion_linea',
    ).values_list('id', 'direccion_linea', 'direccionGeneral_id'):
        lineas_por_dg.setdefault(dg_id, []).append(nombre)
    coords_por_linea: dict[int, list[str]] = {}
    for _co_id, nombre, linea_id in CoordinacionModel.objects.order_by(
        'coordinacion',
    ).values_list('id', 'coordinacion', 'direccionLinea_id'):
        coords_por_linea.setdefault(linea_id, []).append(nombre)

    hoja_niveles = libro.create_sheet(HOJA_NIVELES_DG)
    hoja_dg = libro.create_sheet(HOJA_DG_LINEAS)
    hoja_linea = libro.create_sheet(HOJA_LINEA_COORD)
    for hoja, titulo in (
        (hoja_niveles, 'Nivel / Dependencia'),
        (hoja_dg, 'Dirección general'),
        (hoja_linea, 'Dirección de línea'),
    ):
        hoja.sheet_state = 'hidden'
        hoja.cell(row=1, column=1, value=titulo)

    def sembrar(hoja, base, hijos, prefijo):
        for indice, (padre_id, padre_nombre) in enumerate(base, start=1):
            hoja.cell(row=indice + 1, column=1, value=padre_nombre)
            letra = get_column_letter(indice + 1)
            valores = hijos.get(padre_id, [])
            for fila, valor in enumerate(valores, start=2):
                hoja.cell(row=fila, column=indice + 1, value=valor)
            fin = max(len(valores), 1) + 1
            libro.defined_names.add(DefinedName(
                f'{prefijo}_{indice}',
                attr_text=f"'{hoja.title}'!${letra}$2:${letra}${fin}",
            ))

    sembrar(hoja_niveles, dependencias, dg_por_dependencia, 'DG')
    sembrar(hoja_dg, dgs, lineas_por_dg, 'DL')
    sembrar(hoja_linea, lineas, coords_por_linea, 'CO')
    return {
        'niveles': len(dependencias),
        'dgs': len(dgs),
        'lineas': len(lineas),
    }


def _validaciones(
    hoja, campos: tuple[Campo, ...], fila_datos: int, rangos: dict[str, str],
    poblacion: str, estados_cp: int, dependencias: dict | None = None,
):
    ultima = fila_datos + 4999
    for indice, campo in enumerate(campos, start=1):
        if dependencias and campo.catalogo in (
            'direccion_general', 'direccion_linea', 'coordinacion',
        ):
            config = {
                'direccion_general': (
                    'dependencia_id', HOJA_NIVELES_DG, 'DG', dependencias['niveles'],
                ),
                'direccion_linea': (
                    'direccion_general_id', HOJA_DG_LINEAS, 'DL', dependencias['dgs'],
                ),
                'coordinacion': (
                    'direccion_linea_id', HOJA_LINEA_COORD, 'CO', dependencias['lineas'],
                ),
            }[campo.catalogo]
            padre, hoja_dependencia, prefijo, total = config
            indice_padre = next(
                (i for i, c in enumerate(campos, start=1) if c.clave == padre),
                None,
            )
            if indice_padre is not None and total:
                letra = get_column_letter(indice)
                letra_padre = get_column_letter(indice_padre)
                formula = (
                    f'=INDIRECT("{prefijo}_"&MATCH(${letra_padre}{fila_datos},'
                    f"'{hoja_dependencia}'!$A$2:$A${total + 1},0))"
                )
                validacion = DataValidation(
                    type='list', formula1=formula,
                    allow_blank=not campo.es_obligatorio(poblacion),
                )
                validacion.error = (
                    f'Elija {campo.etiqueta.lower()} del listado del padre seleccionado.'
                )
                validacion.errorTitle = f'{campo.etiqueta} no válido'
                validacion.prompt = 'Seleccione primero el nivel superior.'
                validacion.promptTitle = campo.etiqueta
                hoja.add_data_validation(validacion)
                validacion.add(f'{letra}{fila_datos}:{letra}{ultima}')
            continue
        if campo.catalogo == 'codigo_postal' and estados_cp:
            # La lista depende del estado de la misma fila: `INDIRECT` al rango
            # nombrado del estado elegido (CP_1, CP_2, ...).
            letra = get_column_letter(indice)
            indice_estado = next(
                (i for i, c in enumerate(campos, start=1) if c.clave == 'estado_id'),
                None,
            )
            if indice_estado is None:
                continue
            letra_estado = get_column_letter(indice_estado)
            formula = (
                f'=INDIRECT("CP_"&MATCH(${letra_estado}{fila_datos},'
                f"'{HOJA_ESTADOS_CP}'!$A$2:$A${estados_cp + 1},0))"
            )
            validacion = DataValidation(
                type='list', formula1=formula,
                allow_blank=not campo.es_obligatorio(poblacion),
            )
            validacion.error = 'Elija un código postal del estado seleccionado.'
            validacion.errorTitle = f'{campo.etiqueta} no válido'
            validacion.prompt = 'Seleccione el estado primero y luego el código postal.'
            validacion.promptTitle = campo.etiqueta
            hoja.add_data_validation(validacion)
            validacion.add(f'{letra}{fila_datos}:{letra}{ultima}')
            continue
        if not campo.catalogo or campo.catalogo not in rangos:
            continue
        letra = get_column_letter(indice)
        validacion = DataValidation(
            type='list', formula1=f'={rangos[campo.catalogo]}',
            allow_blank=not campo.es_obligatorio(poblacion),
        )
        validacion.error = 'Elija un valor de la lista.'
        validacion.errorTitle = f'{campo.etiqueta} no válido'
        validacion.prompt = f'Seleccione {campo.etiqueta.lower()} del catálogo.'
        validacion.promptTitle = campo.etiqueta
        hoja.add_data_validation(validacion)
        validacion.add(f'{letra}{fila_datos}:{letra}{ultima}')


def _instrucciones(libro: Workbook, tipos: list[TipoCarga], modo: str, poblacion: str):
    hoja = libro.create_sheet('Instrucciones', 0)
    hoja.sheet_view.showGridLines = False
    nombre_poblacion = 'personal activo' if poblacion == POBLACION_ACTIVOS else 'personal pasivo'
    _titulo(hoja, f'Carga masiva de {nombre_poblacion} — Instrucciones', 4)
    filas = [
        ('1. Población', nombre_poblacion.upper()),
        ('2. Tipos incluidos en esta plantilla', ', '.join(t.nombre for t in tipos)),
        ('3. Modo de campos', 'Obligatorios: solo las columnas con * son exigidas.' if modo == 'obligatorios' else 'Completo: todas las columnas son opcionales salvo las marcadas con *.'),
        ('4. Fila de ejemplo', 'La fila 4 de cada hoja es un ejemplo y se ignora al analizar. Puede eliminarla.'),
        ('5. Una hoja por tipo', 'Cada pestaña corresponde a un tipo de carga. No cambie los nombres de las hojas ni de las columnas.'),
        ('6. Listas desplegables', 'Las columnas de catálogo tienen lista desde los catálogos reales del sistema (hoja oculta Catalogos).'),
        ('7. Identificación', 'El trabajador se identifica por cédula. El familiar por cédula del titular + cédula del familiar; un hijo menor de 9 sin cédula se identifica por titular + nombres + fecha de nacimiento y puede indicar el orden.'),
        ('8. Celdas vacías', 'Una celda vacía no borra el dato existente. Para vaciar un campo escriba BORRAR.'),
        ('9. Fechas', 'Use el formato AAAA-MM-DD.'),
        ('10. Validación', 'Al subir el archivo se analiza sin guardar. Solo las filas sin error se aplican.'),
        ('11. Cambio de condición', (
            'Si la cédula está ACTIVA y esta carga es de PASIVOS, complete Fecha de egreso, '
            'Motivo del pase a pasivo y Tipo de nómina de pasivo. La fila queda «Requiere confirmación» '
            'hasta que el usuario confirme el movimiento. El estatus no se escribe: lo define el movimiento.'
            if poblacion == POBLACION_PASIVOS else
            'Si la cédula está PASIVA y esta carga es de ACTIVOS, complete Código de cargo y Motivo del '
            'ingreso o reingreso. La fila queda «Requiere confirmación» hasta que el usuario confirme el '
            'movimiento. El estatus no se escribe: lo define el movimiento.'
        )),
        ('12. Aprobación', 'Si la configuración lo exige, otra persona con permiso debe aprobar la carga antes de aplicarla.'),
        ('13. Código postal', 'Obligatorio si el país es Venezuela. Primero elija el estado; la lista solo muestra los códigos de ese estado. Si reside en el exterior, déjelo vacío.'),
        ('14. Posible duplicado', 'Una cédula nueva con los mismos nombres, apellidos y fecha de nacimiento de otra persona queda como «Posible duplicado» y solo se registra con confirmación explícita.'),
    ]
    for fila, (titulo, detalle) in enumerate(filas, start=3):
        hoja.cell(row=fila, column=1, value=titulo).font = Font(bold=True, color=AZUL)
        hoja.merge_cells(start_row=fila, start_column=2, end_row=fila, end_column=4)
        celda = hoja.cell(row=fila, column=2, value=detalle)
        celda.alignment = Alignment(wrap_text=True, vertical='top')
        hoja.row_dimensions[fila].height = 32
    hoja.column_dimensions['A'].width = 36
    for letra in ('B', 'C', 'D'):
        hoja.column_dimensions[letra].width = 30


def generar_plantilla(
    claves: list[str] | None = None,
    modo: str = 'obligatorios',
    poblacion: str = POBLACION_ACTIVOS,
) -> bytes:
    from core.domain.exceptions import ValidationError

    poblacion = str(poblacion or POBLACION_ACTIVOS).strip().upper()
    if poblacion not in POBLACIONES:
        raise ValidationError('La población debe ser «ACTIVOS» o «PASIVOS».', campo='poblacion')
    if modo not in ('obligatorios', 'completo'):
        raise ValidationError('El modo debe ser «obligatorios» o «completo».', campo='modo')
    invalidos = [c for c in (claves or []) if c not in TIPOS_POR_CLAVE]
    if invalidos:
        raise ValidationError('Tipo de carga no válido: ' + ', '.join(invalidos) + '.', campo='tipos')
    no_aplican = [
        c for c in (claves or [])
        if c in TIPOS_POR_CLAVE and not TIPOS_POR_CLAVE[c].aplica_a(poblacion)
    ]
    if no_aplican:
        raise ValidationError(
            'Tipo de carga no disponible para la población: ' + ', '.join(no_aplican) + '.',
            campo='tipos',
        )
    tipos = tipos_para(claves, poblacion)
    if not tipos:
        raise ValidationError('Debe indicar al menos un tipo de carga válido.', campo='tipos')
    libro = Workbook()
    libro.remove(libro.active)
    rangos = _hoja_catalogos(libro, tipos, poblacion)
    estados_cp = _hoja_codigos_postales(libro, tipos, poblacion)
    dependencias = _hoja_dependencias(libro, tipos, poblacion)
    _instrucciones(libro, tipos, modo, poblacion)
    for tipo in tipos:
        campos = tipo.campos_para(poblacion)
        hoja = libro.create_sheet(tipo.hoja[:31])
        _titulo(hoja, f'{tipo.nombre} — Carga masiva de {poblacion.lower()}', len(campos), fila=1)
        _encabezados(hoja, tipo, fila=3, campos=campos, poblacion=poblacion)
        _fila_ejemplo(hoja, campos, fila=4)
        _validaciones(
            hoja, campos, fila_datos=4, rangos=rangos,
            poblacion=poblacion, estados_cp=estados_cp, dependencias=dependencias,
        )
        _anchos(hoja, campos)
        for indice in range(1, len(campos) + 1):
            hoja.cell(row=2, column=indice).fill = PatternFill('solid', start_color=AZUL_CLARO)
        hoja.freeze_panes = 'A5'
    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()
