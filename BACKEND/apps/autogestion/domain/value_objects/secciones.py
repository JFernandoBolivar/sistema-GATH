"""
Secciones autogestionables y lista blanca de campos por sección (PLAN_PRIORIDAD §2.1, B5).

Solo lo listado aquí puede proponerse: identidad (cédula, nombres, apellidos, fecha de
nacimiento), correo principal (es el login), cargo, oficina y estatus quedan fuera.
`datos_complementarios` es la tabla propia (B13); `employee`, `datos_vivienda`,
`formacion_academica`, `contacto_emergencia` y `familiar` son datos legados que solo se
escriben al aprobar, a través del puerto `AplicadorCambios`.
"""
from enum import Enum


class Seccion(str, Enum):
    IDENTIDAD = 'identidad'
    CONTACTO = 'contacto'
    VIVIENDA = 'vivienda'
    FORMACION = 'formacion'
    COMPLEMENTARIA = 'complementaria'
    FAMILIAR = 'familiar'
    SALUD = 'salud'
    FOTO = 'foto'


# Catálogo de secciones en el orden del dominio: lo consume la configuración de
# solicitudes por condición (O12) y la pantalla de Administración del sistema.
CODIGOS_SECCIONES: tuple[str, ...] = tuple(seccion.value for seccion in Seccion)


class Accion(str, Enum):
    MODIFICAR = 'MODIFICAR'
    CREAR = 'CREAR'
    ELIMINAR = 'ELIMINAR'


class DecisionCambio(str, Enum):
    PENDIENTE = 'PENDIENTE'
    APROBADO = 'APROBADO'
    RECHAZADO = 'RECHAZADO'


class TipoSoporte(str, Enum):
    TITULO = 'TITULO'
    ACTA_NACIMIENTO = 'ACTA_NACIMIENTO'
    CEDULA = 'CEDULA'
    CONSTANCIA = 'CONSTANCIA'
    FOTO = 'FOTO'
    OTRO = 'OTRO'


ORIGEN_ACTUALIZACION = 'ACTUALIZACION'
ORIGEN_FE_DE_VIDA = 'FE_DE_VIDA'
CAMPO_REGISTRO_NUEVO = '*'  # en CREAR el valor propuesto es un dict con todos los campos
CAMPO_ELIMINAR = '*'  # en ELIMINAR el valor propuesto es {'motivo': ...}

# Entidades de un solo registro por trabajador (no llevan entidad_id).
ENTIDADES_UNICAS = frozenset({'employee', 'datos_complementarios', 'datos_vivienda', 'perfil_salud', 'perfil_fisico'})

CAMPOS_POR_SECCION: dict[str, dict[str, frozenset[str]]] = {
    'identidad': {
        'employee': frozenset({
            'nombres', 'apellidos', 'fecha_nacimiento', 'cedulaidentidad',
            'estadoCivil_id', 'carnet_patria', 'carnet_patria_serial',
        }),
    },
    'contacto': {
        'employee': frozenset({'telefono_movil', 'telefono_habitacion'}),
        'datos_complementarios': frozenset({'correo_alternativo'}),
        'contacto_emergencia': frozenset({'nombres', 'apellidos', 'telefono', 'relacion_id'}),
    },
    'vivienda': {
        'datos_vivienda': frozenset({
            'estado_id', 'municipio_id', 'parroquia_id', 'direccion_exacta',
            'condicion_vivienda_id', 'codigo_postal_id',
        }),
    },
    'formacion': {
        'formacion_academica': frozenset({'nivel_academico_id', 'carrera_id', 'mencion_id', 'institucion_id'}),
    },
    'complementaria': {
        'formacion_complementaria': frozenset({
            'capacitacion_id', 'institucion_id', 'fecha_inicio', 'fecha_fin',
            'dias_completados', 'horas_completadas', 'procedencia_id', 'grupo_id',
        }),
    },
    'familiar': {
        'familiar': frozenset({
            'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido',
            'cedula_familiar', 'parentesco_id', 'fecha_nacimiento', 'sexo_id', 'observaciones',
        }),
        'datos_complementarios': frozenset({'tiene_hijos'}),
    },
    'salud': {
        'perfil_salud': frozenset({
            'grupo_sanguineo_id', 'alergias', 'patologias_cronicas', 'discapacidades',
        }),
        'perfil_fisico': frozenset({
            'talla_camisa_id', 'talla_pantalon_id', 'talla_zapatos_id', 'talla_chaqueta_id',
        }),
    },
    'foto': {'employee': frozenset({'profile'})},
}


