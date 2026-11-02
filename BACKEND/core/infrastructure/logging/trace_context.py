"""
Contexto de traza por petición/tarea (E3).

El `trace_id` viaja en la cabecera `X-Trace-Id`/`X-Request-ID`, se guarda en un
`ContextVar` para que el formatter JSON lo incluya en cada línea y se propaga a
las tareas Celery mediante los headers del mensaje.
"""
from contextvars import ContextVar

_TRACE_ID: ContextVar[str] = ContextVar('gath_trace_id', default='')


def get_trace_id() -> str:
    return _TRACE_ID.get()


def set_trace_id(trace_id: str):
    return _TRACE_ID.set(trace_id or '')


def reset_trace_id(token) -> None:
    _TRACE_ID.reset(token)
