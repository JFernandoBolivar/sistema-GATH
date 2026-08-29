"""
Entidad `Rol` con su matriz de permisos (B3.1).

El rol del piloto referencia por `identificador` la fila legada de roles
(`USER.Rol`): la identidad de un rol no se duplica en una tabla nueva; lo que
el módulo posee es su **matriz** de permisos (B9.1 la sustituirá por
`Modulo`/`Permiso`/`RolPermiso`/`CuentaPermiso`). Pura e inmutable (B1, B5).
"""
from dataclasses import dataclass, field

from apps.identidad.domain.entities.permiso import Permiso


@dataclass(frozen=True)
class Rol:
    """Rol legado + los permisos que le concede la matriz del dominio."""

    identificador: int | None
    nombre: str
    descripcion: str = ''
    permisos: tuple[Permiso, ...] = field(default=())

    def __post_init__(self):
        if not self.nombre or not self.nombre.strip():
            from core.domain.exceptions import ValidationError

            raise ValidationError('El nombre del rol es obligatorio.')

    def contiene(self, codigo: str) -> bool:
        """¿Este rol concede el código `[modulo].[accion]` indicado?"""
        return any(p.codigo.valor == codigo for p in self.permisos)

    def codigos(self) -> frozenset[str]:
        """Conjunto inmutable de códigos efectivos del rol."""
        return frozenset(p.codigo.valor for p in self.permisos)