# Entidades de lista (varios registros por trabajador): en la solicitud se piden por ACCIÓN
# (agregar, corregir, quitar) y no por campos sueltos.
ENTIDADES_DE_LISTA = frozenset({
    'familiar', 'formacion_academica', 'formacion_complementaria', 'contacto_emergencia',
})


def clave_campo(entidad: str, campo: str) -> str:
    """Identificador de un campo solicitable: `entidad.campo` (B16, decisión G)."""
    return f'{entidad}.{campo}'


# Todo campo solicitable -> sección que lo agrupa (las secciones solo agrupan en la interfaz).
SECCION_DE_CAMPO: dict[str, str] = {
    clave_campo(entidad, campo): seccion
    for seccion, entidades in CAMPOS_POR_SECCION.items()
    for entidad, campos in entidades.items()
    for campo in campos
}


# Entidad -> todos sus campos (unión entre secciones).
CAMPOS_DE_ENTIDAD: dict[str, frozenset[str]] = {}
for _entidades in CAMPOS_POR_SECCION.values():
    for _entidad, _campos in _entidades.items():
        CAMPOS_DE_ENTIDAD[_entidad] = CAMPOS_DE_ENTIDAD.get(_entidad, frozenset()) | _campos

# Marca que distingue una acción solicitada (`entidad.@CREAR`) de un campo (`entidad.campo`).
PREFIJO_ACCION = '@'


def clave_accion(entidad: str, accion: Accion | str) -> str:
    """Identificador de una acción solicitable sobre una entidad de lista: `entidad.@ACCION`."""
    valor = accion.value if isinstance(accion, Accion) else accion
    return f'{entidad}.{PREFIJO_ACCION}{valor}'


# Toda acción solicitable -> sección que la agrupa.
SECCION_DE_ACCION: dict[str, str] = {
    clave_accion(entidad, accion): seccion
    for seccion, entidades in CAMPOS_POR_SECCION.items()
    for entidad in entidades
    if entidad in ENTIDADES_DE_LISTA
    for accion in Accion
}


def seccion_de_clave(clave: str) -> str | None:
    """Sección de una clave solicitable, sea campo (`entidad.campo`) o acción (`entidad.@ACCION`)."""
    return SECCION_DE_CAMPO.get(clave) or SECCION_DE_ACCION.get(clave)


def acciones_solicitadas(entidad: str, claves) -> frozenset[str]:
    """
    Acciones permitidas sobre una entidad de lista según las claves habilitadas.
    Con claves de acción, solo esas; con campos sueltos (solicitudes anteriores), todas; si no hay nada, ninguna.
    """
    claves = set(claves)
    pedidas = frozenset(a.value for a in Accion if clave_accion(entidad, a) in claves)
    if pedidas:
        return pedidas
    if any(clave_campo(entidad, c) in claves for c in CAMPOS_DE_ENTIDAD.get(entidad, ())):
        return frozenset(a.value for a in Accion)
    return frozenset()


def campos_de_secciones(secciones) -> tuple[str, ...]:
    """Todos los campos de las secciones indicadas (compatibilidad con solicitudes por sección entera)."""
    elegidas = set(secciones)
    return tuple(c for c, s in SECCION_DE_CAMPO.items() if s in elegidas)


def secciones_de_campos(campos) -> tuple[str, ...]:
    """Secciones que agrupan los campos, en el orden del catálogo de secciones."""
    usadas = {seccion_de_clave(c) for c in campos}
    return tuple(s.value for s in Seccion if s.value in usadas)


# Campos obligatorios al CREAR un registro nuevo.
REQUERIDOS_AL_CREAR: dict[str, frozenset[str]] = {
    'datos_vivienda': frozenset({
        'estado_id', 'municipio_id', 'parroquia_id', 'direccion_exacta', 'condicion_vivienda_id', 'codigo_postal_id',
    }),
    'formacion_academica': frozenset({'nivel_academico_id'}),
    'formacion_complementaria': frozenset({'capacitacion_id'}),
    'contacto_emergencia': frozenset({'nombres', 'apellidos', 'telefono', 'relacion_id'}),
    'familiar': frozenset({'primer_nombre', 'primer_apellido', 'parentesco_id', 'fecha_nacimiento', 'sexo_id'}),
}

