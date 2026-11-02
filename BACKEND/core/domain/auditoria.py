"""
Reglas puras de la bitácora de auditoría (D10): resultados válidos, enmascarado
de campos sensibles y diferencias legibles entre el estado anterior y el nuevo.
Sin Django.
"""
import hashlib
import json
import re
import unicodedata

RESULTADOS = ('SUCCESS', 'FAILED', 'DENIED')
MASCARA = '***'

# Lista nombrada de campos que nunca deben salir de la bitácora: contraseñas,
# claves, tokens, hashes y secretos. La comparación normaliza camelCase,
# snake_case, acentos, guiones y mayúsculas, y además cubre variantes que
# contienen estas palabras (p. ej. `password_hash`, `refreshToken`, `apiKey`).
CAMPOS_SENSIBLES = (
    'password',
    'contrasena',
    'password_hash',
    'hash',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'secret',
    'api_key',
    'salt',
    'pin',
    'cookie',
    'session',
    'jwt',
    'clave',
    'clave_acceso',
    'clave_temporal',
    'clave_secreta',
    'clave_privada',
)

_PALABRAS_SENSIBLES = (
    'password', 'contrasena', 'token', 'hash', 'secret', 'authorization', 'cookie', 'jwt',
)


def _camel_a_snake(campo: str) -> str:
    """`apiKey` → `api_key`, `refreshToken` → `refresh_token`, `APIKey` → `api_key`."""
    paso1 = re.sub(r'(.)([A-Z][a-z]+)', r'\1_\2', str(campo or ''))
    paso2 = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', paso1)
    return paso2.lower()


def _normalizar(campo: str) -> str:
    sin_acentos = ''.join(
        caracter for caracter in unicodedata.normalize('NFKD', _camel_a_snake(campo))
        if not unicodedata.combining(caracter)
    )
    return sin_acentos.strip().replace('-', '_')


def es_campo_sensible(campo: str) -> bool:
    normalizado = _normalizar(campo)
    if normalizado in CAMPOS_SENSIBLES:
        return True
    return any(palabra in normalizado for palabra in _PALABRAS_SENSIBLES)


def _sensible_por_ruta(ruta: str) -> bool:
    return any(es_campo_sensible(parte) for parte in str(ruta).split('.'))


def sanear_estado(estado):
    """Copia el estado enmascarando valores sensibles, recursivamente."""
    if isinstance(estado, dict):
        return {
            clave: (MASCARA if es_campo_sensible(clave) else sanear_estado(valor))
            for clave, valor in estado.items()
        }
    if isinstance(estado, (list, tuple)):
        return [sanear_estado(valor) for valor in estado]
    return estado


def _aplanar(valor, prefijo: str = '') -> dict:
    """Aplana diccionarios y listas con índice en la ruta (`a.0.password`)."""
    resultado = {}
    if isinstance(valor, dict):
        for clave, item in valor.items():
            ruta = f'{prefijo}.{clave}' if prefijo else str(clave)
            resultado.update(_aplanar(item, ruta))
    elif isinstance(valor, (list, tuple)):
        for indice, item in enumerate(valor):
            ruta = f'{prefijo}.{indice}' if prefijo else str(indice)
            resultado.update(_aplanar(item, ruta))
    elif prefijo:
        resultado[prefijo] = valor
    return resultado


def diferencias(previo: dict | None, nuevo: dict | None) -> list[dict]:
    """Campos que cambiaron, con sus valores ya enmascarados si son sensibles.

    La comparación se hace sobre los valores reales (un cambio de contraseña sí
    es un cambio), pero lo que se devuelve nunca expone el valor: el campo
    aparece con `***` en ambos lados. Las listas también se aplanan, así que un
    secreto dentro de una lista de diccionarios queda enmascarado.
    """
    antes = _aplanar(previo)
    despues = _aplanar(nuevo)
    cambios = []
    for campo in sorted(set(antes) | set(despues)):
        if antes.get(campo) == despues.get(campo):
            continue
        sensible = _sensible_por_ruta(campo)
        cambios.append({
            'campo': campo,
            'antes': MASCARA if sensible else antes.get(campo),
            'despues': MASCARA if sensible else despues.get(campo),
        })
    return cambios

# ─── E1: cadena de hashes de la bitácora ────────────────────────────────
GENESIS_AUDITORIA = '0' * 64

CAMPOS_HASH = (
    'id', 'trace_id', 'actor_id', 'actor_cedula', 'actor_rol', 'modulo', 'accion',
    'recurso_tipo', 'recurso_id', 'ip_origen', 'user_agent', 'dispositivo',
    'estado_previo', 'estado_nuevo', 'resultado',
)


def dispositivo_de_user_agent(user_agent: str | None) -> str:
    """Clasificación estable del cliente (no es autorización)."""
    ua = (user_agent or '').lower()
    if not ua:
        return 'DESCONOCIDO'
    if any(token in ua for token in ('bot', 'crawler', 'spider', 'headless')):
        return 'BOT'
    if 'ipad' in ua or 'tablet' in ua:
        return 'TABLET'
    if any(token in ua for token in ('iphone', 'ipod', 'android', 'mobile')):
        return 'MOVIL'
    return 'ESCRITORIO'


def contenido_hash(registro) -> str:
    """JSON canónico del registro; excluye los propios hashes y la fecha."""
    datos = {}
    for campo in CAMPOS_HASH:
        valor = registro.get(campo) if isinstance(registro, dict) else getattr(registro, campo, None)
        if hasattr(valor, 'isoformat'):
            valor = valor.isoformat()
        datos[campo] = valor
    return json.dumps(datos, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def calcular_hash_registro(registro, hash_anterior: str) -> str:
    return hashlib.sha256(f'{hash_anterior}{contenido_hash(registro)}'.encode('utf-8')).hexdigest()
