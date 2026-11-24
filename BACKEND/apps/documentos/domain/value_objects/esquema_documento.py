"""
Esquema y validación de las definiciones de plantilla (F-1).

Dos modos:

``formulario`` (formato propio de CONATEL) — definición::

    {"pagina": {"tamano": "carta|oficio", "orientacion": "vertical|horizontal"},
     "encabezado": {"tipo": "institucional|logo_propio|ninguno", "titulo": "...", "subtitulo": "...",
                    "logo_clave": "<clave opaca, solo con logo_propio>"},
     "bloques": [ {"id": "...", "tipo": <tipo de bloque>, ...} ]}

  Tipos de bloque: ``seccion`` (titulo), ``fila_campos`` (celdas: etiqueta, variable|null, ancho; alto_mm mínimo de la fila),
  ``casillas`` (etiqueta, variable, opciones[{valor, etiqueta}], columnas), ``tabla`` (titulo, coleccion,
  columnas[{variable, etiqueta, ancho}], filas_minimas), ``parrafo`` (texto con {variables}, alineacion),
  ``foto`` (alineacion, ancho_mm, alto_mm), ``firmas`` (firmantes[{etiqueta}]) y ``salto_pagina``.

``pdf_overlay`` (formato de terceros) — definición::

    {"paginas": [ {"origen": <n.º de página del PDF de fondo>, "campos": [ <campo> ]} ]}

  Las coordenadas son milímetros desde la esquina superior izquierda de la página. Tipos de campo:
  ``texto`` (texto con {variables}, tamano, alineacion, negrita), ``casilla`` (condicion → «X»),
  ``foto`` y ``tabla`` (coleccion, columnas[{variable, dx, ancho, alineacion}], interlineado, filas_max).

Los «campos propios» (`campos_propios`) son comunes a ambos modos.
"""
from apps.documentos.domain.services.variables_documento import (
    CLAVES_COLECCION,
    POR_CLAVE,
    TIPOS_CAMPO_PROPIO,
    es_clave_propia_valida,
    es_variable_escalar,
    variables_desconocidas,
)
from core.domain.exceptions import ValidationError

MODOS = ('formulario', 'pdf_overlay')
MOMENTOS = ('ventana2', 'contratacion', 'otro')
FIRMANTES = ('postulante', 'conatel', 'ambos')

TAMANOS_PAGINA = ('carta', 'oficio')
ORIENTACIONES = ('vertical', 'horizontal')
TIPOS_ENCABEZADO = ('institucional', 'logo_propio', 'ninguno')
TIPOS_BLOQUE = ('seccion', 'fila_campos', 'casillas', 'tabla', 'parrafo', 'foto', 'firmas', 'salto_pagina')
ALINEACIONES_TEXTO = ('izquierda', 'centro', 'derecha', 'justificado')
OPERADORES = ('igual', 'distinto', 'no_vacio', 'vacio')
TIPOS_CAMPO_OVERLAY = ('texto', 'casilla', 'foto', 'tabla')

MAX_BLOQUES = 120
MAX_CELDAS = 6
MAX_OPCIONES = 12
MAX_COLUMNAS_TABLA = 8
MAX_FILAS_MINIMAS = 40
MAX_FIRMANTES = 4
MAX_CAMPOS_PROPIOS = 40
MAX_PAGINAS_OVERLAY = 30
MAX_CAMPOS_POR_PAGINA = 250
MAX_TEXTO = 4000
MAX_ETIQUETA = 300
TAMANO_FUENTE = (5.0, 28.0)
LADO_MAXIMO_MM = 700.0

DEFINICION_FORMULARIO_VACIA = {
    'pagina': {'tamano': 'carta', 'orientacion': 'vertical'},
    'encabezado': {'tipo': 'institucional', 'titulo': 'Título del documento', 'subtitulo': ''},
    'bloques': [],
}
DEFINICION_OVERLAY_VACIA = {'paginas': []}


def definicion_vacia(modo: str) -> dict:
    import copy
    return copy.deepcopy(DEFINICION_FORMULARIO_VACIA if modo == 'formulario' else DEFINICION_OVERLAY_VACIA)


