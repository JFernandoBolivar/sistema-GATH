"""
Almacenamiento de contexto para comunicar el ID y número del punto de cuenta
generado en la petición actual a las vistas que responden al cliente.
Utiliza contextvars (seguro para asyncio y thread-safe en ASGI/WSGI).
"""
import contextvars
from typing import Any

_ultimo_punto_cuenta = contextvars.ContextVar('ultimo_punto_cuenta', default=None)


def guardar_ultimo_punto_cuenta(datos: Any) -> None:
    """Guarda la información del punto de cuenta recién generado en el contexto de la petición."""
    _ultimo_punto_cuenta.set(datos)


def obtener_ultimo_punto_cuenta() -> Any:
    """Recupera el punto de cuenta generado en la petición actual, o None."""
    return _ultimo_punto_cuenta.get()


def limpiar_ultimo_punto_cuenta() -> None:
    """Limpia el contexto de punto de cuenta."""
    _ultimo_punto_cuenta.set(None)
