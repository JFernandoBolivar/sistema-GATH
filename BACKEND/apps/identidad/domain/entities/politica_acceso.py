"""
Entidad de Dominio `PoliticaAcceso` (Modelo PBAC / AWS IAM).

Encapsula los conjuntos de reglas de acceso:
- `allow`: Conjunto de códigos o patrones permitidos (ej. '*', 'personal.*', 'cargos.ver').
- `deny`: Conjunto de códigos o patrones explícitamente denegados (tienen máxima prioridad).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class PoliticaAcceso:
    """
    Estructura inmutable de política de autorización.
    Soporta comodín global ('*'), comodín por módulo ('modulo.*') y códigos directos ('modulo.accion').
    """

    allow: frozenset[str] = field(default_factory=frozenset)
    deny: frozenset[str] = field(default_factory=frozenset)

    @classmethod
    def desde_dict(cls, data: dict | None) -> "PoliticaAcceso":
        """Construye una política a partir de un diccionario serializado."""
        if not data or not isinstance(data, dict):
            return cls()
        raw_allow = data.get("allow", [])
        raw_deny = data.get("deny", [])
        
        allow_set = frozenset(str(x).strip().lower() for x in raw_allow if x)
        deny_set = frozenset(str(x).strip().lower() for x in raw_deny if x)
        return cls(allow=allow_set, deny=deny_set)

    def a_dict(self) -> dict[str, list[str]]:
        """Serializa la política a un diccionario ordenado."""
        return {
            "allow": sorted(list(self.allow)),
            "deny": sorted(list(self.deny)),
        }

    def combinar(self, otra: "PoliticaAcceso") -> "PoliticaAcceso":
        """Combina dos políticas (unión de allows y unión de denies)."""
        return PoliticaAcceso(
            allow=self.allow.union(otra.allow),
            deny=self.deny.union(otra.deny),
        )