def _err(mensaje: str, campo: str | None = None):
    raise ValidationError(mensaje, campo=campo)


def _texto(valor, campo: str, maximo: int = MAX_ETIQUETA, obligatorio: bool = False) -> str:
    if valor is None:
        valor = ''
    if not isinstance(valor, str):
        _err('Debe ser un texto.', campo)
    valor = valor.strip()
    if obligatorio and not valor:
        _err('Es obligatorio.', campo)
    if len(valor) > maximo:
        _err(f'No puede superar {maximo} caracteres.', campo)
    return valor


def _numero(valor, campo: str, minimo: float, maximo: float, defecto: float | None = None) -> float:
    if valor is None and defecto is not None:
        return defecto
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        _err('Debe ser un número.', campo)
    if not minimo <= float(valor) <= maximo:
        _err(f'Debe estar entre {minimo:g} y {maximo:g}.', campo)
    return float(valor)


def _opcion(valor, permitidos, campo: str, defecto: str | None = None) -> str:
    if valor is None and defecto is not None:
        return defecto
    if valor not in permitidos:
        _err(f'Valor no permitido; use uno de: {", ".join(permitidos)}.', campo)
    return valor


# ───────────────────────── campos propios ─────────────────────────

def validar_campos_propios(campos) -> list[dict]:
    if campos is None:
        return []
    if not isinstance(campos, list):
        _err('Los campos propios deben ser una lista.', 'campos_propios')
    if len(campos) > MAX_CAMPOS_PROPIOS:
        _err(f'Se admiten hasta {MAX_CAMPOS_PROPIOS} campos propios.', 'campos_propios')
    salida, vistas = [], set()
    for i, c in enumerate(campos):
        ruta = f'campos_propios.{i}'
        if not isinstance(c, dict):
            _err('Cada campo propio debe ser un objeto.', ruta)
        clave = _texto(c.get('clave'), f'{ruta}.clave', 40, obligatorio=True)
        if not es_clave_propia_valida(clave):
            _err('La clave usa minúsculas, números y guion bajo, y empieza con una letra.', f'{ruta}.clave')
        if clave in vistas:
            _err(f'La clave «{clave}» está repetida.', f'{ruta}.clave')
        vistas.add(clave)
        tipo = _opcion(c.get('tipo'), TIPOS_CAMPO_PROPIO, f'{ruta}.tipo', 'texto')
        campo = {
            'clave': clave,
            'etiqueta': _texto(c.get('etiqueta'), f'{ruta}.etiqueta', obligatorio=True),
            'tipo': tipo,
            'obligatorio': bool(c.get('obligatorio', False)),
            'ayuda': _texto(c.get('ayuda'), f'{ruta}.ayuda', 240),
        }
        if tipo == 'opcion':
            opciones = c.get('opciones')
            if not isinstance(opciones, list) or not 1 <= len(opciones) <= 30:
                _err('Indique de 1 a 30 opciones.', f'{ruta}.opciones')
            campo['opciones'] = [_texto(o, f'{ruta}.opciones', 80, obligatorio=True) for o in opciones]
        salida.append(campo)
    return salida


# ───────────────────────── modo formulario ─────────────────────────

def _id_bloque(b: dict, i: int, vistos: set) -> str:
    bid = _texto(b.get('id'), f'bloques.{i}.id', 60) or f'b{i + 1}'
    if bid in vistos:
        _err(f'El identificador «{bid}» está repetido.', f'bloques.{i}.id')
    vistos.add(bid)
    return bid


def _variable_escalar_o_vacia(valor, propios, campo: str):
    if valor in (None, ''):
        return None
    if not isinstance(valor, str) or not es_variable_escalar(valor, propios):
        _err(f'Variable desconocida: «{valor}».', campo)
    return valor


def _validar_texto_con_variables(texto: str, propios, campo: str) -> None:
    desconocidas = variables_desconocidas(texto, propios)
    if desconocidas:
        _err('Variable desconocida: ' + ', '.join('{' + v + '}' for v in desconocidas), campo)


