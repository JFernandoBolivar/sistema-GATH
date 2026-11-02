"""
Entidad de Dominio `CatalogoItem`.
Representa una opción o valor de una tabla maestra (Sexo, Estatus, Tipo Nómina, etc.).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CatalogoItem:
    id: int
    nombre: str
    codigo: str | None = None
    extra: dict = field(default_factory=dict)
