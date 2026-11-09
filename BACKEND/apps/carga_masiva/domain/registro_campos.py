"""Registro único de campos de la carga masiva (O28-F1, FIX-CARGA1).

Cada tipo de carga declara sus columnas una sola vez. El generador de
plantillas, el analizador (F2) y el aplicador (F4) consumen este registro; no
hay listas de columnas escritas a mano en cada capa.

FIX-CARGA1: la plantilla depende de la población (activos o pasivos). «Cargo y
asignación» solo existe para activos; los campos que describen el movimiento de
cambio de condición solo se generan en la población a la que aplican.
"""
from dataclasses import dataclass

POBLACION_ACTIVOS = 'ACTIVOS'
POBLACION_PASIVOS = 'PASIVOS'
POBLACIONES = (POBLACION_ACTIVOS, POBLACION_PASIVOS)


@dataclass(frozen=True)
class Campo:
    clave: str
    etiqueta: str
    tipo: str = 'texto'          # texto | entero | decimal | fecha | booleano | catalogo
    obligatorio: bool = False
    # FIX-CARGA3: obligatorio solo para ciertas poblaciones (p. ej. las tallas
    # de los activos). Si está vacío se usa `obligatorio` para todas.
    obligatorio_poblaciones: tuple[str, ...] = ()
    obligatorio_completo: bool = False
    max_length: int | None = None
    catalogo: str = ''
    formato: str = ''
    ayuda: str = ''
    ejemplo: str = ''
    poblaciones: tuple[str, ...] = POBLACIONES

    def aplica_a(self, poblacion: str) -> bool:
        return poblacion in self.poblaciones

    def es_obligatorio(self, poblacion: str) -> bool:
        if self.obligatorio_poblaciones:
            return poblacion in self.obligatorio_poblaciones
        return self.obligatorio


@dataclass(frozen=True)
class TipoCarga:
    clave: str
    nombre: str
    hoja: str
    campos: tuple[Campo, ...]
    clave_negocio: tuple[str, ...]
    poblaciones: tuple[str, ...] = POBLACIONES

    def campo(self, clave: str, poblacion: str | None = None) -> Campo | None:
        for campo in self.campos:
            if campo.clave == clave and (poblacion is None or campo.aplica_a(poblacion)):
                return campo
        return None

    def campos_para(self, poblacion: str) -> tuple[Campo, ...]:
        """Columnas de la hoja en la plantilla de esa población, en orden."""
        return tuple(c for c in self.campos if c.aplica_a(poblacion))

    def aplica_a(self, poblacion: str) -> bool:
        return poblacion in self.poblaciones


