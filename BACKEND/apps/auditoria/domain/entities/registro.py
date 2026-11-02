"""Entidades de la bitácora de auditoría (D10). Sin Django."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class RegistroAuditoria:
    id: str
    fecha_hora: str
    actor_cedula: str
    actor_nombre: str
    actor_rol: str
    modulo: str
    accion: str
    recurso_tipo: str
    recurso_id: str
    ip: str = ''
    user_agent: str = ''
    resultado: str = 'SUCCESS'
    estado_previo: dict | None = None
    estado_nuevo: dict | None = None


@dataclass(frozen=True)
class IncidenteSeguridad:
    id: str
    fecha_hora: str
    cedula: str
    nombre: str
    ip: str
    resultado: str


@dataclass(frozen=True)
class OpcionesAuditoria:
    acciones: list[str] = field(default_factory=list)
    modulos: list[str] = field(default_factory=list)
    resultados: list[str] = field(default_factory=list)