def _validar_bloque(b, i: int, propios, vistos: set) -> dict:
    ruta = f'bloques.{i}'
    if not isinstance(b, dict):
        _err('Cada bloque debe ser un objeto.', ruta)
    tipo = _opcion(b.get('tipo'), TIPOS_BLOQUE, f'{ruta}.tipo')
    salida: dict = {'id': _id_bloque(b, i, vistos), 'tipo': tipo}
    if tipo == 'seccion':
        salida['titulo'] = _texto(b.get('titulo'), f'{ruta}.titulo', obligatorio=True)
    elif tipo == 'fila_campos':
        celdas = b.get('celdas')
        if not isinstance(celdas, list) or not 1 <= len(celdas) <= MAX_CELDAS:
            _err(f'Una fila lleva de 1 a {MAX_CELDAS} celdas.', f'{ruta}.celdas')
        salida['celdas'] = [{
            'etiqueta': _texto(c.get('etiqueta') if isinstance(c, dict) else None, f'{ruta}.celdas.{j}.etiqueta'),
            'variable': _variable_escalar_o_vacia(c.get('variable'), propios, f'{ruta}.celdas.{j}.variable'),
            'ancho': _numero(c.get('ancho'), f'{ruta}.celdas.{j}.ancho', 1, 12, 1),
        } for j, c in enumerate(celdas) if isinstance(c, dict) or _err('Cada celda debe ser un objeto.', f'{ruta}.celdas.{j}')]
        salida['alto_mm'] = _numero(b.get('alto_mm'), f'{ruta}.alto_mm', 8, 120, 12)
    elif tipo == 'casillas':
        variable = b.get('variable')
        if not isinstance(variable, str) or not es_variable_escalar(variable, propios):
            _err('Elija la variable cuyo valor marca la opción.', f'{ruta}.variable')
        opciones = b.get('opciones')
        if not isinstance(opciones, list) or not 1 <= len(opciones) <= MAX_OPCIONES:
            _err(f'Indique de 1 a {MAX_OPCIONES} opciones.', f'{ruta}.opciones')
        salida.update({
            'etiqueta': _texto(b.get('etiqueta'), f'{ruta}.etiqueta'),
            'variable': variable,
            'columnas': int(_numero(b.get('columnas'), f'{ruta}.columnas', 1, 6, 4)),
            'opciones': [{
                'valor': _texto(o.get('valor') if isinstance(o, dict) else None, f'{ruta}.opciones.{j}.valor', 80, True),
                'etiqueta': _texto(o.get('etiqueta'), f'{ruta}.opciones.{j}.etiqueta', 80, True),
            } for j, o in enumerate(opciones) if isinstance(o, dict) or _err('Cada opción debe ser un objeto.', f'{ruta}.opciones.{j}')],
        })
    elif tipo == 'tabla':
        coleccion = b.get('coleccion')
        if coleccion not in CLAVES_COLECCION:
            _err('Elija una colección válida (familiares, estudios, cursos...).', f'{ruta}.coleccion')
        columnas = b.get('columnas')
        if not isinstance(columnas, list) or not 1 <= len(columnas) <= MAX_COLUMNAS_TABLA:
            _err(f'Una tabla lleva de 1 a {MAX_COLUMNAS_TABLA} columnas.', f'{ruta}.columnas')
        validas = {c['clave'] for c in POR_CLAVE[coleccion]['columnas']}
        cols = []
        for j, c in enumerate(columnas):
            if not isinstance(c, dict) or c.get('variable') not in validas:
                _err(f'La columna debe ser de la colección «{coleccion}».', f'{ruta}.columnas.{j}.variable')
            cols.append({
                'variable': c['variable'],
                'etiqueta': _texto(c.get('etiqueta'), f'{ruta}.columnas.{j}.etiqueta', 60) or c['variable'],
                'ancho': _numero(c.get('ancho'), f'{ruta}.columnas.{j}.ancho', 1, 12, 1),
            })
        salida.update({
            'titulo': _texto(b.get('titulo'), f'{ruta}.titulo'), 'coleccion': coleccion, 'columnas': cols,
            'filas_minimas': int(_numero(b.get('filas_minimas'), f'{ruta}.filas_minimas', 0, MAX_FILAS_MINIMAS, 0)),
        })
    elif tipo == 'parrafo':
        texto = _texto(b.get('texto'), f'{ruta}.texto', MAX_TEXTO, obligatorio=True)
        _validar_texto_con_variables(texto, propios, f'{ruta}.texto')
        salida.update({'texto': texto, 'alineacion': _opcion(b.get('alineacion'), ALINEACIONES_TEXTO, f'{ruta}.alineacion', 'justificado')})
    elif tipo == 'foto':
        salida.update({
            'alineacion': _opcion(b.get('alineacion'), ('izquierda', 'centro', 'derecha'), f'{ruta}.alineacion', 'derecha'),
            'ancho_mm': _numero(b.get('ancho_mm'), f'{ruta}.ancho_mm', 15, 80, 30),
            'alto_mm': _numero(b.get('alto_mm'), f'{ruta}.alto_mm', 15, 100, 40),
        })
    elif tipo == 'firmas':
        firmantes = b.get('firmantes')
        if not isinstance(firmantes, list) or not 1 <= len(firmantes) <= MAX_FIRMANTES:
            _err(f'Indique de 1 a {MAX_FIRMANTES} firmantes.', f'{ruta}.firmantes')
        salida['firmantes'] = [{
            'etiqueta': _texto(f.get('etiqueta') if isinstance(f, dict) else None, f'{ruta}.firmantes.{j}.etiqueta', 80, True),
            'detalle': _texto(f.get('detalle') if isinstance(f, dict) else None, f'{ruta}.firmantes.{j}.detalle', 120),
        } for j, f in enumerate(firmantes)]
    return salida


