"""Generador de la plantilla Excel de carga masiva (O28-F1, FIX-CARGA1)."""
from io import BytesIO

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from apps.carga_masiva.domain.registro_campos import (
    POBLACION_ACTIVOS,
    POBLACION_PASIVOS,
    POBLACIONES,
    TIPOS_POR_CLAVE,
    Campo,
    TipoCarga,
    tipos_para,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
    TipoNominaModel,
)
from apps.catalogos.infrastructure.models.geografia_models import EstadoModel, MunicipioModel, ParroquiaModel
from apps.catalogos.infrastructure.repositories.motivos_por_categoria import (
    listar_motivos_de_operacion,
)
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CondicionViviendaModel,
    DiscapacidadModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
)
from core.domain.categorias_motivo import Operacion

AZUL = '0B4A9E'
AZUL_CLARO = 'E8EEF8'
AMARILLO = 'F59E0B'
GRIS = '6B7280'
BORDE = 'D5DAE3'
HOJA_CATALOGOS = 'Catalogos'
MAX_CATALOGO = 5000


def _catalogo(nombre: str) -> tuple[str, ...]:
    if nombre == 'sexo':
        return tuple(SexoModel.objects.values_list('sexo', flat=True))
    if nombre == 'nacionalidad':
        return tuple(NacionalidadModel.objects.values_list('nombre', flat=True))
    if nombre == 'estado_civil':
        return tuple(EstadoCivilModel.objects.values_list('estadoCivil', flat=True))
    if nombre == 'tipo_nomina':
        return tuple(TipoNominaModel.objects.values_list('nomina', flat=True))
    if nombre == 'tipo_nomina_activo':
        return tuple(TipoNominaModel.objects.filter(es_activo=True).values_list('nomina', flat=True))
    if nombre == 'tipo_nomina_pasivo':
        return tuple(TipoNominaModel.objects.filter(es_activo=False).values_list('nomina', flat=True))
    if nombre == 'motivo_pase_a_pasivo':
        return tuple(m['nombre'] for m in listar_motivos_de_operacion(Operacion.PASE_A_PASIVO))
    if nombre == 'motivo_ingreso':
        return tuple(m['nombre'] for m in listar_motivos_de_operacion(Operacion.ASIGNAR_CARGO))
    if nombre == 'parentesco':
        return tuple(ParentescoModel.objects.values_list('descripcion_parentesco', flat=True))
    if nombre == 'parentesco_familiar':
        return tuple(ParentescoModel.objects.filter(aplica_familiar=True).values_list('descripcion_parentesco', flat=True))
    if nombre == 'nivel_academico':
        return tuple(NivelAcademicoModel.objects.values_list('nivelacademico', flat=True))
    if nombre == 'condicion_vivienda':
        return tuple(CondicionViviendaModel.objects.values_list('condicion', flat=True))
    if nombre == 'alergia':
        return tuple(AlergiaModel.objects.values_list('alergia', flat=True))
    if nombre == 'patologia':
        return tuple(PatologiaCronicaModel.objects.values_list('patologia', flat=True))
    if nombre == 'discapacidad':
        return tuple(DiscapacidadModel.objects.values_list('discapacidad', flat=True))
    if nombre == 'estado':
        return tuple(EstadoModel.objects.values_list('estado', flat=True))
    if nombre == 'municipio':
        return tuple(MunicipioModel.objects.values_list('municipio', flat=True))
    if nombre == 'parroquia':
        return tuple(ParroquiaModel.objects.values_list('parroquia', flat=True))
    return ()


def _titulo(hoja, texto: str, columnas: int, fila: int = 1):
    hoja.merge_cells(start_row=fila, start_column=1, end_row=fila, end_column=max(columnas, 1))
    celda = hoja.cell(row=fila, column=1, value=texto)
    celda.font = Font(bold=True, size=12, color=AZUL)
    celda.alignment = Alignment(vertical='center')
    hoja.row_dimensions[fila].height = 20


def _encabezados(hoja, tipo: TipoCarga, fila: int, campos: tuple[Campo, ...]):
    for indice, campo in enumerate(campos, start=1):
        celda = hoja.cell(row=fila, column=indice, value=f"{campo.etiqueta}{' *' if campo.obligatorio else ''}")
        celda.font = Font(bold=True, color='FFFFFF')
        celda.fill = PatternFill('solid', start_color=AZUL if campo.obligatorio else AMARILLO)
        celda.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        nota = [
            f"Tipo: {campo.tipo}",
            f"Obligatorio: {'sí' if campo.obligatorio else 'no'}",
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
        c.catalogo for t in tipos for c in t.campos_para(poblacion) if c.catalogo
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


def _validaciones(hoja, campos: tuple[Campo, ...], fila_datos: int, rangos: dict[str, str]):
    ultima = fila_datos + 4999
    for indice, campo in enumerate(campos, start=1):
        if not campo.catalogo or campo.catalogo not in rangos:
            continue
        letra = get_column_letter(indice)
        validacion = DataValidation(type='list', formula1=f'={rangos[campo.catalogo]}', allow_blank=not campo.obligatorio)
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
    _instrucciones(libro, tipos, modo, poblacion)
    for tipo in tipos:
        campos = tipo.campos_para(poblacion)
        hoja = libro.create_sheet(tipo.hoja[:31])
        _titulo(hoja, f'{tipo.nombre} — Carga masiva de {poblacion.lower()}', len(campos), fila=1)
        _encabezados(hoja, tipo, fila=3, campos=campos)
        _fila_ejemplo(hoja, campos, fila=4)
        _validaciones(hoja, campos, fila_datos=4, rangos=rangos)
        _anchos(hoja, campos)
        for indice in range(1, len(campos) + 1):
            hoja.cell(row=2, column=indice).fill = PatternFill('solid', start_color=AZUL_CLARO)
        hoja.freeze_panes = 'A5'
    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()
