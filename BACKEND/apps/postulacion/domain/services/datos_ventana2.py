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
      },
      "estudios": [{                             (F-8; al menos UNO al enviar: el nivel más alto alcanzado)
        "nivel_academico_id": id                 (obligatorio)
        "carrera_id", "mencion_id", "institucion_id": ids   (carrera y mención deben encajar con el nivel y la carrera)
      }, ...],                                   (máx. 10)
      "cursos": [{                               (F-8; opcional)
        "capacitacion_id", "institucion_id": ids (obligatorios)
        "fecha_inicio", "fecha_fin": "AAAA-MM-DD" (pasadas; fin >= inicio)
        "horas": 1..9999
      }, ...],                                   (máx. 30)
      "sin_cursos": true | false                 (declaración expresa de que no tiene cursos)
      "trabajo_antes_en_conatel": true | false   (F-8; informativo para RRHH; no es obligatorio)
      "antecedentes": [{                         (F-8; experiencia en la Administración Pública, opcional)
        "organismo_id": id, "fecha_ingreso", "fecha_egreso": "AAAA-MM-DD"   (los tres obligatorios al enviar; egreso >= ingreso)
      }, ...],                                   (máx. 15)
      "sin_antecedentes": true | false           («no he trabajado en la Administración Pública»)
      "idiomas": [{                              (F-8; opcional)
        "idioma_id": id | "otro_idioma": texto <= 60   (uno de los dos: catálogo o nombre libre)
        "nivel": "BIEN" | "REGULAR" | "POCO"
      }, ...],                                   (máx. 15, sin repetir)
      "sin_idiomas": true | false
      "rif": "L-NNNNNNNN-D"                      (F-8; opcional; letra V/E/J/P/G, 8 dígitos y verificador; se normaliza)
    }

