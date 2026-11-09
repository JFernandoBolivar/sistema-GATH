"""
Value Object `SecurityHashCarnet` del dominio de carnetización.

Identificador de seguridad único de un carnet emitido. El formato se deriva
del modelo real (`CarnetEmitidoModel.security_hash`, `CharField(max_length=64)`,
`apps/carnetizacion/infrastructure/models/carnetizacion_models.py`) y de su
generación real en `repo_carnetizacion_orm.py::emitir_carnet`:
`hashlib.sha256(data).hexdigest()` — es decir, 64 caracteres hexadecimales en
minúsculas. Inmutable con validación en construcción (regla B5), sin Django ni
DRF (regla B1).
"""
import re
from dataclasses import dataclass

_HASH_RE = re.compile(r'[0-9a-f]{64}')


@dataclass(frozen=True)
class SecurityHashCarnet:
    """Hash SHA-256 hex (64 chars) del carnet; replica el invariante real."""

    valor: str

    def __post_init__(self):
        from core.domain.exceptions import ValidationError

        if not _HASH_RE.fullmatch(self.valor):
            raise ValidationError(
                f"Hash de seguridad inválido: '{self.valor}'. "
                'Se espera un SHA-256 hexadecimal de 64 caracteres.'
            )

    def __str__(self) -> str:
        return self.valor
