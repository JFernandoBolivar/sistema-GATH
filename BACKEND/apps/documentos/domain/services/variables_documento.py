"""
Catálogo único de variables de los documentos digitales (F-1).

Es lo que el sistema conoce del postulante / trabajador y lo que una plantilla puede
estampar. Lo comparten: la validación de las plantillas, el motor de PDF, la vista previa
(datos de ejemplo) y la ayuda del diseñador. Las variables se escriben `{clave}` dentro de
un texto; los «campos propios del documento» se escriben `{propio.<clave>}`.

Tres clases de variable:
  - ``texto`` / ``fecha`` / ``si_no``: un valor escalar.
  - ``imagen``: la fotografía (bytes o nada); solo la usan los bloques/campos de foto.
  - ``coleccion``: una lista de filas (familiares, estudios...) con ``columnas`` propias; solo la
    usan las tablas.

Las colecciones de la Ventana 2 ampliada (estudios, cursos, antecedentes, idiomas) y el RIF se
declaran desde ya, aunque hoy el proveedor de datos las entregue vacías.
"""
import re
from datetime import date, datetime

PREFIJO_PROPIO = 'propio.'

TIPOS_ESCALARES = ('texto', 'fecha', 'si_no')
_REGEX_VARIABLE = re.compile(r'\{([a-z][a-z0-9_.]*)\}')
_REGEX_CLAVE_PROPIA = re.compile(r'^[a-z][a-z0-9_]{0,39}$')

MESES_ES = (
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
)


def _v(clave, etiqueta, descripcion, grupo, ejemplo, tipo='texto'):
    return {'clave': clave, 'etiqueta': etiqueta, 'descripcion': descripcion, 'grupo': grupo,
            'tipo': tipo, 'ejemplo': ejemplo}


def _col(clave, etiqueta, ejemplo):
    return {'clave': clave, 'etiqueta': etiqueta, 'ejemplo': ejemplo}


def _coleccion(clave, etiqueta, descripcion, grupo, columnas, filas_ejemplo):
    return {'clave': clave, 'etiqueta': etiqueta, 'descripcion': descripcion, 'grupo': grupo,
            'tipo': 'coleccion', 'columnas': columnas, 'ejemplo': filas_ejemplo}


G_IDENT, G_CONTACTO, G_DIR, G_LAB, G_DOC, G_SALUD, G_TALLAS, G_COL = (
    'Identidad', 'Contacto', 'Dirección y vivienda', 'Cargo y nómina propuestos',
    'Documento', 'Salud', 'Tallas', 'Listas (tablas)',
)

