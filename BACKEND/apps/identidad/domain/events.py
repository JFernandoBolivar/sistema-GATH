"""
Eventos de dominio de identidad (ciclo de vida de las cuentas, D8).

Puros: los casos de uso los publican por un callable inyectado; la infraestructura los traduce
a señales Django y de ahí a avisos por el puerto `Notificador` del kernel (sin llamadas cruzadas).
"""
from dataclasses import dataclass
from enum import Enum


class TipoEventoIdentidad(str, Enum):
    PASSWORD_CAMBIADA = 'PASSWORD_CAMBIADA'
    CUENTA_CREADA = 'CUENTA_CREADA'
    CORREO_ACCESO_CAMBIADO = 'CORREO_ACCESO_CAMBIADO'


class MotivoCambioPassword(str, Enum):
    VOLUNTARIO = 'VOLUNTARIO'
    OBLIGATORIO = 'OBLIGATORIO'  # primer ingreso: dejó la contraseña inicial (la cédula)
    ENLACE = 'ENLACE'  # restablecida con el enlace de recuperación
    RESTABLECIDO_RRHH = 'RESTABLECIDO_RRHH'  # «Restablecer acceso»: se repuso la contraseña inicial


@dataclass(frozen=True)
class EventoIdentidad:
    tipo: TipoEventoIdentidad
    cedula: str
    motivo: str = ''
    dias_vigencia: int = 0
