"""Repositorio ORM del flujo de recuperación de contraseña (implementa el puerto homónimo)."""
from apps.identidad.domain.entities.cuenta_recuperacion import CuentaRecuperacion
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel


def _a_entidad(fila: CuentaModel) -> CuentaRecuperacion:
    empleado = fila.cedula
    nombre = f"{empleado.nombres or ''} {empleado.apellidos or ''}".strip()
    return CuentaRecuperacion(
        id=fila.pk,
        cedula=str(fila.cedula_id),
        correo=(empleado.correo or '').strip() or None,
        nombre_completo=nombre,
        password_hash=fila.password or '',
        activa=bool(fila.is_active),
    )


class RepoRecuperacionPasswordORM:
    def _queryset(self):
        return CuentaModel.objects.select_related('cedula')

    def buscar_activa_por_identificador(self, identificador: str) -> CuentaRecuperacion | None:
        qs = self._queryset().filter(is_active=True)
        if '@' in identificador:
            fila = qs.filter(cedula__correo__iexact=identificador).first()
        else:
            fila = qs.filter(cedula_id=identificador).first()
        return _a_entidad(fila) if fila else None

    def obtener_por_id(self, cuenta_id: int) -> CuentaRecuperacion | None:
        fila = self._queryset().filter(pk=cuenta_id).first()
        return _a_entidad(fila) if fila else None

    def restablecer_password(self, cuenta_id: int, password_nuevo: str) -> None:
        cuenta = CuentaModel.objects.get(pk=cuenta_id)
        cuenta.set_password(password_nuevo)
        cuenta.permisos_version = (cuenta.permisos_version or 0) + 1
        cuenta.save(update_fields=['password', 'permisos_version'])
