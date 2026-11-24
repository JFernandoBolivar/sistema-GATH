"""
Esquema y completitud del formulario de la Ventana 2 (`datos_ventana2`). Puro: sin Django.

La Ventana 2 reúne lo que el trabajador necesita para ser dado de alta: grupo familiar, vivienda, salud y tallas
(más la foto de carnet, que va aparte). Los NOMBRES DE CAMPO y los catálogos son los mismos de `personal` y
`familiares` (parentesco, sexo, condición de vivienda, grupo sanguíneo, alergias, patologías, discapacidades,
tallas, estado/municipio/parroquia), de modo que la promoción los copia sin traducir. Todo viaja por id de catálogo.

    {
      "familiares": [{
        "primer_nombre": texto <= 150            (obligatorio)
        "segundo_nombre": texto <= 150
        "primer_apellido": texto <= 150          (obligatorio)
        "segundo_apellido": texto <= 150
        "cedula": texto <= 10                    (opcional; sin ella solo un hijo/menor a cargo con "orden_hijo")
        "orden_hijo": 1..99                      (solo hijos o menores a cargo sin cédula)
        "parentesco_id": id                      (obligatorio)
        "sexo_id": id                            (obligatorio)
        "fecha_nacimiento": "AAAA-MM-DD"         (obligatorio, pasada)
        "depende_economicamente": true | false   (obligatorio)
      }, ...],                                   (máx. 20)
      "sin_familiares": true | false             (declaración expresa de que no tiene carga familiar)
      "vivienda": {
        "condicion_vivienda_id": id              (obligatorio: tipo y tenencia, p. ej. propia, alquilada)
        "estado_id", "municipio_id", "parroquia_id": ids   (obligatorios; la jerarquía debe encajar)
        "direccion_exacta": texto <= 300         (obligatorio)
        "ciudad_region": texto <= 120
      },
      "salud": {
        "grupo_sanguineo_id": id                 (obligatorio)
        "alergias": [ids], "patologias_cronicas": [ids], "discapacidades": [ids]   (vacío = ninguna)
      },
      "tallas": {
        "talla_camisa_id", "talla_pantalon_id", "talla_zapatos_id": ids   (obligatorios)
        "talla_chaqueta_id": id
      }
    }

Al guardar un borrador todo es opcional (cada sección presente REEMPLAZA a la anterior; la omitida no cambia).
Una clave que no está en el esquema se rechaza. La completitud (`faltantes_ventana2`) solo se exige al ENVIAR.
"""
from datetime import date

from core.domain.exceptions import ValidationError

SECCIONES = ('familiares', 'sin_familiares', 'vivienda', 'salud', 'tallas')
MAX_FAMILIARES = 20

_CLAVES_FAMILIAR = frozenset({
    'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'cedula', 'orden_hijo',
    'parentesco_id', 'sexo_id', 'fecha_nacimiento', 'depende_economicamente',
})
_CLAVES_VIVIENDA = frozenset({
    'condicion_vivienda_id', 'estado_id', 'municipio_id', 'parroquia_id', 'direccion_exacta', 'ciudad_region',
})
_CLAVES_SALUD = frozenset({'grupo_sanguineo_id', 'alergias', 'patologias_cronicas', 'discapacidades'})
_CLAVES_TALLAS = frozenset({'talla_camisa_id', 'talla_pantalon_id', 'talla_zapatos_id', 'talla_chaqueta_id'})

OBLIGATORIOS_FAMILIAR = ('primer_nombre', 'primer_apellido', 'parentesco_id', 'sexo_id', 'fecha_nacimiento')
OBLIGATORIOS_VIVIENDA = ('condicion_vivienda_id', 'estado_id', 'municipio_id', 'parroquia_id', 'direccion_exacta')
OBLIGATORIOS_SALUD = ('grupo_sanguineo_id',)
OBLIGATORIOS_TALLAS = ('talla_camisa_id', 'talla_pantalon_id', 'talla_zapatos_id')

ETIQUETAS = {
    'primer_nombre': 'el primer nombre', 'primer_apellido': 'el primer apellido', 'parentesco_id': 'el parentesco',
    'sexo_id': 'el sexo', 'fecha_nacimiento': 'la fecha de nacimiento',
    'condicion_vivienda_id': 'el tipo y tenencia de la vivienda', 'estado_id': 'el estado',
    'municipio_id': 'el municipio', 'parroquia_id': 'la parroquia', 'direccion_exacta': 'la dirección exacta',
    'grupo_sanguineo_id': 'el grupo sanguíneo', 'talla_camisa_id': 'la talla de camisa',
    'talla_pantalon_id': 'la talla de pantalón', 'talla_zapatos_id': 'la talla de calzado',
}


