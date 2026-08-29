"""
Handlers de logging para el sistema dual de auditoría TXT (B1.12, §I.4.7).

`TimedRotatingFileHandler` no expone `namer` como parámetro del constructor en
ninguna versión soportada por el proyecto, por lo que no puede declararse
directamente en el dict `LOGGING`. Esta subclase lo asigna tras la construcción,
comprimiendo en gzip cada archivo rotado (ver `rotator.rotar_gzip`).
"""

from logging.handlers import TimedRotatingFileHandler

from .rotator import rotar_gzip


class GzipTimedRotatingFileHandler(TimedRotatingFileHandler):
    """Rotación diaria con compresión gzip y retención configurable."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.namer = rotar_gzip