def validar_definicion_formulario(definicion, propios: list[dict]) -> dict:
    if not isinstance(definicion, dict):
        _err('La definición debe ser un objeto.', 'definicion')
    pagina = definicion.get('pagina') or {}
    encabezado = definicion.get('encabezado') or {}
    bloques = definicion.get('bloques', [])
    if not isinstance(bloques, list) or len(bloques) > MAX_BLOQUES:
        _err(f'Se admiten hasta {MAX_BLOQUES} bloques.', 'definicion.bloques')
    tipo_enc = _opcion(encabezado.get('tipo'), TIPOS_ENCABEZADO, 'definicion.encabezado.tipo', 'institucional')
    enc = {
        'tipo': tipo_enc,
        'titulo': _texto(encabezado.get('titulo'), 'definicion.encabezado.titulo', 160),
        'subtitulo': _texto(encabezado.get('subtitulo'), 'definicion.encabezado.subtitulo', 200),
    }
    if tipo_enc == 'logo_propio':
        enc['logo_clave'] = _texto(encabezado.get('logo_clave'), 'definicion.encabezado.logo_clave', 200)
    vistos: set = set()
    return {
        'pagina': {
            'tamano': _opcion(pagina.get('tamano'), TAMANOS_PAGINA, 'definicion.pagina.tamano', 'carta'),
            'orientacion': _opcion(pagina.get('orientacion'), ORIENTACIONES, 'definicion.pagina.orientacion', 'vertical'),
        },
        'encabezado': enc,
        'bloques': [_validar_bloque(b, i, propios, vistos) for i, b in enumerate(bloques)],
    }


# ───────────────────────── modo pdf_overlay ─────────────────────────

def _validar_condicion(c, propios, ruta: str) -> dict:
    if not isinstance(c, dict):
        _err('Indique la condición que marca la casilla.', ruta)
    variable = c.get('variable')
    if not isinstance(variable, str) or not es_variable_escalar(variable, propios):
        _err('Elija la variable de la condición.', f'{ruta}.variable')
    operador = _opcion(c.get('operador'), OPERADORES, f'{ruta}.operador', 'igual')
    valor = _texto(c.get('valor'), f'{ruta}.valor', 120)
    if operador in ('igual', 'distinto') and not valor:
        _err('Indique el valor con el que se compara.', f'{ruta}.valor')
    return {'variable': variable, 'operador': operador, 'valor': valor}