CATALOGO_VARIABLES: list[dict] = [
    # Identidad
    _v('nombres', 'Nombres', 'Nombres de pila', G_IDENT, 'JUAN ALBERTO'),
    _v('apellidos', 'Apellidos', 'Apellidos', G_IDENT, 'PÉREZ RODRÍGUEZ'),
    _v('nombre_completo', 'Apellidos y nombres', 'Apellidos seguidos de los nombres', G_IDENT, 'PÉREZ RODRÍGUEZ JUAN ALBERTO'),
    _v('cedula', 'Cédula de identidad', 'Número de cédula con la letra de nacionalidad', G_IDENT, 'V-18456789'),
    _v('cedula_numero', 'Cédula (solo número)', 'Número de cédula sin la letra', G_IDENT, '18456789'),
    _v('nacionalidad', 'Nacionalidad', 'VENEZOLANO o EXTRANJERO', G_IDENT, 'VENEZOLANO'),
    _v('sexo', 'Sexo', 'MASCULINO o FEMENINO', G_IDENT, 'MASCULINO'),
    _v('estado_civil', 'Estado civil', 'SOLTERO, CASADO, DIVORCIADO, VIUDO o UNIDO', G_IDENT, 'CASADO'),
    _v('fecha_nacimiento', 'Fecha de nacimiento', 'DD/MM/AAAA', G_IDENT, '15/03/1988', 'fecha'),
    _v('lugar_nacimiento', 'Lugar de nacimiento', 'País y estado de nacimiento', G_IDENT, 'VENEZUELA, DISTRITO CAPITAL'),
    _v('edad', 'Edad', 'Años cumplidos', G_IDENT, '38'),
    _v('rif', 'RIF', 'Registro de Información Fiscal (Ventana 2 ampliada)', G_IDENT, 'V-184567890'),
    _v('profesion', 'Profesión u oficio', 'Profesión declarada', G_IDENT, 'INGENIERO EN TELECOMUNICACIONES'),
    _v('numero_colegio', 'N.º de colegio profesional', 'Número de inscripción en el colegio', G_IDENT, '123456'),
    _v('foto', 'Fotografía', 'Foto tipo carnet del postulante', G_IDENT, None, 'imagen'),
    # Contacto
    _v('telefono_principal', 'Teléfono principal', 'Teléfono de habitación con código de país', G_CONTACTO, '+58 212 5550101'),
    _v('telefono_celular', 'Teléfono celular', 'Teléfono móvil con código de país', G_CONTACTO, '+58 414 5550123'),
    _v('correo', 'Correo electrónico', 'Correo personal', G_CONTACTO, 'juan.perez@example.com'),
    _v('contacto_emergencia', 'Contacto de emergencia', 'Nombre y teléfono del contacto de emergencia', G_CONTACTO, 'MARÍA PÉREZ - +58 414 5550999'),
    # Dirección y vivienda
    _v('estado_residencia', 'Estado', 'Estado de residencia', G_DIR, 'DISTRITO CAPITAL'),
    _v('municipio', 'Municipio', 'Municipio de residencia', G_DIR, 'LIBERTADOR'),
    _v('parroquia', 'Parroquia', 'Parroquia de residencia', G_DIR, 'EL RECREO'),
    _v('direccion', 'Dirección de habitación', 'Dirección completa de habitación', G_DIR, 'AV. FRANCISCO DE MIRANDA, EDIF. LAS DELICIAS, PISO 3, APTO. 3-B'),
    _v('direccion_alterna', 'Otra dirección donde localizarlo', 'Dirección alterna', G_DIR, 'CALLE LOS MANGOS, CASA 12, LOS TEQUES'),
    _v('tipo_vivienda', 'Tipo de vivienda', 'CASA, QUINTA, APARTAMENTO, HOTEL/PENSION, HABITACION, VIVIENDA RUSTICA u OTRA', G_DIR, 'APARTAMENTO'),
    _v('tenencia_vivienda', 'Tenencia de la vivienda', 'PROPIA O PAGADA, PROPIA PAGANDO, ALQUILADA o GRATUITA', G_DIR, 'ALQUILADA'),
    _v('monto_vivienda', 'Monto mensual de la vivienda', 'Lo que se paga por la vivienda', G_DIR, '250,00'),
    # Cargo y nómina propuestos
    _v('cargo', 'Cargo propuesto', 'Denominación del cargo asignado', G_LAB, 'ESPECIALISTA EN TELECOMUNICACIONES'),
    _v('codigo_cargo', 'Código del cargo', 'Código del puesto', G_LAB, 'ADM-042'),
    _v('oficina', 'Oficina / Gerencia de adscripción', 'Dependencia a la que se asigna', G_LAB, 'GERENCIA DE OPERACIONES'),
    _v('division', 'División', 'División de adscripción', G_LAB, 'DIVISIÓN DE REDES'),
    _v('coordinacion', 'Coordinación', 'Coordinación de adscripción', G_LAB, 'COORDINACIÓN DE ESPECTRO'),
    _v('ubicacion_fisica', 'Ubicación física', 'Piso, extensión y fax', G_LAB, 'PISO 4, EXT. 1234'),
    _v('nomina', 'Nómina', 'Tipo de nómina propuesta (FUNCIONARIO, EMPLEADO, OBRERO, CONTRATADO...)', G_LAB, 'FUNCIONARIO'),
    _v('tipo_empleado', 'Tipo de empleado', 'FIJO, CONTRATADO, OBRERO o JUBILADO', G_LAB, 'FIJO'),
    _v('fecha_ingreso', 'Fecha de ingreso', 'Fecha prevista de ingreso (DD/MM/AAAA)', G_LAB, '01/12/2026', 'fecha'),
    _v('codigo_empleado', 'Código de empleado', 'Código asignado al trabajador', G_LAB, '004512'),
    # Documento
    _v('numero_expediente', 'N.º de expediente', 'Número del expediente de postulación', G_DOC, 'EXP-2026-00123'),
    _v('fecha_hoy', 'Fecha de hoy', 'Fecha de emisión (DD/MM/AAAA)', G_DOC, '24/11/2026', 'fecha'),
    _v('fecha_larga', 'Fecha de hoy en texto', 'Ej.: 24 de noviembre de 2026', G_DOC, '24 de noviembre de 2026', 'fecha'),
    _v('dia', 'Día', 'Día del mes de hoy', G_DOC, '24'),
    _v('mes', 'Mes', 'Mes de hoy (número)', G_DOC, '11'),
    _v('anio', 'Año', 'Año de hoy', G_DOC, '2026'),
    # Salud
    _v('grupo_sanguineo', 'Grupo sanguíneo', 'Grupo y factor', G_SALUD, 'O+'),
    _v('alergias', 'Alergias', 'Alergias declaradas', G_SALUD, 'NINGUNA'),
    _v('condiciones_salud', 'Condiciones de salud', 'Patologías o condiciones declaradas', G_SALUD, 'NINGUNA'),
    _v('discapacidad', 'Discapacidad', 'Sí/No', G_SALUD, 'NO', 'si_no'),
    # Tallas
    _v('talla_camisa', 'Talla de camisa', 'Talla de camisa o franela', G_TALLAS, 'M'),
    _v('talla_pantalon', 'Talla de pantalón', 'Talla de pantalón', G_TALLAS, '32'),
    _v('talla_calzado', 'Talla de calzado', 'Talla de calzado', G_TALLAS, '41'),
    # Colecciones
    _coleccion('familiares', 'Grupo familiar', 'Dependientes: cónyuge, hijos, ascendientes', G_COL, [
        _col('nombre_completo', 'Nombres y apellidos', 'MARÍA GÓMEZ DE PÉREZ'),
        _col('parentesco', 'Parentesco', 'CÓNYUGE'),
        _col('sexo', 'Sexo', 'F'),
        _col('cedula', 'Cédula', 'V-19876543'),
        _col('fecha_nacimiento', 'Fecha de nacimiento', '02/07/1990'),
        _col('edad', 'Edad', '36'),
        _col('ocupacion', 'Ocupación', 'DOCENTE'),
    ], [
        {'nombre_completo': 'MARÍA GÓMEZ DE PÉREZ', 'parentesco': 'CÓNYUGE', 'sexo': 'F', 'cedula': 'V-19876543',
         'fecha_nacimiento': '02/07/1990', 'edad': '36', 'ocupacion': 'DOCENTE'},
        {'nombre_completo': 'SOFÍA PÉREZ GÓMEZ', 'parentesco': 'HIJA', 'sexo': 'F', 'cedula': 'V-31234567',
         'fecha_nacimiento': '10/01/2015', 'edad': '11', 'ocupacion': 'ESTUDIANTE'},
    ]),
    _coleccion('estudios', 'Formación académica', 'Estudios realizados (Ventana 2 ampliada)', G_COL, [
        _col('nivel', 'Nivel', 'UNIVERSITARIO'),
        _col('titulo', 'Título obtenido', 'INGENIERO EN TELECOMUNICACIONES'),
        _col('institucion', 'Institución', 'UNIVERSIDAD CENTRAL DE VENEZUELA'),
        _col('fecha_grado', 'Fecha de grado', '15/07/2011'),
    ], [{'nivel': 'UNIVERSITARIO', 'titulo': 'INGENIERO EN TELECOMUNICACIONES',
         'institucion': 'UNIVERSIDAD CENTRAL DE VENEZUELA', 'fecha_grado': '15/07/2011'}]),
    _coleccion('cursos', 'Cursos y capacitación', 'Cursos y talleres realizados (Ventana 2 ampliada)', G_COL, [
        _col('nombre', 'Curso', 'GESTIÓN DEL ESPECTRO RADIOELÉCTRICO'),
        _col('institucion', 'Institución', 'CONATEL'),
        _col('horas', 'Horas', '40'),
        _col('fecha', 'Fecha', '10/05/2019'),
    ], [{'nombre': 'GESTIÓN DEL ESPECTRO RADIOELÉCTRICO', 'institucion': 'CONATEL', 'horas': '40', 'fecha': '10/05/2019'}]),
    _coleccion('antecedentes', 'Antecedentes de servicio', 'Cargos previos en la Administración Pública u otras empresas (Ventana 2 ampliada)', G_COL, [
        _col('institucion', 'Institución', 'MINISTERIO DEL PODER POPULAR PARA LA COMUNICACIÓN'),
        _col('cargo', 'Cargo', 'ANALISTA'),
        _col('desde', 'Desde', '01/02/2012'),
        _col('hasta', 'Hasta', '30/06/2018'),
        _col('motivo_egreso', 'Motivo de egreso', 'RENUNCIA'),
    ], [{'institucion': 'MINISTERIO DEL PODER POPULAR PARA LA COMUNICACIÓN', 'cargo': 'ANALISTA',
         'desde': '01/02/2012', 'hasta': '30/06/2018', 'motivo_egreso': 'RENUNCIA'}]),
    _coleccion('idiomas', 'Idiomas', 'Idiomas que domina (Ventana 2 ampliada)', G_COL, [
        _col('idioma', 'Idioma', 'INGLÉS'),
        _col('habla', 'Habla', 'BUENO'),
        _col('lee', 'Lee', 'BUENO'),
        _col('escribe', 'Escribe', 'REGULAR'),
    ], [{'idioma': 'INGLÉS', 'habla': 'BUENO', 'lee': 'BUENO', 'escribe': 'REGULAR'}]),
]

