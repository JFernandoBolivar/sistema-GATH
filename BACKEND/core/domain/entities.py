"""
Entidad base del kernel de dominio (B2.1).

Sin Django, sin DRF, sin ORM (regla B1). Las entidades concretas de cada
módulo (`apps/[modulo]/domain/entities/`) heredan o componen esta base.
"""
import uuid
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Entity:
    """
    Raíz inmutable para toda entidad de dominio en GATH.

    El `id` se genera como UUID si el llamador no provee uno (p. ej. al
    reconstruir la entidad desde el repositorio, donde el id ya existe en BD).
    """

    id: uuid.UUID = field(default_factory=uuid.uuid4)
