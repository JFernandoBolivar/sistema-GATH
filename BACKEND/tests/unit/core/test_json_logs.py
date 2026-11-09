import json
import logging

from core.infrastructure.logging.json_formatter import JsonFormatter
from core.infrastructure.logging.trace_context import reset_trace_id, set_trace_id


def test_formatter_incluye_trace_id_y_campos_extra():
    token = set_trace_id('trace-abc')
    try:
        record = logging.LogRecord(
            'gath.tasks', logging.INFO, __file__, 1, 'celery.queue.metrica', (), None,
        )
        record.queue = 'gath'
        record.depth = 3
        datos = json.loads(JsonFormatter().format(record))
    finally:
        reset_trace_id(token)

    assert datos['level'] == 'INFO'
    assert datos['logger'] == 'gath.tasks'
    assert datos['message'] == 'celery.queue.metrica'
    assert datos['trace_id'] == 'trace-abc'
    assert datos['queue'] == 'gath'
    assert datos['depth'] == 3
    assert 'timestamp' in datos