POR_CLAVE: dict[str, dict] = {v['clave']: v for v in CATALOGO_VARIABLES}
CLAVES_ESCALARES = frozenset(v['clave'] for v in CATALOGO_VARIABLES if v['tipo'] in TIPOS_ESCALARES)
CLAVES_COLECCION = frozenset(v['clave'] for v in CATALOGO_VARIABLES if v['tipo'] == 'coleccion')
CLAVES_IMAGEN = frozenset(v['clave'] for v in CATALOGO_VARIABLES if v['tipo'] == 'imagen')

TIPOS_CAMPO_PROPIO = ('texto', 'texto_largo', 'fecha', 'si_no', 'opcion')


def es_clave_propia_valida(clave: str) -> bool:
    return bool(_REGEX_CLAVE_PROPIA.match(clave or ''))


def extraer_variables(texto: str | None) -> list[str]:
    """Nombres de variable (`nombre` o `propio.clave`) presentes en un texto con `{...}`."""
    return _REGEX_VARIABLE.findall(texto or '')


def claves_propias_de(campos_propios: list[dict]) -> frozenset[str]:
    return frozenset(PREFIJO_PROPIO + c['clave'] for c in campos_propios or [])


def es_variable_escalar(clave: str, campos_propios: list[dict]) -> bool:
    return clave in CLAVES_ESCALARES or clave in claves_propias_de(campos_propios)


