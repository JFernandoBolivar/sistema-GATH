"""
Repositorio ORM del módulo identidad (B3.1).

Implementa el puerto `domain/ports/repo_permisos.py` (D-09/B21). Aquí vive el
único ORM del módulo: los casos de uso y las vistas jamás tocan `objects.`
(reglas B4/B7). Los datos legados de la cuenta se leen por el modelo espejo,
sin importar USER (B16).
"""
from apps.identidad.domain.entities.permiso import Permiso
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.domain.entities.usuario_permisos import UsuarioPermisos
from apps.identidad.infrastructure.legado.cuenta_models import (
    CuentaEspejo,
    RolEspejo,
)
from apps.identidad.infrastructure.mappers.mapper_permisos import (
    permiso_a_entidad,
    rol_a_entidad,
)
from apps.identidad.infrastructure.models.permiso_model import (
    PermisoModel,
    RolPermisoModel,
)
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.identidad.infrastructure.models.usuario_permiso_model import (
    UsuarioPermisoModel,
)


class RepoPermisosORM:
    """Lectura y gestión del catálogo de permisos, roles y políticas de usuario."""

    def listar(self) -> list[Permiso]:
        return [
            permiso_a_entidad(fila) for fila in PermisoModel.objects.all()
        ]

    def obtener_por_codigo(self, codigo: str) -> Permiso | None:
        fila = PermisoModel.objects.filter(codigo=codigo).first()
        return permiso_a_entidad(fila) if fila else None

    def existe_codigo(self, codigo: str) -> bool:
        return PermisoModel.objects.filter(codigo=codigo).exists()

    def permisos_del_rol(self, rol_id: int) -> tuple[Permiso, ...]:
        filas = RolPermisoModel.objects.filter(
            rol_id=rol_id
        ).select_related('permiso')
        return tuple(
            permiso_a_entidad(asignacion.permiso) for asignacion in filas
        )

    def codigos_del_rol(self, rol_id: int) -> frozenset[str]:
        return frozenset(
            RolPermisoModel.objects.filter(rol_id=rol_id).values_list(
                'permiso__codigo', flat=True
            )
        )

    def politica_del_rol(self, rol_id: int) -> PoliticaAcceso:
        codigos = self.codigos_del_rol(rol_id)
        return PoliticaAcceso(allow=codigos, deny=frozenset())

    def rol_de_cuenta(self, cedula: str) -> Rol | None:
        fila_cuenta = CuentaEspejo.objects.filter(cedula=cedula).first()
        if fila_cuenta is None or fila_cuenta.rol_id is None:
            return None
        nombre_rol = (
            RolEspejo.objects.filter(pk=fila_cuenta.rol_id)
            .values_list('nombre_rol', flat=True)
            .first()
        ) or f'ROL_{fila_cuenta.rol_id}'
        filas_permisos = RolPermisoModel.objects.filter(
            rol_id=fila_cuenta.rol_id
        ).select_related('permiso')
        if not filas_permisos.exists():
            return Rol(
                identificador=fila_cuenta.rol_id,
                nombre=nombre_rol,
                descripcion='',
                permisos=(),
            )
        return rol_a_entidad(
            fila_cuenta.rol_id,
            nombre_rol,
            (asignacion.permiso for asignacion in filas_permisos),
        )

    def obtener_permisos_usuario(self, cedula: str) -> UsuarioPermisos | None:
        fila_cuenta = CuentaEspejo.objects.filter(cedula=cedula).first()
        if fila_cuenta is None:
            return None

        rol_id = fila_cuenta.rol_id
        nombre_rol = None
        politica_rol = PoliticaAcceso()

        if rol_id is not None:
            nombre_rol = (
                RolEspejo.objects.filter(pk=rol_id)
                .values_list('nombre_rol', flat=True)
                .first()
            ) or f'ROL_{rol_id}'
            politica_rol = self.politica_del_rol(rol_id)

        override_row = UsuarioPermisoModel.objects.filter(cedula=cedula).first()
        if override_row:
            custom_policy = PoliticaAcceso.desde_dict(override_row.permisos_custom)
            version = override_row.version
        else:
            custom_policy = PoliticaAcceso()
            version = 1

        politica_efectiva = PoliticaAcceso(
            allow=politica_rol.allow.union(custom_policy.allow),
            deny=politica_rol.deny.union(custom_policy.deny),
        )

        return UsuarioPermisos(
            cedula=cedula,
            rol_id=rol_id,
            nombre_rol=nombre_rol,
            permisos_custom=custom_policy,
            politica_efectiva=politica_efectiva,
            version=version,
        )

    def guardar_override_usuario(
        self,
        cedula: str,
        custom_allow: list[str] | frozenset[str],
        custom_deny: list[str] | frozenset[str],
    ) -> UsuarioPermisos:
        usuario_actual = self.obtener_permisos_usuario(cedula)
        nueva_version = (usuario_actual.version + 1) if usuario_actual else 1

        custom_policy = PoliticaAcceso(
            allow=frozenset(str(x).strip().lower() for x in custom_allow if x),
            deny=frozenset(str(x).strip().lower() for x in custom_deny if x),
        )

        rol_id = usuario_actual.rol_id if usuario_actual else None
        politica_rol = self.politica_del_rol(rol_id) if rol_id else PoliticaAcceso()
        politica_efectiva = PoliticaAcceso(
            allow=politica_rol.allow.union(custom_policy.allow),
            deny=politica_rol.deny.union(custom_policy.deny),
        )

        UsuarioPermisoModel.objects.update_or_create(
            cedula=cedula,
            defaults={
                'permisos_custom': custom_policy.a_dict(),
                'permisos_efectivos': politica_efectiva.a_dict(),
                'version': nueva_version,
            },
        )

        # Cambió la política individual: las sesiones vigentes de la cuenta se invalidan.
        RepoPermisosVersionORM().incrementar_por_cedula(cedula)

        return UsuarioPermisos(
            cedula=cedula,
            rol_id=rol_id,
            nombre_rol=usuario_actual.nombre_rol if usuario_actual else None,
            permisos_custom=custom_policy,
            politica_efectiva=politica_efectiva,
            version=nueva_version,
        )

