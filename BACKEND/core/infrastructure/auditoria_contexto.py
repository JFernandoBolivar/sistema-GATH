"""
Contexto de origen de la petición para la auditoría (sin Django).

El middleware de `core/presentation` guarda aquí el `origen_de_peticion`
(IP, user-agent y dispositivo) al entrar cada petición y lo limpia al salir.
`core.presentation.audit.registrar_auditoria` completa con estos datos los
campos que el llamador no haya pasado, de modo que un caso de uso o una vista
que audite sin metadata no deje IP/dispositivo vacíos.

Las tareas Celery reciben el mismo diccionario como kwarg `origen` y lo fijan
con `fijar_origen()` (el decorador `con_origen_de_tarea` lo hace solo).
"""
from contextvars import ContextVar
from functools import wraps

_ORIGEN: ContextVar[dict | None] = ContextVar('auditoria_origen', default=None)


def fijar_origen(origen: dict | None) -> None:
    """Fija el origen de la petición/tarea actual."""
    _ORIGEN.set(origen or None)


def limpiar_origen() -> None:
    """Limpia el origen (fin de la petición/tarea)."""
    _ORIGEN.set(None)


def obtener_origen() -> dict:
    """Origen vigente, o `{}` si no hay petición/tarea con contexto."""
    return _ORIGEN.get() or {}


def origen_para_tarea() -> dict:
    """Copia del origen para pasarla como kwarg `origen` al encolar."""
    return dict(obtener_origen())


def con_origen_de_tarea(func):
    """Envuelve una tarea Celery: acepta `origen` y lo fija durante la ejecución."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        origen = kwargs.pop('origen', None)
        fijar_origen(origen)
        try:
            return func(*args, **kwargs)
        finally:
            limpiar_origen()

    return wrapper