def variables_desconocidas(texto: str | None, campos_propios: list[dict]) -> list[str]:
    """Variables de `texto` que no son escalares conocidas ni campos propios declarados."""
    return [v for v in extraer_variables(texto) if not es_variable_escalar(v, campos_propios)]


def formatear_fecha(valor) -> str:
    """DD/MM/AAAA a partir de date/datetime/ISO; texto vacío si no hay valor."""
    if not valor:
        return ''
    if isinstance(valor, (date, datetime)):
        return valor.strftime('%d/%m/%Y')
    texto = str(valor).strip()
    for fmt in ('%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%d/%m/%Y'):
        try:
            return datetime.strptime(texto[:19], fmt).strftime('%d/%m/%Y')
        except ValueError:
            continue
    return texto


def fecha_larga(valor: date | datetime) -> str:
    return f"{valor.day} de {MESES_ES[valor.month - 1]} de {valor.year}"


def datos_de_hoy(hoy: date | None = None) -> dict:
    """Las variables de fecha del día; el proveedor de datos las mezcla con las suyas."""
    hoy = hoy or date.today()
    return {
        'fecha_hoy': hoy.strftime('%d/%m/%Y'), 'fecha_larga': fecha_larga(hoy),
        'dia': f'{hoy.day:02d}', 'mes': f'{hoy.month:02d}', 'anio': str(hoy.year),
    }


