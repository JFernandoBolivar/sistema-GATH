"""
Idiomas que domina el trabajador. Puro: sin Django.

Cada idioma tiene un NIVEL (BIEN, REGULAR o POCO; el dominio global del idioma, sin separar lectura, habla y escritura)
y es del catálogo (`idioma_id`) o, si el catálogo no lo tiene, un nombre libre (`otro_idioma`): exactamente uno de los dos.

    [{"idioma_id": 1, "otro_idioma": "", "nivel": "BIEN"}, {"idioma_id": null, "otro_idioma": "Guaraní", "nivel": "POCO"}]
"""
from core.domain.exceptions import ValidationError

NIVELES_IDIOMA = ('BIEN', 'REGULAR', 'POCO')
MAX_IDIOMAS = 15
MAX_OTRO_IDIOMA = 60


def _error(mensaje: str, campo: str) -> ValidationError:
    return ValidationError(mensaje, campo=campo)


def normalizar_idiomas(lista, *, prefijo: str = 'idiomas') -> list[dict]:
    """
    Devuelve `[{idioma_id, otro_idioma, nivel}]` normalizado (nivel en mayúsculas, nombre sin espacios dobles) o lanza
    `ValidationError` con la ruta del campo. Un mismo idioma (del catálogo o por nombre, sin distinguir mayúsculas) no
    puede repetirse.
    """
    if not isinstance(lista, list):
        raise _error("Los idiomas deben ser una lista.", prefijo)
    if len(lista) > MAX_IDIOMAS:
        raise _error(f"Se admiten como máximo {MAX_IDIOMAS} idiomas.", prefijo)
    limpios: list[dict] = []
    vistos: set = set()
    for i, item in enumerate(lista):
        base = f'{prefijo}.{i}'
        if not isinstance(item, dict):
            raise _error(f"El idioma {i + 1} debe ser un objeto.", base)
        desconocidas = sorted(set(item) - {'idioma_id', 'otro_idioma', 'nivel'})
        if desconocidas:
            raise _error(f"Datos no admitidos en el idioma {i + 1}: {', '.join(desconocidas)}.", base)
        idioma_id = item.get('idioma_id')
        if idioma_id in (None, ''):
            idioma_id = None
        elif isinstance(idioma_id, bool) or not str(idioma_id).strip().isdigit() or int(idioma_id) < 1:
            raise _error(f"El idioma {i + 1} no es un identificador válido.", f'{base}.idioma_id')
        else:
            idioma_id = int(idioma_id)
        otro = item.get('otro_idioma')
        if otro is None:
            otro = ''
        if not isinstance(otro, str):
            raise _error(f"El nombre del idioma {i + 1} debe ser un texto.", f'{base}.otro_idioma')
        otro = ' '.join(otro.split())
        if len(otro) > MAX_OTRO_IDIOMA:
            raise _error(f"El nombre del idioma admite como máximo {MAX_OTRO_IDIOMA} caracteres.", f'{base}.otro_idioma')
        if (idioma_id is None) == (not otro):
            raise _error(
                f"Indique el idioma {i + 1}: elija uno de la lista o escriba otro (no ambos).",
                f'{base}.idioma_id' if otro else f'{base}.otro_idioma',
            )
        nivel = str(item.get('nivel') or '').strip().upper()
        if nivel not in NIVELES_IDIOMA:
            raise _error(f"Indique el nivel del idioma {i + 1} ({', '.join(NIVELES_IDIOMA)}).", f'{base}.nivel')
        clave = ('id', idioma_id) if idioma_id is not None else ('otro', otro.casefold())
        if clave in vistos:
            raise _error(f"El idioma {i + 1} está repetido.", base)
        vistos.add(clave)
        limpios.append({'idioma_id': idioma_id, 'otro_idioma': otro, 'nivel': nivel})
    return limpios