# Entidades que se pueden QUITAR desde la autogestión (con motivo obligatorio).
ENTIDADES_ELIMINABLES = ENTIDADES_DE_LISTA

# Cómo se nombra cada acción en lenguaje claro (mensajes de error y revisión de Bienestar).
VERBO_ACCION: dict[str, str] = {
    Accion.CREAR.value: 'agregar',
    Accion.MODIFICAR.value: 'corregir',
    Accion.ELIMINAR.value: 'quitar',
}

# Máximo de contactos de emergencia por trabajador.
MAX_CONTACTOS_EMERGENCIA = 3
# Motivo de una acción QUITAR: 10 a 300 caracteres.
MOTIVO_QUITAR_MIN = 10
MOTIVO_QUITAR_MAX = 300

# Campos de identidad que exigen copia de la cédula al proponerse (D19).
CAMPOS_IDENTIDAD_CON_CEDULA = frozenset({'nombres', 'apellidos', 'fecha_nacimiento', 'cedulaidentidad'})

# Tipo de prenda (categoría del catálogo `TipoPrenda`) que corresponde a cada talla.
# La categoría real vive en la base de datos; aquí solo se indica cuál aplica a cada columna.
TIPO_PRENDA_POR_CAMPO_TALLA: dict[str, str] = {
    'talla_camisa_id': 'camisa',
    'talla_pantalon_id': 'pantalon',
    'talla_zapatos_id': 'zapato',
    'talla_chaqueta_id': 'chaqueta',
}

# Clave del catálogo de solo lectura -> categoría de `TipoPrenda` que filtra sus tallas.
CATALOGOS_TALLA: dict[str, str] = {
    'tallas-camisa': 'camisa',
    'tallas-pantalon': 'pantalon',
    'tallas-zapatos': 'zapato',
    'tallas-chaqueta': 'chaqueta',
}

# Campos que jamás se aceptan (correo principal/login, cargo, oficina, estatus).
CAMPOS_PROHIBIDOS = frozenset({
    'cedula', 'nombres_empleado', 'fecha_nacimiento_empleado', 'correo',
    'cargo', 'oficina', 'dependencia', 'estatus', 'sexoid', 'nacionalidad',
})

SECCIONES_CATALOGO_INICIAL = (
    # (codigo, nombre, requiere_soporte)
    ('identidad', 'Identidad (nombres, apellidos, fecha de nacimiento y cédula)', False),
    ('contacto', 'Contacto (teléfonos, correo alternativo y contacto de emergencia)', False),
    ('vivienda', 'Vivienda', False),
    ('formacion', 'Formación académica', True),
    ('complementaria', 'Formación complementaria (cursos y capacitaciones)', True),
    ('familiar', 'Grupo familiar', True),
    ('salud', 'Salud y tallas', False),
    ('foto', 'Foto', False),
)

TIPOS_SOPORTE_POR_SECCION: dict[str, frozenset[TipoSoporte]] = {
    'identidad': frozenset({TipoSoporte.CEDULA}),
    'contacto': frozenset({TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
    'vivienda': frozenset({TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
    'formacion': frozenset({TipoSoporte.TITULO, TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
    'complementaria': frozenset({TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
    'familiar': frozenset({
        TipoSoporte.CEDULA, TipoSoporte.ACTA_NACIMIENTO, TipoSoporte.CONSTANCIA, TipoSoporte.OTRO,
    }),
    'salud': frozenset(),
    'foto': frozenset({TipoSoporte.FOTO}),
}

# Documentos exigidos por acción sobre una entidad (se validan al enviar).
# La clave es (entidad, accion); el valor son los tipos aceptados (al menos uno).
DOCUMENTOS_EXIGIDOS: dict[tuple[str, str], frozenset[TipoSoporte]] = {
    ('formacion_academica', 'CREAR'): frozenset({TipoSoporte.TITULO, TipoSoporte.CONSTANCIA}),
    ('formacion_academica', 'MODIFICAR'): frozenset({TipoSoporte.TITULO, TipoSoporte.CONSTANCIA}),
    ('formacion_complementaria', 'CREAR'): frozenset({TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
    ('formacion_complementaria', 'MODIFICAR'): frozenset({TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
}
