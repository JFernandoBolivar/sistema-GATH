"""Repositorio ORM de la versión de permisos por cuenta (implementa `RepoPermisosVersion`)."""
from django.db import transaction
from django.db.models import F

from apps.identidad.infrastructure.legado.cuenta_models import CuentaEspejo
from apps.identidad.infrastructure.models.permisos_version_model import PermisosVersionModel


class RepoPermisosVersionORM:
    def obtener(self, cuenta_id: int) -> int:
        version = (
            PermisosVersionModel.objects.filter(cuenta_id=cuenta_id)
            .values_list('version', flat=True)
            .first()
        )
        return version or 1

    @transaction.atomic
    def incrementar_cuenta(self, cuenta_id: int) -> int:
        fila, creada = PermisosVersionModel.objects.select_for_update().get_or_create(
            cuenta_id=cuenta_id, defaults={'version': 2}
        )
        if not creada:
            fila.version = F('version') + 1
            fila.save(update_fields=['version', 'updated_at'])
            fila.refresh_from_db(fields=['version'])
        return fila.version

    def incrementar_por_cedula(self, cedula: str) -> int | None:
        cuenta_id = (
            CuentaEspejo.objects.filter(cedula=str(cedula)).values_list('id', flat=True).first()
        )
        return self.incrementar_cuenta(cuenta_id) if cuenta_id is not None else None

    @transaction.atomic
    def incrementar_por_rol(self, rol_id: int) -> int:
        ids = list(CuentaEspejo.objects.filter(rol_id=rol_id).values_list('id', flat=True))
        if not ids:
            return 0
        existentes = PermisosVersionModel.objects.filter(cuenta_id__in=ids)
        faltan = set(ids) - set(existentes.values_list('cuenta_id', flat=True))
        PermisosVersionModel.objects.bulk_create(
            [PermisosVersionModel(cuenta_id=i, version=1) for i in faltan], ignore_conflicts=True
        )
        PermisosVersionModel.objects.filter(cuenta_id__in=ids).update(version=F('version') + 1)
        return len(ids)