TIPOS_CARGA: tuple[TipoCarga, ...] = (
    TipoCarga('datos_personales', 'Datos personales', 'Datos personales', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15, ejemplo='12345678', ayuda='5 a 9 dígitos.'),
        Campo('nombres', 'Nombres', obligatorio=True, obligatorio_completo=True, max_length=120),
        Campo('apellidos', 'Apellidos', obligatorio=True, obligatorio_completo=True, max_length=120),
        Campo('sexo_id', 'Sexo', tipo='catalogo', catalogo='sexo', obligatorio=True),
        Campo('fecha_nacimiento', 'Fecha de nacimiento', tipo='fecha', obligatorio=True, formato='AAAA-MM-DD'),
        Campo('nacionalidad_id', 'Nacionalidad', tipo='catalogo', catalogo='nacionalidad', obligatorio=True),
        Campo('estado_civil_id', 'Estado civil', tipo='catalogo', catalogo='estado_civil', obligatorio=True),
        Campo('correo', 'Correo', max_length=150, formato='correo@dominio'),
        Campo('telefono_movil', 'Teléfono móvil', max_length=20),
        Campo('telefono_habitacion', 'Teléfono de habitación', max_length=20),
        # FIX-CARGA1: solo se generan en la plantilla de pasivos. Si la cédula
        # está ACTIVA, describen el pase a pasivo que se registrará al aplicar.
        Campo(
            'fecha_egreso', 'Fecha de egreso', tipo='fecha', formato='AAAA-MM-DD',
            ayuda='Obligatoria si el trabajador está ACTIVO y la carga es de PASIVOS.',
            poblaciones=(POBLACION_PASIVOS,),
        ),
        Campo(
            'motivo_id', 'Motivo del pase a pasivo', tipo='catalogo',
            catalogo='motivo_pase_a_pasivo',
            ayuda='Obligatorio si el trabajador está ACTIVO y la carga es de PASIVOS.',
            poblaciones=(POBLACION_PASIVOS,),
        ),
        Campo(
            'tipo_nomina_id', 'Tipo de nómina de pasivo', tipo='catalogo',
            catalogo='tipo_nomina_pasivo',
            ayuda='Obligatorio si el trabajador está ACTIVO y la carga es de PASIVOS.',
            poblaciones=(POBLACION_PASIVOS,),
        ),
    ), ('cedula',)),
    TipoCarga('cargo_asignacion', 'Cargo y asignación', 'Cargo y asignación', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        Campo(
            'denominacion_id', 'Denominación del cargo', tipo='catalogo',
            catalogo='denominacion_cargo', obligatorio=True,
        ),
        Campo(
            'especifica_id', 'Denominación específica', tipo='catalogo',
            catalogo='denominacion_cargo_especifica', obligatorio=True,
        ),
        Campo(
            'dependencia_id', 'Nivel / Dependencia', tipo='catalogo',
            catalogo='dependencia', obligatorio=True,
            ayuda='Primer nivel de la ubicación; filtra las direcciones generales.',
        ),
        Campo(
            'direccion_general_id', 'Dirección / Gerencia / Oficina', tipo='catalogo',
            catalogo='direccion_general', obligatorio=True,
            ayuda='Debe pertenecer al nivel seleccionado.',
        ),
        Campo(
            'direccion_linea_id', 'Dirección de línea / División', tipo='catalogo',
            catalogo='direccion_linea',
            ayuda='Opcional; debe pertenecer a la dirección general.',
        ),
        Campo(
            'coordinacion_id', 'Coordinación', tipo='catalogo',
            catalogo='coordinacion',
            ayuda='Opcional; debe pertenecer a la dirección de línea.',
        ),
        Campo('grado_id', 'Grado', tipo='catalogo', catalogo='grado'),
        Campo(
            'organismo_id', 'Organismo adscrito', tipo='catalogo',
            catalogo='organismo',
        ),
        Campo('tipo_nomina_id', 'Tipo de nómina', tipo='catalogo', catalogo='tipo_nomina_activo', obligatorio=True),
        Campo('fecha_ingreso', 'Fecha de ingreso o reingreso', tipo='fecha', obligatorio=True, formato='AAAA-MM-DD'),
        Campo(
            'motivo_id', 'Motivo del ingreso o reingreso', tipo='catalogo',
            catalogo='motivo_ingreso',
            ayuda='Obligatorio si el trabajador está PASIVO y la carga es de ACTIVOS.',
        ),
    ), ('cedula', 'denominacion_id', 'dependencia_id', 'fecha_ingreso'), poblaciones=(POBLACION_ACTIVOS,)),
    TipoCarga('familiares', 'Familiares', 'Familiares', (
        Campo('cedula_titular', 'Cédula del titular', obligatorio=True, max_length=15),
        Campo('cedula_familiar', 'Cédula del familiar', max_length=15, ayuda='Obligatoria salvo hijo(a) menor de 9 años.'),
        Campo('nombres', 'Nombres', obligatorio=True, max_length=120),
        Campo('apellidos', 'Apellidos', obligatorio=True, max_length=120),
        Campo('parentesco_id', 'Parentesco', tipo='catalogo', catalogo='parentesco_familiar', obligatorio=True),
        Campo('fecha_nacimiento', 'Fecha de nacimiento', tipo='fecha', obligatorio=True, formato='AAAA-MM-DD'),
        Campo('sexo_id', 'Sexo', tipo='catalogo', catalogo='sexo', obligatorio=True),
        Campo('orden_hijo', 'Orden del hijo', tipo='entero', ayuda='Solo si es hijo(a) menor de 9 sin cédula.'),
    ), ('cedula_titular', 'cedula_familiar')),
    TipoCarga('contactos_emergencia', 'Contactos de emergencia', 'Contactos de emergencia', (
        Campo('cedula_titular', 'Cédula del titular', obligatorio=True, max_length=15),
        Campo('nombres', 'Nombres', obligatorio=True, max_length=120),
        Campo('apellidos', 'Apellidos', obligatorio=True, max_length=120),
        Campo('parentesco_id', 'Parentesco', tipo='catalogo', catalogo='parentesco', obligatorio=True),
        Campo('telefono', 'Teléfono', obligatorio=True, max_length=20),
    ), ('cedula_titular', 'nombres', 'apellidos')),
    TipoCarga('formacion_academica', 'Formación académica', 'Formación académica', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        Campo('nivel_academico_id', 'Nivel académico', tipo='catalogo', catalogo='nivel_academico', obligatorio=True),
        Campo('titulo', 'Título / Carrera', tipo='catalogo', catalogo='carrera', max_length=200, ayuda='Opcional; si se indica, exige institución.'),
        Campo('institucion', 'Institución', tipo='catalogo', catalogo='institucion', max_length=200, ayuda='Exigida si se indica título/carrera.'),
    ), ('cedula', 'nivel_academico_id')),
    TipoCarga('formacion_complementaria', 'Formación complementaria', 'Formación complementaria', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        Campo('curso', 'Curso', obligatorio=True, max_length=160),
        Campo('institucion', 'Institución', tipo='catalogo', catalogo='institucion', obligatorio=True, max_length=200),
        Campo('fecha_inicio', 'Fecha de inicio', tipo='fecha', formato='AAAA-MM-DD'),
        Campo('fecha_fin', 'Fecha de fin', tipo='fecha', formato='AAAA-MM-DD'),
        Campo('horas', 'Horas', tipo='entero'),
    ), ('cedula', 'curso', 'institucion')),
    TipoCarga('vivienda', 'Vivienda', 'Vivienda', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        # ACTIVOS: el país está fijo en Venezuela; la ubicación completa es obligatoria
        Campo('estado_id', 'Estado', tipo='catalogo', catalogo='estado', obligatorio=True, poblaciones=(POBLACION_ACTIVOS,)),
        Campo('municipio_id', 'Municipio', tipo='catalogo', catalogo='municipio', obligatorio=True, poblaciones=(POBLACION_ACTIVOS,)),
        Campo('parroquia_id', 'Parroquia', tipo='catalogo', catalogo='parroquia', obligatorio=True, poblaciones=(POBLACION_ACTIVOS,)),
        # PASIVOS: pueden residir fuera de Venezuela; país obligatorio y ubicación condicional
        Campo('pais_id', 'País', tipo='catalogo', catalogo='pais', obligatorio=True, poblaciones=(POBLACION_PASIVOS,)),
        Campo(
            'ciudad_region', 'Ciudad o región', max_length=120,
            ayuda='Obligatoria para pasivos que residen fuera de Venezuela.',
            poblaciones=(POBLACION_PASIVOS,),
        ),
        Campo(
            'estado_id', 'Estado', tipo='catalogo', catalogo='estado',
            ayuda='Obligatorio si el país es Venezuela.',
            poblaciones=(POBLACION_PASIVOS,),
        ),
        Campo(
            'municipio_id', 'Municipio', tipo='catalogo', catalogo='municipio',
            ayuda='Obligatorio si el país es Venezuela.',
            poblaciones=(POBLACION_PASIVOS,),
        ),
        Campo(
            'parroquia_id', 'Parroquia', tipo='catalogo', catalogo='parroquia',
            ayuda='Obligatoria si el país es Venezuela.',
            poblaciones=(POBLACION_PASIVOS,),
        ),
        # COMUNES:
        Campo(
            'codigo_postal', 'Código postal', tipo='catalogo', catalogo='codigo_postal',
            obligatorio_poblaciones=(POBLACION_ACTIVOS,), max_length=5,
            ayuda='Obligatorio si el país es Venezuela; vacío si es otro país.',
        ),
        Campo('direccion_exacta', 'Dirección exacta', obligatorio=True, max_length=300),
        Campo('condicion_vivienda_id', 'Condición de la vivienda', tipo='catalogo', catalogo='condicion_vivienda', obligatorio=True),
    ), ('cedula',)),
    TipoCarga('salud_tallas', 'Salud y tallas', 'Salud y tallas', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        Campo('discapacidad_id', 'Discapacidad', tipo='catalogo', catalogo='discapacidad'),
        Campo('alergia_id', 'Alergia', tipo='catalogo', catalogo='alergia'),
        Campo('patologia_id', 'Patología crónica', tipo='catalogo', catalogo='patologia'),
        # FIX-CARGA3: obligatorias solo para activos; un pasivo puede no tenerlas.
        Campo(
            'talla_camisa', 'Talla de camisa', tipo='catalogo', catalogo='talla_camisa',
            max_length=20, obligatorio_poblaciones=(POBLACION_ACTIVOS,),
        ),
        Campo(
            'talla_pantalon', 'Talla de pantalón', tipo='catalogo', catalogo='talla_pantalon',
            max_length=20, obligatorio_poblaciones=(POBLACION_ACTIVOS,),
        ),
        Campo(
            'talla_zapato', 'Talla de zapato', tipo='catalogo', catalogo='talla_zapato',
            max_length=20, obligatorio_poblaciones=(POBLACION_ACTIVOS,),
        ),
    ), ('cedula',)),
    TipoCarga('antecedentes_laborales', 'Antecedentes laborales', 'Antecedentes laborales', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        Campo('organismo', 'Organismo', tipo='catalogo', catalogo='organismo', obligatorio=True, max_length=160),
        Campo('fecha_ingreso', 'Fecha de ingreso', tipo='fecha', obligatorio=True, formato='AAAA-MM-DD'),
        Campo('fecha_egreso', 'Fecha de egreso', tipo='fecha', obligatorio=True, formato='AAAA-MM-DD'),
    ), ('cedula', 'organismo', 'fecha_ingreso')),
)

TIPOS_POR_CLAVE = {t.clave: t for t in TIPOS_CARGA}


def tipos_para(
    claves: list[str] | tuple[str, ...] | None,
    poblacion: str = POBLACION_ACTIVOS,
) -> list[TipoCarga]:
    """Tipos válidos para una población; con `claves` filtra y conserva el orden pedido."""
    disponibles = [t for t in TIPOS_CARGA if t.aplica_a(poblacion)]
    if not claves:
        return disponibles
    por_clave = {t.clave: t for t in disponibles}
    return [por_clave[c] for c in claves if c in por_clave]


def claves_por_poblacion(poblacion: str) -> tuple[str, ...]:
    return tuple(t.clave for t in TIPOS_CARGA if t.aplica_a(poblacion))
