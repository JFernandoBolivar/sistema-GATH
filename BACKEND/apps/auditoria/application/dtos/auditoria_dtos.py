"""DTOs de la bitácora de auditoría (D10)."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class RegistroAuditoriaDTO:
    id: str
    fecha_hora: str
    actor_cedula: str
    actor_nombre: str
    actor_rol: str
    modulo: str
    accion: str
    recurso_tipo: str
    recurso_id: str
    ip: str
    user_agent: str
    resultado: str


@dataclass(frozen=True)
class DetalleAuditoriaDTO(RegistroAuditoriaDTO):
    estado_previo: dict | None = None
    estado_nuevo: dict | None = None
    diferencias: list[dict] = field(default_factory=list)


@dataclass(frozen=True)
class IncidenteSeguridadDTO:
    id: str
    fecha_hora: str
    cedula: str
    nombre: str
    ip: str
    resultado: str


@dataclass(frozen=True)
class PaginaAuditoriaDTO:
    resultados: list[RegistroAuditoriaDTO]
    total: int
    pagina: int
    tamano: int

    @property
    def total_paginas(self) -> int:
        return max(1, -(-self.total // self.tamano))


@dataclass(frozen=True)
class DocumentoAuditoriaDTO:
    registros: list[RegistroAuditoriaDTO]
    filtros: list[tuple[str, str]]
    total_encontrados: int
    limite: int
    truncado: bool
