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
    CONTACTO = 'contacto'
    VIVIENDA = 'vivienda'
    FORMACION = 'formacion'
    COMPLEMENTARIA = 'complementaria'
    FAMILIAR = 'familiar'
    FOTO = 'foto'


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
ENTIDADES_UNICAS = frozenset({'employee', 'datos_complementarios', 'datos_vivienda'})

CAMPOS_POR_SECCION: dict[str, dict[str, frozenset[str]]] = {
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
    'foto': {'employee': frozenset({'profile'})},
}



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


def campos_de_secciones(secciones) -> tuple[str, ...]:
    """Todos los campos de las secciones indicadas (compatibilidad con solicitudes por sección entera)."""
    elegidas = set(secciones)
    return tuple(c for c, s in SECCION_DE_CAMPO.items() if s in elegidas)


def secciones_de_campos(campos) -> tuple[str, ...]:
    """Secciones que agrupan los campos, en el orden del catálogo de secciones."""
    usadas = {SECCION_DE_CAMPO[c] for c in campos}
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
ENTIDADES_ELIMINABLES = frozenset({
    'familiar', 'formacion_academica', 'formacion_complementaria', 'contacto_emergencia',
})

# Máximo de contactos de emergencia por trabajador.
MAX_CONTACTOS_EMERGENCIA = 3
# Motivo de una acción QUITAR: 10 a 300 caracteres.
MOTIVO_QUITAR_MIN = 10
MOTIVO_QUITAR_MAX = 300

# Campos que jamás se aceptan (identidad, correo principal/login, cargo, oficina, estatus).
CAMPOS_PROHIBIDOS = frozenset({
    'cedula', 'cedulaidentidad', 'nombres_empleado', 'fecha_nacimiento_empleado', 'correo',
    'cargo', 'oficina', 'dependencia', 'estatus', 'sexoid', 'nacionalidad',
})

SECCIONES_CATALOGO_INICIAL = (
    # (codigo, nombre, requiere_soporte)
    ('contacto', 'Contacto (teléfonos, correo alternativo y contacto de emergencia)', False),
    ('vivienda', 'Vivienda', False),
    ('formacion', 'Formación académica', True),
    ('complementaria', 'Formación complementaria (cursos y capacitaciones)', True),
    ('familiar', 'Grupo familiar', True),
    ('foto', 'Foto', False),
)

TIPOS_SOPORTE_POR_SECCION: dict[str, frozenset[TipoSoporte]] = {
    'contacto': frozenset({TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
    'vivienda': frozenset({TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
    'formacion': frozenset({TipoSoporte.TITULO, TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
    'complementaria': frozenset({TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}),
    'familiar': frozenset({
        TipoSoporte.CEDULA, TipoSoporte.ACTA_NACIMIENTO, TipoSoporte.CONSTANCIA, TipoSoporte.OTRO,
    }),
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
