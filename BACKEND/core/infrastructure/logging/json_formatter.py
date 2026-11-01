"""
Formatter JSON para los logs operativos (E3).

Cada línea es un objeto JSON con timestamp ISO-8601, nivel, logger, mensaje,
`trace_id` y los campos extra que el llamador agregue con `extra=`. Los campos
`task`, `task_id`, `queue`, `depth`, `error` se emiten como claves propias para
que puedan consultarse sin parsear el mensaje.
"""
import json
import logging
from datetime import datetime, timezone

from core.infrastructure.logging.trace_context import get_trace_id

_RESERVADOS = frozenset(logging.LogRecord('', 0, '', 0, '', (), None).__dict__) | {
    'message', 'asctime', 'taskName',
}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        datos = {
            'timestamp': datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'trace_id': get_trace_id() or '-',
        }
        for clave, valor in record.__dict__.items():
            if clave in _RESERVADOS or clave.startswith('_'):
                continue
            if isinstance(valor, (str, int, float, bool)) or valor is None:
                datos[clave] = valor
            else:
                datos[clave] = str(valor)
        if record.exc_info:
            datos['exception'] = self.formatException(record.exc_info)
        return json.dumps(datos, ensure_ascii=False, default=str)
