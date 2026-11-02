"""
Entidad de Dominio `UsuarioPermisos`.

Representa la configuración y estado de autorización de un usuario específico:
- Su rol institucional asignado (plantilla de permisos base).
- Sus políticas directas personalizadas (`permisos_custom` con allow/deny).
- Su política efectiva compilada para evaluación O(1).
- Su versión de permisos (para invalidación instantánea de JWT).
"""
from dataclasses import dataclass, field

from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.services.evaluador_permisos import evaluar_permiso


@dataclass(frozen=True)
class UsuarioPermisos:
    cedula: str
    rol_id: int | None = None
    nombre_rol: str | None = None
    permisos_custom: PoliticaAcceso = field(default_factory=PoliticaAcceso)
    politica_efectiva: PoliticaAcceso = field(default_factory=PoliticaAcceso)
    version: int = 1

    def tiene_permiso(self, codigo_requerido: str) -> bool:
        """Evalúa un permiso requerido contra la política efectiva del usuario."""
        return evaluar_permiso(self.politica_efectiva, codigo_requerido)
