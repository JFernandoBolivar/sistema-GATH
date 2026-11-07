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
    obligatorio_completo: bool = False
    max_length: int | None = None
    catalogo: str = ''
    formato: str = ''
    ayuda: str = ''
    ejemplo: str = ''
    poblaciones: tuple[str, ...] = POBLACIONES

    def aplica_a(self, poblacion: str) -> bool:
        return poblacion in self.poblaciones


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
        Campo('estado_civil_id', 'Estado civil', tipo='catalogo', catalogo='estado_civil'),
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
        Campo('codigo_cargo', 'Código de cargo', obligatorio=True, max_length=40),
        Campo('tipo_nomina_id', 'Tipo de nómina', tipo='catalogo', catalogo='tipo_nomina_activo', obligatorio=True),
        Campo('fecha_ingreso', 'Fecha de ingreso o reingreso', tipo='fecha', obligatorio=True, formato='AAAA-MM-DD'),
        Campo(
            'motivo_id', 'Motivo del ingreso o reingreso', tipo='catalogo',
            catalogo='motivo_ingreso',
            ayuda='Obligatorio si el trabajador está PASIVO y la carga es de ACTIVOS.',
        ),
    ), ('cedula', 'codigo_cargo'), poblaciones=(POBLACION_ACTIVOS,)),
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
        Campo('titulo', 'Título', obligatorio=True, max_length=160),
        Campo('institucion', 'Institución', obligatorio=True, max_length=160),
        Campo('nivel_academico_id', 'Nivel académico', tipo='catalogo', catalogo='nivel_academico'),
        Campo('fecha_inicio', 'Fecha de inicio', tipo='fecha', formato='AAAA-MM-DD'),
        Campo('fecha_fin', 'Fecha de fin', tipo='fecha', formato='AAAA-MM-DD'),
    ), ('cedula', 'titulo', 'institucion')),
    TipoCarga('formacion_complementaria', 'Formación complementaria', 'Formación complementaria', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        Campo('curso', 'Curso', obligatorio=True, max_length=160),
        Campo('institucion', 'Institución', obligatorio=True, max_length=160),
        Campo('fecha_inicio', 'Fecha de inicio', tipo='fecha', formato='AAAA-MM-DD'),
        Campo('fecha_fin', 'Fecha de fin', tipo='fecha', formato='AAAA-MM-DD'),
        Campo('horas', 'Horas', tipo='entero'),
    ), ('cedula', 'curso', 'institucion')),
    TipoCarga('vivienda', 'Vivienda', 'Vivienda', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        Campo('estado_id', 'Estado', tipo='catalogo', catalogo='estado', obligatorio=True),
        Campo('municipio_id', 'Municipio', tipo='catalogo', catalogo='municipio'),
        Campo('parroquia_id', 'Parroquia', tipo='catalogo', catalogo='parroquia'),
        Campo('direccion_exacta', 'Dirección exacta', obligatorio=True, max_length=300),
        Campo('condicion_vivienda_id', 'Condición de la vivienda', tipo='catalogo', catalogo='condicion_vivienda'),
    ), ('cedula',)),
    TipoCarga('salud_tallas', 'Salud y tallas', 'Salud y tallas', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        Campo('discapacidad_id', 'Discapacidad', tipo='catalogo', catalogo='discapacidad'),
        Campo('alergia_id', 'Alergia', tipo='catalogo', catalogo='alergia'),
        Campo('patologia_id', 'Patología crónica', tipo='catalogo', catalogo='patologia'),
        Campo('talla_camisa', 'Talla de camisa', max_length=20),
        Campo('talla_pantalon', 'Talla de pantalón', max_length=20),
        Campo('talla_zapato', 'Talla de zapato', max_length=20),
    ), ('cedula',)),
    TipoCarga('antecedentes_laborales', 'Antecedentes laborales', 'Antecedentes laborales', (
        Campo('cedula', 'Cédula', obligatorio=True, max_length=15),
        Campo('organismo', 'Organismo', obligatorio=True, max_length=160),
        Campo('cargo', 'Cargo', obligatorio=True, max_length=160),
        Campo('fecha_ingreso', 'Fecha de ingreso', tipo='fecha', obligatorio=True, formato='AAAA-MM-DD'),
        Campo('fecha_egreso', 'Fecha de egreso', tipo='fecha', formato='AAAA-MM-DD'),
    ), ('cedula', 'organismo', 'cargo', 'fecha_ingreso')),
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