Un borrador anterior a F-8 (sin estas claves) sigue siendo válido; solo al ENVIAR se exige al menos un estudio.
Al guardar un borrador todo es opcional (cada sección presente REEMPLAZA a la anterior; la omitida no cambia).
Una clave que no está en el esquema se rechaza. La completitud (`faltantes_ventana2`) solo se exige al ENVIAR.
"""
import re
from datetime import date

from core.domain.exceptions import ValidationError

SECCIONES = (
    'familiares', 'sin_familiares', 'vivienda', 'salud', 'tallas',
    'estudios', 'cursos', 'sin_cursos', 'trabajo_antes_en_conatel', 'antecedentes', 'sin_antecedentes',
    'idiomas', 'sin_idiomas', 'rif',
)
MAX_FAMILIARES = 20
MAX_ESTUDIOS = 10
MAX_CURSOS = 30
MAX_ANTECEDENTES = 15
MAX_IDIOMAS = 15
NIVELES_IDIOMA = ('BIEN', 'REGULAR', 'POCO')
LETRAS_RIF = 'VEJPG'
_PATRON_RIF = re.compile(rf'^([{LETRAS_RIF}])(\d{{7,8}})(\d)$')

_CLAVES_FAMILIAR = frozenset({
    'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'cedula', 'orden_hijo',
    'parentesco_id', 'sexo_id', 'fecha_nacimiento', 'depende_economicamente',
})
_CLAVES_VIVIENDA = frozenset({
    'condicion_vivienda_id', 'estado_id', 'municipio_id', 'parroquia_id', 'direccion_exacta', 'ciudad_region',
})
_CLAVES_SALUD = frozenset({'grupo_sanguineo_id', 'alergias', 'patologias_cronicas', 'discapacidades'})
_CLAVES_TALLAS = frozenset({'talla_camisa_id', 'talla_pantalon_id', 'talla_zapatos_id', 'talla_chaqueta_id'})
_CLAVES_ESTUDIO = frozenset({'nivel_academico_id', 'carrera_id', 'mencion_id', 'institucion_id'})
_CLAVES_CURSO = frozenset({'capacitacion_id', 'institucion_id', 'fecha_inicio', 'fecha_fin', 'horas'})
_CLAVES_ANTECEDENTE = frozenset({'organismo_id', 'fecha_ingreso', 'fecha_egreso'})
_CLAVES_IDIOMA = frozenset({'idioma_id', 'otro_idioma', 'nivel'})

OBLIGATORIOS_FAMILIAR = ('primer_nombre', 'primer_apellido', 'parentesco_id', 'sexo_id', 'fecha_nacimiento')
OBLIGATORIOS_VIVIENDA = ('condicion_vivienda_id', 'estado_id', 'municipio_id', 'parroquia_id', 'direccion_exacta')
OBLIGATORIOS_SALUD = ('grupo_sanguineo_id',)
OBLIGATORIOS_TALLAS = ('talla_camisa_id', 'talla_pantalon_id', 'talla_zapatos_id')
OBLIGATORIOS_ESTUDIO = ('nivel_academico_id',)
OBLIGATORIOS_CURSO = ('capacitacion_id', 'institucion_id')
OBLIGATORIOS_ANTECEDENTE = ('organismo_id', 'fecha_ingreso', 'fecha_egreso')

ETIQUETAS = {
    'primer_nombre': 'el primer nombre', 'primer_apellido': 'el primer apellido', 'parentesco_id': 'el parentesco',
    'sexo_id': 'el sexo', 'fecha_nacimiento': 'la fecha de nacimiento',
    'condicion_vivienda_id': 'el tipo y tenencia de la vivienda', 'estado_id': 'el estado',
    'municipio_id': 'el municipio', 'parroquia_id': 'la parroquia', 'direccion_exacta': 'la dirección exacta',
    'grupo_sanguineo_id': 'el grupo sanguíneo', 'talla_camisa_id': 'la talla de camisa',
    'talla_pantalon_id': 'la talla de pantalón', 'talla_zapatos_id': 'la talla de calzado',
    'nivel_academico_id': 'el nivel académico', 'capacitacion_id': 'el curso', 'institucion_id': 'la institución',
    'organismo_id': 'el organismo', 'fecha_ingreso': 'la fecha de ingreso', 'fecha_egreso': 'la fecha de egreso',
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


def _fecha(valor, etiqueta: str, campo: str, hoy: date) -> date:
    try:
        fecha = date.fromisoformat(str(valor))
    except ValueError as e:
        raise _error(f"{etiqueta} debe tener el formato AAAA-MM-DD.", campo) from e
    if fecha > hoy:
        raise _error(f"{etiqueta} no puede ser futura.", campo)
    return fecha


def normalizar_rif(valor, campo: str = 'rif') -> str:
    """`'v-12345678-9'` -> `'V-12345678-9'`; vacío -> `''`. Mismo formato que el RIF de la ficha (`personal`)."""
    if not isinstance(valor, str):
        raise _error("El RIF debe ser un texto.", campo)
    compacto = re.sub(r'[\s\-]', '', valor).upper()
    if not compacto:
        return ''
    m = _PATRON_RIF.match(compacto)
    if m is None:
        raise _error(
            f"El RIF no tiene un formato válido: use una letra ({', '.join(LETRAS_RIF)}), el número y el dígito "
            "verificador, por ejemplo V-12345678-9.", campo,
        )
    letra, cuerpo, digito = m.groups()
    return f'{letra}-{cuerpo.zfill(8)}-{digito}'


def _lista(valor, nombre: str, campo: str, maximo: int) -> list:
    if not isinstance(valor, list):
        raise _error(f"{nombre} debe ser una lista.", campo)
    if len(valor) > maximo:
        raise _error(f"Se admiten como máximo {maximo} en {nombre.lower()}.", campo)
    return valor


def _estudio(item, indice: int) -> dict:
    base = f'estudios.{indice}'
    _solo_claves(item, _CLAVES_ESTUDIO, f"el estudio {indice + 1}", base)
    return {c: _id(v, "El identificador", f'{base}.{c}') for c, v in item.items() if v not in (None, '')}


def _curso(item, indice: int, hoy: date) -> dict:
    base = f'cursos.{indice}'
    _solo_claves(item, _CLAVES_CURSO, f"el curso {indice + 1}", base)
    out: dict = {}
    for clave, valor in item.items():
        if valor in (None, ''):
            continue
        campo = f'{base}.{clave}'
        if clave in ('fecha_inicio', 'fecha_fin'):
            out[clave] = _fecha(valor, "La fecha del curso" if clave == 'fecha_inicio' else "La fecha de fin del curso", campo, hoy).isoformat()
        elif clave == 'horas':
            horas = _id(valor, "Las horas del curso", campo)
            if horas > 9999:
                raise _error("Las horas del curso deben estar entre 1 y 9999.", campo)
            out[clave] = horas
        else:
            out[clave] = _id(valor, "El identificador", campo)
    if out.get('fecha_inicio') and out.get('fecha_fin') and out['fecha_fin'] < out['fecha_inicio']:
        raise _error("La fecha de fin del curso no puede ser anterior a la de inicio.", f'{base}.fecha_fin')
    return out


def _antecedente(item, indice: int, hoy: date) -> dict:
    base = f'antecedentes.{indice}'
    _solo_claves(item, _CLAVES_ANTECEDENTE, f"la experiencia {indice + 1}", base)
    out: dict = {}
    for clave, valor in item.items():
        if valor in (None, ''):
            continue
        campo = f'{base}.{clave}'
        if clave == 'organismo_id':
            out[clave] = _id(valor, "El organismo", campo)
        else:
            etiqueta = "La fecha de ingreso" if clave == 'fecha_ingreso' else "La fecha de egreso"
            out[clave] = _fecha(valor, etiqueta, campo, hoy).isoformat()
    if out.get('fecha_ingreso') and out.get('fecha_egreso') and out['fecha_egreso'] < out['fecha_ingreso']:
        raise _error("La fecha de egreso no puede ser anterior a la fecha de ingreso.", f'{base}.fecha_egreso')
    return out


def _idioma(item, indice: int) -> dict:
    base = f'idiomas.{indice}'
    _solo_claves(item, _CLAVES_IDIOMA, f"el idioma {indice + 1}", base)
    out: dict = {}
    if item.get('idioma_id') not in (None, ''):
        out['idioma_id'] = _id(item['idioma_id'], "El idioma", f'{base}.idioma_id')
    if item.get('otro_idioma') not in (None, ''):
        otro = _texto(item['otro_idioma'], "El nombre del idioma", f'{base}.otro_idioma', 60)
        if otro:
            out['otro_idioma'] = otro
    if 'idioma_id' in out and 'otro_idioma' in out:
        raise _error(f"Indique el idioma {indice + 1}: elija uno de la lista o escriba otro (no ambos).", f'{base}.otro_idioma')
    if item.get('nivel') not in (None, ''):
        nivel = str(item['nivel']).strip().upper()
        if nivel not in NIVELES_IDIOMA:
            raise _error(f"El nivel del idioma debe ser {', '.join(NIVELES_IDIOMA)}.", f'{base}.nivel')
        out['nivel'] = nivel
    return out


def _booleano(valor, etiqueta: str, campo: str) -> bool:
    if not isinstance(valor, bool):
        raise _error(f"«{etiqueta}» debe ser verdadero o falso.", campo)
    return valor


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
    if 'estudios' in datos:
        lista = _lista(datos['estudios'], "Los estudios", 'estudios', MAX_ESTUDIOS)
        limpio['estudios'] = [_estudio(item, i) for i, item in enumerate(lista)]
    if 'cursos' in datos:
        lista = _lista(datos['cursos'], "Los cursos", 'cursos', MAX_CURSOS)
        limpio['cursos'] = [_curso(item, i, hoy) for i, item in enumerate(lista)]
    if 'antecedentes' in datos:
        lista = _lista(datos['antecedentes'], "Los antecedentes", 'antecedentes', MAX_ANTECEDENTES)
        limpio['antecedentes'] = [_antecedente(item, i, hoy) for i, item in enumerate(lista)]
    if 'idiomas' in datos:
        lista = _lista(datos['idiomas'], "Los idiomas", 'idiomas', MAX_IDIOMAS)
        limpio['idiomas'] = [_idioma(item, i) for i, item in enumerate(lista)]
    for clave, etiqueta in (
        ('sin_cursos', 'Sin cursos'), ('sin_antecedentes', 'Sin experiencia en la Administración Pública'),
        ('sin_idiomas', 'Sin idiomas'), ('trabajo_antes_en_conatel', '¿Trabajó antes en CONATEL?'),
    ):
        if clave in datos and datos[clave] is not None:
            limpio[clave] = _booleano(datos[clave], etiqueta, clave)
    if 'rif' in datos:
        limpio['rif'] = normalizar_rif(datos['rif'] if datos['rif'] is not None else '')
    return limpio


def combinar_borrador(actual: dict | None, nuevo: dict) -> dict:
    """Las secciones de `nuevo` reemplazan a las de `actual`; las omitidas se conservan."""
    return {**(actual or {}), **nuevo}


def ids_de_catalogo(datos: dict) -> dict[str, list]:
    """Ids que el borrador usa, agrupados por catálogo, para que quien persiste compruebe que existen."""
    familiares = datos.get('familiares') or []
    v, s, t = datos.get('vivienda') or {}, datos.get('salud') or {}, datos.get('tallas') or {}
    estudios, cursos = datos.get('estudios') or [], datos.get('cursos') or []
    antecedentes, idiomas = datos.get('antecedentes') or [], datos.get('idiomas') or []
    return {
        'parentesco': [f['parentesco_id'] for f in familiares if f.get('parentesco_id')],
        'sexo': [f['sexo_id'] for f in familiares if f.get('sexo_id')],
        'condicion_vivienda': [v['condicion_vivienda_id']] if v.get('condicion_vivienda_id') else [],
        'grupo_sanguineo': [s['grupo_sanguineo_id']] if s.get('grupo_sanguineo_id') else [],
        'alergia': list(s.get('alergias') or []),
        'patologia_cronica': list(s.get('patologias_cronicas') or []),
        'discapacidad': list(s.get('discapacidades') or []),
        'talla': [t[k] for k in ('talla_camisa_id', 'talla_pantalon_id', 'talla_zapatos_id', 'talla_chaqueta_id') if t.get(k)],
        'nivel_academico': [e['nivel_academico_id'] for e in estudios if e.get('nivel_academico_id')],
        'carrera': [e['carrera_id'] for e in estudios if e.get('carrera_id')],
        'mencion': [e['mencion_id'] for e in estudios if e.get('mencion_id')],
        'institucion': [x['institucion_id'] for x in estudios + cursos if x.get('institucion_id')],
        'capacitacion': [c['capacitacion_id'] for c in cursos if c.get('capacitacion_id')],
        'organismo': [a['organismo_id'] for a in antecedentes if a.get('organismo_id')],
        'idioma': [i['idioma_id'] for i in idiomas if i.get('idioma_id')],
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
    estudios = datos.get('estudios') or []
    if not estudios:
        falta('estudios', 'estudios', "Registre al menos un estudio: el nivel académico más alto que alcanzó.")
    for i, e in enumerate(estudios):
        for clave in OBLIGATORIOS_ESTUDIO:
            if not e.get(clave):
                falta('estudios', f'estudios.{i}.{clave}', f"Falta {ETIQUETAS[clave]} del estudio {i + 1}.")
    cursos = datos.get('cursos') or []
    if cursos and datos.get('sin_cursos'):
        falta('cursos', 'sin_cursos', "No puede declarar que no tiene cursos y a la vez registrar cursos.")
    for i, c in enumerate(cursos):
        for clave in OBLIGATORIOS_CURSO:
            if not c.get(clave):
                falta('cursos', f'cursos.{i}.{clave}', f"Falta {ETIQUETAS[clave]} del curso {i + 1}.")
    antecedentes = datos.get('antecedentes') or []
    if antecedentes and datos.get('sin_antecedentes'):
        falta('antecedentes', 'sin_antecedentes',
              "No puede declarar que no ha trabajado en la Administración Pública y a la vez registrar experiencia.")
    for i, a in enumerate(antecedentes):
        for clave in OBLIGATORIOS_ANTECEDENTE:
            if not a.get(clave):
                falta('antecedentes', f'antecedentes.{i}.{clave}', f"Falta {ETIQUETAS[clave]} de la experiencia {i + 1}.")
    idiomas = datos.get('idiomas') or []
    if idiomas and datos.get('sin_idiomas'):
        falta('idiomas', 'sin_idiomas', "No puede declarar que no domina otros idiomas y a la vez registrar idiomas.")
    for i, idioma in enumerate(idiomas):
        if not idioma.get('idioma_id') and not idioma.get('otro_idioma'):
            falta('idiomas', f'idiomas.{i}.idioma_id', f"Falta el idioma {i + 1}.")
        if not idioma.get('nivel'):
            falta('idiomas', f'idiomas.{i}.nivel', f"Falta el nivel del idioma {i + 1}.")
    if not tiene_foto:
        falta('foto', 'foto', "Falta la foto de carnet.")
    return faltan
