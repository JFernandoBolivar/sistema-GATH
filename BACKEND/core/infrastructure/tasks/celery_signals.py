"""
Señales Celery para traza y métricas operativas (E3).

- `task_prerun`/`task_postrun`: recuperan el `trace_id` de los headers del
  mensaje y lo ponen en el contexto de logging del worker.
- `task_failure`/`task_retry`: emiten una línea JSON con la tarea, su id y el
  error, sin incluir el contenido del mensaje.
"""
import logging

from celery.signals import task_failure, task_postrun, task_prerun, task_retry

from core.infrastructure.logging.trace_context import reset_trace_id, set_trace_id

logger = logging.getLogger('gath.tasks')
_TOKENS: dict[str, object] = {}


def _trace_de_tarea(task) -> str:
    peticion = getattr(task, 'request', None)
    if peticion is None:
        return ''
    headers = getattr(peticion, 'headers', None) or {}
    return str(headers.get('trace_id') or peticion.get('trace_id') or '')


@task_prerun.connect
def _prerun(task_id=None, task=None, **kwargs):
    token = set_trace_id(_trace_de_tarea(task) or task_id or '')
    if task_id:
        _TOKENS[task_id] = token


@task_postrun.connect
def _postrun(task_id=None, **kwargs):
    token = _TOKENS.pop(task_id, None)
    if token is not None:
        reset_trace_id(token)


@task_failure.connect
def _failure(sender=None, task_id=None, exception=None, **kwargs):
    logger.error(
        'celery.task.failure',
        extra={
            'task': getattr(sender, 'name', ''),
            'task_id': task_id,
            'error': f'{type(exception).__name__}: {exception}'[:500],
        },
    )


@task_retry.connect
def _retry(sender=None, request=None, reason=None, **kwargs):
    logger.warning(
        'celery.task.retry',
        extra={
            'task': getattr(sender, 'name', ''),
            'task_id': getattr(request, 'id', ''),
            'error': str(reason)[:500],
        },
    )