def _validar_campo_overlay(c, ruta: str, propios, ancho_mm: float | None, alto_mm: float | None, vistos: set) -> dict:
    if not isinstance(c, dict):
        _err('Cada campo debe ser un objeto.', ruta)
    tipo = _opcion(c.get('tipo'), TIPOS_CAMPO_OVERLAY, f'{ruta}.tipo')
    cid = _texto(c.get('id'), f'{ruta}.id', 60) or f'c{len(vistos) + 1}'
    if cid in vistos:
        _err(f'El identificador «{cid}» está repetido.', f'{ruta}.id')
    vistos.add(cid)
    x = _numero(c.get('x'), f'{ruta}.x', 0, LADO_MAXIMO_MM)
    y = _numero(c.get('y'), f'{ruta}.y', 0, LADO_MAXIMO_MM)
    w = _numero(c.get('w'), f'{ruta}.w', 1, LADO_MAXIMO_MM, 20)
    h = _numero(c.get('h'), f'{ruta}.h', 1, LADO_MAXIMO_MM, 6)
    # Tolerancia de 1 mm: un campo no puede quedar fuera de la página de fondo.
    if ancho_mm is not None and x > ancho_mm + 1:
        _err('El campo queda fuera de la página (a la derecha).', f'{ruta}.x')
    if alto_mm is not None and y > alto_mm + 1:
        _err('El campo queda fuera de la página (abajo).', f'{ruta}.y')
    salida: dict = {'id': cid, 'tipo': tipo, 'x': x, 'y': y, 'w': w, 'h': h}
    if tipo == 'texto':
        texto = _texto(c.get('texto'), f'{ruta}.texto', MAX_TEXTO, obligatorio=True)
        _validar_texto_con_variables(texto, propios, f'{ruta}.texto')
        salida.update({
            'texto': texto,
            'tamano': _numero(c.get('tamano'), f'{ruta}.tamano', *TAMANO_FUENTE, 9),
            'alineacion': _opcion(c.get('alineacion'), ('izquierda', 'centro', 'derecha'), f'{ruta}.alineacion', 'izquierda'),
            'negrita': bool(c.get('negrita', False)),
        })
    elif tipo == 'casilla':
        salida['condicion'] = _validar_condicion(c.get('condicion'), propios, f'{ruta}.condicion')
    elif tipo == 'tabla':
        coleccion = c.get('coleccion')
        if coleccion not in CLAVES_COLECCION:
            _err('Elija una colección válida.', f'{ruta}.coleccion')
        validas = {col['clave'] for col in POR_CLAVE[coleccion]['columnas']}
        columnas = c.get('columnas')
        if not isinstance(columnas, list) or not 1 <= len(columnas) <= MAX_COLUMNAS_TABLA:
            _err(f'Una tabla lleva de 1 a {MAX_COLUMNAS_TABLA} columnas.', f'{ruta}.columnas')
        cols = []
        for j, col in enumerate(columnas):
            if not isinstance(col, dict) or col.get('variable') not in validas:
                _err(f'La columna debe ser de la colección «{coleccion}».', f'{ruta}.columnas.{j}.variable')
            cols.append({
                'variable': col['variable'],
                'dx': _numero(col.get('dx'), f'{ruta}.columnas.{j}.dx', 0, LADO_MAXIMO_MM, 0),
                'ancho': _numero(col.get('ancho'), f'{ruta}.columnas.{j}.ancho', 1, LADO_MAXIMO_MM, 30),
                'alineacion': _opcion(col.get('alineacion'), ('izquierda', 'centro', 'derecha'), f'{ruta}.columnas.{j}.alineacion', 'izquierda'),
            })
        salida.update({
            'coleccion': coleccion, 'columnas': cols,
            'interlineado': _numero(c.get('interlineado'), f'{ruta}.interlineado', 2, 60, 6),
            'filas_max': int(_numero(c.get('filas_max'), f'{ruta}.filas_max', 1, 60, 5)),
            'tamano': _numero(c.get('tamano'), f'{ruta}.tamano', *TAMANO_FUENTE, 8),
        })
    return salida


