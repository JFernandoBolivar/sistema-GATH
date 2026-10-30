"""
Repositorio ORM de cuentas de usuario (gestión de usuarios, D-09/B21).

Implementa el puerto `domain/ports/repo_cuentas.py`. Escribe sobre
`CuentaModel` (el espejo propio de `apps.identidad`, `db_table='USER_cuenta'`,
regla R7): a diferencia de `infrastructure/legado/cuenta_models.py`
(`CuentaEspejo`, explícitamente solo-lectura), este modelo sí es el punto de
escritura del módulo — es la misma fila física que usa `USER.cuenta`, así que
un alta/edición aquí es inmediatamente visible para el legado y viceversa
(estrangulamiento, cero migración de datos).

Nota de alcance (R-01): valida la existencia del empleado consultando
`apps.personal.infrastructure.models.personal_models.EmployeeModel` — un
import entre módulos de dominio nuevos que, en sentido estricto, tensiona la
regla B16 ("un módulo nunca importa de un módulo hermano"). Se acepta con el
mismo criterio que el riesgo ya documentado de R-01/`cuenta_filters.py`: la
alternativa (esperar a que exista un puerto `RepoEmpleados` compartido en
`core/`) es una refactorización mayor fuera del alcance de esta tarea, y
`apps.identidad` ya tiene esta dependencia de facto en
`presentation/views/auth_views.py`.
"""
from apps.personal.infrastructure.models.personal_models import EmployeeModel

from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.infrastructure.mappers.mapper_cuenta import cuenta_a_entidad
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.desactivacion_egreso_model import DesactivacionEgresoModel
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from core.domain.exceptions import NotFoundError


class RepoCuentasORM:
    """Alta, edición, listado y cambio de contraseña de cuentas (`USER_cuenta`)."""

    def _queryset(self):
        return CuentaModel.objects.select_related('cedula', 'departamento', 'rol')

    def obtener_por_id(self, id: int) -> Cuenta | None:
        fila = self._queryset().filter(pk=id).first()
        return cuenta_a_entidad(fila) if fila else None

    def obtener_por_cedula(self, cedula: str) -> Cuenta | None:
        fila = self._queryset().filter(cedula_id=cedula).first()
        return cuenta_a_entidad(fila) if fila else None

    def existe_cuenta_para_cedula(self, cedula: str) -> bool:
        return CuentaModel.objects.filter(cedula_id=cedula).exists()

    def listar(self, filtros: dict) -> list[Cuenta]:
        qs = self._queryset()
        departamento_id = filtros.get('departamento_id')
        rol_id = filtros.get('rol_id')
        is_active = filtros.get('is_active')
        cedula = filtros.get('cedula')

        if departamento_id not in (None, ''):
            qs = qs.filter(departamento_id=departamento_id)
        if rol_id not in (None, ''):
            qs = qs.filter(rol_id=rol_id)
        if is_active not in (None, ''):
            qs = qs.filter(is_active=is_active)
        if cedula:
            qs = qs.filter(cedula__cedulaidentidad__icontains=cedula)

        return [cuenta_a_entidad(fila) for fila in qs]

    def crear(
        self, cedula: str, password: str, departamento_id: int | None, rol_id: int | None
    ) -> Cuenta:
        if not EmployeeModel.objects.filter(cedulaidentidad=cedula).exists():
            raise NotFoundError(
                f"La cédula '{cedula}' no pertenece a ningún empleado registrado."
            )

        fila = CuentaModel(
            cedula_id=cedula, departamento_id=departamento_id, rol_id=rol_id
        )
        fila.set_password(password)
        fila.save()
        return cuenta_a_entidad(self._queryset().get(pk=fila.pk))

    def guardar(self, cuenta: Cuenta) -> Cuenta:
        fila = CuentaModel.objects.get(pk=cuenta.id)
        rol_anterior = fila.rol_id
        activa_anterior = fila.is_active
        fila.departamento_id = cuenta.departamento_id
        fila.rol_id = cuenta.rol_id
        fila.is_active = cuenta.is_active
        fila.save()
        if rol_anterior != cuenta.rol_id or activa_anterior != cuenta.is_active:
            RepoPermisosVersionORM().incrementar_cuenta(fila.pk)
        if activa_anterior != cuenta.is_active:
            # Cualquier cambio de estado invalida la marca de baja por egreso; el caso de uso de egreso
            # la vuelve a poner después de guardar.
            DesactivacionEgresoModel.objects.filter(cuenta_id=fila.pk).delete()
        return cuenta_a_entidad(self._queryset().get(pk=fila.pk))

    def verificar_password(self, id: int, password_plano: str) -> bool:
        fila = CuentaModel.objects.filter(pk=id).first()
        return bool(fila and fila.check_password(password_plano))

    def establecer_password(self, id: int, password_nuevo: str) -> None:
        fila = CuentaModel.objects.get(pk=id)
        fila.set_password(password_nuevo)
        fila.save()
        # Una contraseña elegida deja de ser la inicial (D8); `restablecer_acceso` la vuelve a emitir.
        RepoPasswordInicialORM().limpiar(fila.pk)
