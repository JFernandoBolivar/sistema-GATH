"""
Handlers de logging para el sistema dual de auditoría TXT (B1.12, §I.4.7).

`TimedRotatingFileHandler` permite configurar `namer` y `rotator` para comprimir
en gzip cada archivo rotado al cumplir su periodo de rotación diaria.
"""

from logging.handlers import TimedRotatingFileHandler

from .rotator import gzip_namer, gzip_rotator


class GzipTimedRotatingFileHandler(TimedRotatingFileHandler):
    """Rotación diaria con compresión gzip y retención configurable."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.namer = gzip_namer
        self.rotator = gzip_rotator
