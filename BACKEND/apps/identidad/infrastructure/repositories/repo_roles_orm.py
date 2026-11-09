"""
Repositorio ORM del catálogo de roles (CRUD, D-09/B21, CRIT-12).

Implementa el puerto `domain/ports/repo_roles.py` sobre `RolModel`
(`db_table='USER_rol'`, R7): igual que `CuentaModel`, es el espejo propio de
escritura de `apps.identidad`, distinto del `RolEspejo` solo-lectura que usa
la resolución de permisos.
"""
from django.db import IntegrityError, transaction
from django.db.models import Q

from apps.identidad.domain.entities.rol import Rol
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from core.domain.exceptions import ConflictError


def _rol_a_entidad(fila: RolModel) -> Rol:
    return Rol(
        identificador=fila.pk,
        nombre=fila.nombre_rol,
        descripcion=fila.descripcion_rol or '',
        permisos=(),
        nombre_visible=(fila.nombre_visible or '').strip(),
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

    def existe_nombre_visible(self, nombre_visible: str, excluir_id: int | None = None) -> bool:
        # Un rol sin nombre visible se muestra con su código: ese respaldo también cuenta.
        sin_etiqueta = Q(nombre_visible__isnull=True) | Q(nombre_visible='')
        qs = RolModel.objects.filter(
            Q(nombre_visible__iexact=nombre_visible)
            | (sin_etiqueta & Q(nombre_rol__iexact=nombre_visible))
        )
        if excluir_id is not None:
            qs = qs.exclude(pk=excluir_id)
        return qs.exists()

    def crear(self, codigo: str, nombre_visible: str, descripcion: str) -> Rol:
        try:
            with transaction.atomic():
                fila = RolModel.objects.create(
                    nombre_rol=codigo, nombre_visible=nombre_visible, descripcion_rol=descripcion
                )
        except IntegrityError as exc:
            raise ConflictError(
                'Otro usuario creó un rol con ese nombre al mismo tiempo. Intente de nuevo.'
            ) from exc
        return _rol_a_entidad(fila)

    def actualizar(
        self, id: int, nombre_visible: str | None, descripcion: str | None
    ) -> Rol:
        """Edita solo la etiqueta y la descripción; `nombre_rol` (código) no se toca."""
        fila = RolModel.objects.get(pk=id)
        if nombre_visible is not None:
            fila.nombre_visible = nombre_visible
        if descripcion is not None:
            fila.descripcion_rol = descripcion
        fila.save(update_fields=['nombre_visible', 'descripcion_rol'])
        return _rol_a_entidad(fila)

    def eliminar(self, id: int) -> None:
        RolModel.objects.filter(pk=id).delete()

    def contar_cuentas_con_rol(self, id: int) -> int:
        return CuentaModel.objects.filter(rol_id=id).count()

    def contar_permisos_con_rol(self, id: int) -> int:
        from apps.identidad.infrastructure.models.permiso_model import RolPermisoModel

        return RolPermisoModel.objects.filter(rol_id=id).count()

    def conteos_por_rol(self) -> tuple[dict[int, int], dict[int, int]]:
        """Usuarios y permisos por rol en dos consultas agregadas (sin N+1)."""
        from django.db.models import Count

        from apps.identidad.infrastructure.models.permiso_model import RolPermisoModel

        usuarios = dict(CuentaModel.objects.values_list('rol_id').annotate(total=Count('id')))
        permisos = dict(RolPermisoModel.objects.values_list('rol_id').annotate(total=Count('id')))
        return usuarios, permisos
