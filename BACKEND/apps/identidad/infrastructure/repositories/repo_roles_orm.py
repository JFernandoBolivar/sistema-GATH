"""
Repositorio ORM del catálogo de roles (CRUD, D-09/B21, CRIT-12).

Implementa el puerto `domain/ports/repo_roles.py` sobre `RolModel`
(`db_table='USER_rol'`, R7): igual que `CuentaModel`, es el espejo propio de
escritura de `apps.identidad`, distinto del `RolEspejo` solo-lectura que usa
la resolución de permisos.
"""
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel


def _rol_a_entidad(fila: RolModel) -> Rol:
    return Rol(
        identificador=fila.pk,
        nombre=fila.nombre_rol,
        descripcion=fila.descripcion_rol or '',
        permisos=(),
    )


class RepoRolesORM:
    """Alta, edición, baja y conteo de uso del catálogo de roles (`USER_rol`)."""

    def listar(self) -> list[Rol]:
        return [_rol_a_entidad(fila) for fila in RolModel.objects.all().order_by('nombre_rol')]

    def obtener_por_id(self, id: int) -> Rol | None:
        fila = RolModel.objects.filter(pk=id).first()
        return _rol_a_entidad(fila) if fila else None

    def existe_nombre(self, nombre: str, excluir_id: int | None = None) -> bool:
        qs = RolModel.objects.filter(nombre_rol__iexact=nombre)
        if excluir_id is not None:
            qs = qs.exclude(pk=excluir_id)
        return qs.exists()

    def crear(self, nombre: str, descripcion: str) -> Rol:
        fila = RolModel.objects.create(nombre_rol=nombre, descripcion_rol=descripcion)
        return _rol_a_entidad(fila)

    def actualizar(self, id: int, nombre: str | None, descripcion: str | None) -> Rol:
        fila = RolModel.objects.get(pk=id)
        if nombre is not None:
            fila.nombre_rol = nombre
        if descripcion is not None:
            fila.descripcion_rol = descripcion
        fila.save()
        return _rol_a_entidad(fila)

    def eliminar(self, id: int) -> None:
        RolModel.objects.filter(pk=id).delete()

    def contar_cuentas_con_rol(self, id: int) -> int:
        return CuentaModel.objects.filter(rol_id=id).count()
