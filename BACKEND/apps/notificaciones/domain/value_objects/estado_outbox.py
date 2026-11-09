from enum import Enum


class EstadoOutbox(str, Enum):
    PENDIENTE = 'PENDIENTE'
    ENVIADO = 'ENVIADO'
    FALLIDO = 'FALLIDO'


class Canal(str, Enum):
    EMAIL = 'EMAIL'