def valor_ejemplo_propio(campo: dict):
    """Valor de muestra de un campo propio para la vista previa."""
    tipo = campo.get('tipo')
    if tipo == 'fecha':
        return '24/11/2026'
    if tipo == 'si_no':
        return 'SI'
    if tipo == 'opcion':
        opciones = campo.get('opciones') or []
        return opciones[0] if opciones else ''
    if tipo == 'texto_largo':
        return f"Texto de ejemplo para «{campo.get('etiqueta', '')}»: descripción más extensa que ocupa varias líneas del documento."
    return f"Ejemplo: {campo.get('etiqueta', '')}"


def datos_ejemplo(campos_propios: list[dict] | None = None) -> dict:
    """Datos ficticios completos para la vista previa de una plantilla (nunca datos reales)."""
    datos: dict = {}
    for v in CATALOGO_VARIABLES:
        datos[v['clave']] = v['ejemplo']
    datos.update(datos_de_hoy())
    for campo in campos_propios or []:
        datos[PREFIJO_PROPIO + campo['clave']] = valor_ejemplo_propio(campo)
    return datos


def catalogo_para_interfaz(campos_propios: list[dict] | None = None) -> list[dict]:
    """Catálogo serializable para el selector del diseñador (sin los ejemplos de fotos)."""
    salida = [dict(v) for v in CATALOGO_VARIABLES]
    for campo in campos_propios or []:
        salida.append({
            'clave': PREFIJO_PROPIO + campo['clave'], 'etiqueta': campo['etiqueta'],
            'descripcion': campo.get('ayuda') or 'Campo propio del documento', 'grupo': 'Campos propios del documento',
            'tipo': 'texto', 'ejemplo': valor_ejemplo_propio(campo),
        })
    return salida


def sustituir(texto: str | None, datos: dict) -> str:
    """Reemplaza `{variable}` por su valor (vacío si falta). Las desconocidas quedan vacías."""
    def _valor(m):
        valor = datos.get(m.group(1))
        return '' if valor is None or isinstance(valor, (list, bytes)) else str(valor)
    return _REGEX_VARIABLE.sub(_valor, texto or '')


def valor_de(clave: str | None, datos: dict) -> str:
    if not clave:
        return ''
    valor = datos.get(clave)
    return '' if valor is None or isinstance(valor, (list, bytes)) else str(valor)


CLAVES_DEL_DIA = frozenset({'fecha_hoy', 'fecha_larga', 'dia', 'mes', 'anio'})


def huella_datos(datos: dict, version_id: str) -> str:
    """
    Huella (sha256) de los datos que alimentan un documento, sin las fechas del día (cambian solas) y con la foto
    reducida a su huella. Sirve para saber si lo firmado sigue vigente: si algún dato o la versión cambian, la huella cambia.
    """
    import hashlib
    import json

    base: dict = {}
    for clave, valor in datos.items():
        if clave in CLAVES_DEL_DIA or clave == 'foto':
            continue
        base[clave] = valor
    foto = datos.get('foto')
    if isinstance(foto, (bytes, bytearray)) and not base.get('_foto_sha256'):
        base['_foto_sha256'] = hashlib.sha256(bytes(foto)).hexdigest()
    base['_version'] = str(version_id)
    return hashlib.sha256(json.dumps(base, sort_keys=True, ensure_ascii=False, default=str).encode('utf-8')).hexdigest()


def enmascarar_ip(ip: str) -> str:
    """Oculta la parte final de la IP para mostrarla como evidencia sin exponerla completa (190.12.•.• / 2001:db8:•)."""
    ip = (ip or '').strip()
    if not ip:
        return ''
    if ':' in ip:
        partes = ip.split(':')
        return ':'.join(partes[:2]) + ':•'
    partes = ip.split('.')
    if len(partes) != 4:
        return '•'
    return f'{partes[0]}.{partes[1]}.•.•'
