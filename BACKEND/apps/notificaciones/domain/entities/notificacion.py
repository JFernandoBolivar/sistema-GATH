from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Notificacion:
    """Aviso en el sistema (campana/bandeja) para UNA persona, identificada por su cédula."""

    id: str
    destinatario_cedula: str
    tipo: str
    titulo: str
    mensaje: str
    enlace: str = ''
    ref_tipo: str = ''
    ref_id: str = ''
    leida: bool = False
    fecha_lectura: datetime | None = None
    creada_en: datetime | None = None
    clave_unica: str = ''
    modulo: str = 'autogestion'
    # Bandeja compartida: las copias de un aviso por permiso comparten `grupo`; quien actúa primero lo "atiende".
    grupo: str = ''
    atendida: bool = False
    atendida_por_cedula: str = ''
    atendida_por_nombre: str = ''
    fecha_atendida: datetime | None = None
