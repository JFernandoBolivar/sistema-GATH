"""
Repositorio ORM del titular de sesión (R-11).

Implementa el puerto `domain/ports/repo_cuenta_auth.py`: resuelve el `user_id`
embebido en el JWT contra `CuentaModel` para revalidar `is_active` y
recuperar los claims (`cedula`, `rol`) en cada rotación (corrige ALTA-08).
"""
from apps.personal.infrastructure.models.personal_models import EmployeeModel

from apps.identidad.domain.entities.titular_sesion import TitularSesion
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel


class RepoCuentaAuthORM:
    """Resolución del titular de sesión por PK, con su rol precargado."""

    def obtener_titular_por_id(self, id: int) -> TitularSesion | None:
        fila = CuentaModel.objects.select_related('rol').filter(pk=id).first()
        if fila is None:
            return None
        return TitularSesion(
            id=fila.pk,
            cedula=str(fila.cedula_id) if fila.cedula_id is not None else None,
            rol_nombre=fila.rol.nombre_rol if fila.rol_id else None,
            is_active=fila.is_active,
        )

    def obtener_objeto_autenticable(self, id: int) -> object | None:
        return CuentaModel.objects.filter(pk=id).first()

    def obtener_cedula_por_email(self, correo: str) -> str | None:
        fila = EmployeeModel.objects.filter(correo=correo).only('cedulaidentidad').first()
        return fila.cedulaidentidad if fila else None

    def obtener_cuenta_por_email_o_cedula(
        self, correo: str | None, cedula: str | None
    ) -> object | None:
        qs = CuentaModel.objects.select_related('cedula', 'rol')
        if correo:
            fila = qs.filter(cedula__correo=correo).first()
        else:
            fila = qs.filter(cedula__cedulaidentidad=cedula).first()
        return fila