def _error(mensaje: str, campo: str) -> ValidationError:
    return ValidationError(mensaje, campo=f'datos_ventana2.{campo}')


def _texto(valor, etiqueta: str, campo: str, maximo: int) -> str:
    if not isinstance(valor, str):
        raise _error(f"{etiqueta} debe ser un texto.", campo)
    valor = ' '.join(valor.split())
    if len(valor) > maximo:
        raise _error(f"{etiqueta} admite como máximo {maximo} caracteres.", campo)
    return valor


def _id(valor, etiqueta: str, campo: str) -> int:
    if isinstance(valor, bool) or not isinstance(valor, (int, str)) or not str(valor).strip().isdigit() or int(valor) < 1:
        raise _error(f"{etiqueta} debe ser un identificador numérico válido.", campo)
    return int(valor)


def _lista_de_ids(valor, etiqueta: str, campo: str) -> list[int]:
    if not isinstance(valor, list):
        raise _error(f"{etiqueta} debe ser una lista de identificadores.", campo)
    if len(valor) > 50:
        raise _error(f"{etiqueta} admite como máximo 50 elementos.", campo)
    return sorted({_id(v, etiqueta, campo) for v in valor})


def _solo_claves(valor, permitidas: frozenset, nombre: str, campo: str) -> dict:
    if not isinstance(valor, dict):
        raise _error(f"{nombre} debe ser un objeto.", campo)
    desconocidas = sorted(set(valor) - permitidas)
    if desconocidas:
        raise _error(f"Datos no admitidos en {nombre}: {', '.join(desconocidas)}.", campo)
    return valor


def _familiar(item, indice: int, hoy: date) -> dict:
    base = f'familiares.{indice}'
    _solo_claves(item, _CLAVES_FAMILIAR, f"el familiar {indice + 1}", base)
    limpio: dict = {}
    for clave, valor in item.items():
        campo = f'{base}.{clave}'
        if valor is None or (isinstance(valor, str) and not valor.strip()):
            continue  # vacío = no informado (`False` sí es una respuesta)
        if clave in ('primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'):
            limpio[clave] = _texto(valor, f"El campo {clave.replace('_', ' ')}", campo, 150)
        elif clave == 'cedula':
            limpio[clave] = _texto(valor, "La cédula del familiar", campo, 10).upper()
        elif clave == 'orden_hijo':
            orden = _id(valor, "El orden de nacimiento", campo)
            if orden > 99:
                raise _error("El orden de nacimiento debe estar entre 1 y 99.", campo)
            limpio[clave] = orden
        elif clave in ('parentesco_id', 'sexo_id'):
            limpio[clave] = _id(valor, "El identificador", campo)
        elif clave == 'fecha_nacimiento':
            try:
                fecha = date.fromisoformat(str(valor))
            except ValueError as e:
                raise _error("La fecha de nacimiento debe tener el formato AAAA-MM-DD.", campo) from e
            if fecha > hoy:
                raise _error("La fecha de nacimiento no puede ser futura.", campo)
            limpio[clave] = fecha.isoformat()
        elif clave == 'depende_economicamente':
            if not isinstance(valor, bool):
                raise _error("«Depende económicamente» debe ser verdadero o falso.", campo)
            limpio[clave] = valor
    return limpio


def validar_datos_ventana2(datos, hoy: date) -> dict:
    """Devuelve el borrador normalizado (solo las secciones presentes) o lanza `ValidationError` con el campo."""
    if not isinstance(datos, dict):
        raise ValidationError("Los datos de la Ventana 2 deben ser un objeto.", campo='datos_ventana2')
    desconocidas = sorted(set(datos) - set(SECCIONES))
    if desconocidas:
        raise ValidationError(
            f"Secciones no admitidas en la Ventana 2: {', '.join(desconocidas)}.", campo='datos_ventana2',
        )
    limpio: dict = {}
    if 'familiares' in datos:
        lista = datos['familiares']
        if not isinstance(lista, list):
            raise _error("Los familiares deben ser una lista.", 'familiares')
        if len(lista) > MAX_FAMILIARES:
            raise _error(f"Se admiten como máximo {MAX_FAMILIARES} familiares.", 'familiares')
        limpio['familiares'] = [_familiar(item, i, hoy) for i, item in enumerate(lista)]
    if 'sin_familiares' in datos:
        if not isinstance(datos['sin_familiares'], bool):
            raise _error("«Sin familiares» debe ser verdadero o falso.", 'sin_familiares')
        limpio['sin_familiares'] = datos['sin_familiares']
    if 'vivienda' in datos:
        v = _solo_claves(datos['vivienda'], _CLAVES_VIVIENDA, "la vivienda", 'vivienda')
        out = {}
        for clave, valor in v.items():
            if valor in (None, ''):
                continue
            campo = f'vivienda.{clave}'
            if clave == 'direccion_exacta':
                out[clave] = _texto(valor, "La dirección exacta", campo, 300)
            elif clave == 'ciudad_region':
                out[clave] = _texto(valor, "La ciudad o región", campo, 120)
            else:
                out[clave] = _id(valor, "El identificador", campo)
        limpio['vivienda'] = out
    if 'salud' in datos:
        s = _solo_claves(datos['salud'], _CLAVES_SALUD, "la salud", 'salud')
        out = {}
        for clave, valor in s.items():
            campo = f'salud.{clave}'
            if clave == 'grupo_sanguineo_id':
                if valor not in (None, ''):
                    out[clave] = _id(valor, "El grupo sanguíneo", campo)
            elif valor is not None:
                out[clave] = _lista_de_ids(valor, f"La lista «{clave}»", campo)
        limpio['salud'] = out
    if 'tallas' in datos:
        t = _solo_claves(datos['tallas'], _CLAVES_TALLAS, "las tallas", 'tallas')
        limpio['tallas'] = {
            clave: _id(valor, "La talla", f'tallas.{clave}') for clave, valor in t.items() if valor not in (None, '')
        }
    return limpio


