"""
Puerto del alta de pensionados por sobrevivencia (C20; reglas B1, B21).
"""
from typing import Protocol

from apps.pasivos.domain.entities.sobreviviente import (
    FamiliarBeneficiario,
    ResultadoAltaSobreviviente,
)


class RepoSobrevivientes(Protocol):
    def titular_fallecido(self, cedula_titular: str) -> bool:
        """`True` si el titular tiene un egreso cuyo motivo es fallecimiento."""
        ...

    def resolver_tipo_nomina_sobrevivencia(self, tipo_nomina_id: int | None) -> int:
        """
        Devuelve el `TipoNomina` de pensionados por sobrevivencia. Con `None`
        usa el del catálogo (nómina de sobrevivientes); con un id, valida que
        sea de pensión por sobrevivencia o lanza `ValidationError`/`NotFoundError`.
        """
        ...

    def listar_familiares_beneficiarios(
        self, cedula_titular: str, familiar_ids: tuple[int, ...] | None = None
    ) -> list[FamiliarBeneficiario]:
        """Familiares indicados, o los marcados `heredero` si no se indican ids."""
        ...

    def crear_pasivo_sobreviviente(
        self,
        cedula_titular: str,
        familiar_id: int,
        tipo_nomina_id: int,
        usuario_id: int | None = None,
    ) -> ResultadoAltaSobreviviente:
        """
        Atómico e idempotente: crea Employee + copia de perfiles + AsigTrabajo
        PASIVO con la pensión de sobrevivencia vinculada al titular. Si el
        Employee del familiar ya es pasivo, devuelve `creado=False`.
        """
        ...