def validar_definicion_overlay(definicion, propios: list[dict], paginas_fondo: list[dict] | None) -> dict:
    """`paginas_fondo`: [{numero, ancho_mm, alto_mm}] del PDF de fondo subido (None si aún no hay)."""
    if not isinstance(definicion, dict):
        _err('La definición debe ser un objeto.', 'definicion')
    paginas = definicion.get('paginas', [])
    if not isinstance(paginas, list) or len(paginas) > MAX_PAGINAS_OVERLAY:
        _err(f'Se admiten hasta {MAX_PAGINAS_OVERLAY} páginas.', 'definicion.paginas')
    if paginas and not paginas_fondo:
        _err('Suba primero el PDF de fondo para elegir sus páginas.', 'definicion.paginas')
    por_numero = {p['numero']: p for p in paginas_fondo or []}
    salida, vistos = [], set()
    for i, p in enumerate(paginas):
        ruta = f'definicion.paginas.{i}'
        if not isinstance(p, dict):
            _err('Cada página debe ser un objeto.', ruta)
        origen = p.get('origen')
        if isinstance(origen, bool) or not isinstance(origen, int) or origen not in por_numero:
            _err('La página de origen no existe en el PDF de fondo.', f'{ruta}.origen')
        campos = p.get('campos', [])
        if not isinstance(campos, list) or len(campos) > MAX_CAMPOS_POR_PAGINA:
            _err(f'Se admiten hasta {MAX_CAMPOS_POR_PAGINA} campos por página.', f'{ruta}.campos')
        dim = por_numero[origen]
        salida.append({
            'origen': origen,
            'campos': [_validar_campo_overlay(c, f'{ruta}.campos.{j}', propios, dim['ancho_mm'], dim['alto_mm'], vistos)
                       for j, c in enumerate(campos)],
        })
    return {'paginas': salida}


def validar_definicion(modo: str, definicion, campos_propios, paginas_fondo: list[dict] | None = None) -> tuple[dict, list[dict]]:
    """Valida y normaliza (definición, campos propios) según el modo. Lanza `ValidationError`."""
    if modo not in MODOS:
        _err(f'Modo no permitido; use uno de: {", ".join(MODOS)}.', 'modo')
    propios = validar_campos_propios(campos_propios)
    if modo == 'formulario':
        return validar_definicion_formulario(definicion, propios), propios
    return validar_definicion_overlay(definicion, propios, paginas_fondo), propios


def validar_metadatos(codigo, nombre, momento, firmante, requiere_firma_clic) -> dict:
    return {
        'codigo': _normalizar_codigo(codigo),
        'nombre': _texto(nombre, 'nombre', 160, obligatorio=True),
        'momento': _opcion(momento, MOMENTOS, 'momento', 'otro'),
        'firmante': _opcion(firmante, FIRMANTES, 'firmante', 'postulante'),
        'requiere_firma_clic': bool(requiere_firma_clic),
    }


def _normalizar_codigo(codigo) -> str:
    codigo = _texto(codigo, 'codigo', 60, obligatorio=True).upper().replace(' ', '_')
    if not all(ch.isalnum() or ch in '_-' for ch in codigo):
        _err('El código usa letras, números, guion y guion bajo.', 'codigo')
    return codigo


def validar_valores_propios(campos_propios: list[dict], valores: dict | None) -> dict:
    """Valida los valores que el postulante dio a los campos propios; devuelve {`propio.clave`: valor}."""
    valores = valores or {}
    salida = {}
    for c in campos_propios:
        clave, ruta = c['clave'], f"valores.{c['clave']}"
        v = valores.get(clave)
        vacio = v is None or (isinstance(v, str) and not v.strip())
        if vacio:
            if c.get('obligatorio'):
                _err(f"«{c['etiqueta']}» es obligatorio.", ruta)
            salida['propio.' + clave] = ''
            continue
        if c['tipo'] == 'si_no':
            if str(v).upper() not in ('SI', 'NO', 'TRUE', 'FALSE'):
                _err('Responda Sí o No.', ruta)
            v = 'SI' if str(v).upper() in ('SI', 'TRUE') else 'NO'
        elif c['tipo'] == 'opcion' and v not in c.get('opciones', []):
            _err('Elija una de las opciones.', ruta)
        salida['propio.' + clave] = _texto(str(v), ruta, MAX_TEXTO)
    return salida
