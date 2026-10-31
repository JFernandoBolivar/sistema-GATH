"""
Reglas puras de la bitácora de auditoría (D10): resultados válidos, enmascarado
de campos sensibles y diferencias legibles entre el estado anterior y el nuevo.
Sin Django.
"""
import unicodedata

RESULTADOS = ('SUCCESS', 'FAILED', 'DENIED')
MASCARA = '***'

# Lista nombrada de campos que nunca deben salir de la bitácora: contraseñas,
# tokens, hashes y secretos. La comparación normaliza acentos, guiones y
# mayúsculas, y además cubre variantes que contienen estas palabras
# (p. ej. `password_hash`).
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
)

_PALABRAS_SENSIBLES = ('password', 'contrasena', 'token', 'hash', 'secret', 'authorization', 'cookie', 'jwt')


def _normalizar(campo: str) -> str:
    sin_acentos = ''.join(
        caracter for caracter in unicodedata.normalize('NFKD', str(campo or ''))
        if not unicodedata.combining(caracter)
    )
    return sin_acentos.strip().lower().replace('-', '_')


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


def _aplanar(estado: dict | None, prefijo: str = '') -> dict:
    resultado = {}
    if not isinstance(estado, dict):
        return resultado
    for clave, valor in estado.items():
        ruta = f'{prefijo}.{clave}' if prefijo else str(clave)
        if isinstance(valor, dict):
            resultado.update(_aplanar(valor, ruta))
        else:
            resultado[ruta] = valor
    return resultado


def diferencias(previo: dict | None, nuevo: dict | None) -> list[dict]:
    """Campos que cambiaron, con sus valores ya enmascarados si son sensibles.

    La comparación se hace sobre los valores reales (un cambio de contraseña sí
    es un cambio), pero lo que se devuelve nunca expone el valor: el campo
    aparece con `***` en ambos lados.
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