def combinar_borrador(actual: dict | None, nuevo: dict) -> dict:
    """Las secciones de `nuevo` reemplazan a las de `actual`; las omitidas se conservan."""
    return {**(actual or {}), **nuevo}


def ids_de_catalogo(datos: dict) -> dict[str, list]:
    """Ids que el borrador usa, agrupados por catálogo, para que quien persiste compruebe que existen."""
    familiares = datos.get('familiares') or []
    v, s, t = datos.get('vivienda') or {}, datos.get('salud') or {}, datos.get('tallas') or {}
    return {
        'parentesco': [f['parentesco_id'] for f in familiares if f.get('parentesco_id')],
        'sexo': [f['sexo_id'] for f in familiares if f.get('sexo_id')],
        'condicion_vivienda': [v['condicion_vivienda_id']] if v.get('condicion_vivienda_id') else [],
        'grupo_sanguineo': [s['grupo_sanguineo_id']] if s.get('grupo_sanguineo_id') else [],
        'alergia': list(s.get('alergias') or []),
        'patologia_cronica': list(s.get('patologias_cronicas') or []),
        'discapacidad': list(s.get('discapacidades') or []),
        'talla': [t[k] for k in ('talla_camisa_id', 'talla_pantalon_id', 'talla_zapatos_id', 'talla_chaqueta_id') if t.get(k)],
    }


def faltantes_ventana2(datos: dict | None, tiene_foto: bool) -> list[dict]:
    """
    Lo que falta para poder ENVIAR la Ventana 2: `[{campo, seccion, mensaje}]`; vacío = completa. `campo` es la ruta
    (`vivienda.direccion_exacta`, `familiares.0.fecha_nacimiento`, `foto`) para que el formulario marque el hueco.
    """
    datos = datos or {}
    faltan: list[dict] = []

    def falta(seccion: str, campo: str, mensaje: str) -> None:
        faltan.append({'seccion': seccion, 'campo': campo, 'mensaje': mensaje})

    familiares = datos.get('familiares') or []
    if not familiares and not datos.get('sin_familiares'):
        falta('familiares', 'familiares', "Registre al menos un familiar o declare que no tiene carga familiar.")
    if familiares and datos.get('sin_familiares'):
        falta('familiares', 'sin_familiares', "No puede declarar «sin familiares» y a la vez registrar familiares.")
    for i, f in enumerate(familiares):
        for clave in OBLIGATORIOS_FAMILIAR:
            if not f.get(clave):
                falta('familiares', f'familiares.{i}.{clave}', f"Falta {ETIQUETAS[clave]} del familiar {i + 1}.")
        if 'depende_economicamente' not in f:
            falta('familiares', f'familiares.{i}.depende_economicamente',
                  f"Indique si el familiar {i + 1} depende económicamente de usted.")
    for seccion, obligatorios in (
        ('vivienda', OBLIGATORIOS_VIVIENDA), ('salud', OBLIGATORIOS_SALUD), ('tallas', OBLIGATORIOS_TALLAS),
    ):
        contenido = datos.get(seccion) or {}
        for clave in obligatorios:
            if not contenido.get(clave):
                falta(seccion, f'{seccion}.{clave}', f"Falta {ETIQUETAS[clave]}.")
    if not tiene_foto:
        falta('foto', 'foto', "Falta la foto de carnet.")
    return faltan
