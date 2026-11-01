"""
Repositorio ORM de cuentas de usuario (gestión de usuarios, D-09/B21).

Implementa el puerto `domain/ports/repo_cuentas.py`. Escribe sobre
`CuentaModel` (el espejo propio de `apps.identidad`, `db_table='USER_cuenta'`,
regla R7): a diferencia de `infrastructure/legado/cuenta_models.py`
(`CuentaEspejo`, explícitamente solo-lectura), este modelo sí es el punto de
escritura del módulo — es la misma fila física que usa `USER.cuenta`, así que
un alta/edición aquí es inmediatamente visible para el legado y viceversa
(estrangulamiento, cero migración de datos).

D3: la columna legada `departamento_id` no se lee ni se escribe aquí; la
autorización depende solo del rol y los permisos.
"""
from django.db import connection
from django.db.models import Q

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

# Clave constante del bloqueo serializador de la administración de usuarios
# (M1): todas las operaciones que pueden dejar el sistema sin editor de la
# matriz toman el MISMO advisory lock dentro de su transaction.atomic().
CLAVE_BLOQUEO_ADMINISTRACION = 0x47415448  # 'GATH'


class RepoCuentasORM:
    """Alta, edición, listado y cambio de contraseña de cuentas (`USER_cuenta`)."""

    def bloquear_administracion(self) -> None:
        """Serializa los cambios de rol/estado/overrides/matriz (M1).

        `pg_advisory_xact_lock` se libera al terminar la transacción. Debe
        llamarse dentro de un `transaction.atomic()` (las vistas lo hacen).
        """
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(%s)', [CLAVE_BLOQUEO_ADMINISTRACION])

    def _queryset(self):
        return CuentaModel.objects.select_related('cedula', 'rol')

    def obtener_por_id(self, id: int) -> Cuenta | None:
        fila = self._queryset().filter(pk=id).first()
        return cuenta_a_entidad(fila) if fila else None

    def _contexto_sesion_qs(self):
        """QuerySet de cuenta + rol con versión, condición y password (A-02)."""
        from django.db.models import Case, CharField, Exists, OuterRef, Subquery, Value, When

        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel
        from apps.identidad.infrastructure.models.permisos_version_model import PermisosVersionModel
        from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel

        asignaciones = AsigTrabajoModel.objects.filter(employee_id=OuterRef('cedula_id'))
        return (
            self._queryset()
            .annotate(
                permisos_version=Subquery(
                    PermisosVersionModel.objects.filter(cuenta_id=OuterRef('pk'))
                    .values('version')[:1]
                ),
                # La contraseña inicial siempre es la cédula y se limpia al cambiarla
                # (D8): evita el `check_password` (bcrypt) en cada `/auth/me`.
                debe_cambiar_password=Exists(
                    PasswordInicialModel.objects.filter(cuenta_id=OuterRef('pk'))
                ),
                tiene_pasivo=Exists(
                    asignaciones.filter(Tipo_personal__tipo_personal__iexact='PASIVO')
                ),
                tiene_egresado=Exists(
                    EmployeeEgresadoModel.objects.filter(employee_id=OuterRef('cedula_id'))
                ),
                tiene_asignacion=Exists(asignaciones),
            )
            .annotate(
                condicion_calculada=Case(
                    When(tiene_pasivo=True, then=Value('PASIVO')),
                    When(tiene_egresado=True, then=Value('PASIVO')),
                    When(tiene_asignacion=True, then=Value('ACTIVO')),
                    default=Value('SIN_ASIGNACION'),
                    output_field=CharField(),
                )
            )
        )

    def obtener_modelo_contexto_sesion(self, id: int):
        """Fila `CuentaModel` anotada para autenticar y servir `/auth/me`.

        Evita que la autenticación JWT y el perfil de sesión consulten la cuenta
        dos veces: el `request.user` ya trae versión, condición y el hash de la
        contraseña para calcular `debe_cambiar_password` en memoria.
        """
        fila = self._contexto_sesion_qs().filter(pk=id).first()
        if fila is None:
            return None
        return fila

    def obtener_contexto_sesion(self, id: int) -> Cuenta | None:
        """Cuenta para `/auth/me` con versión, condición y password en una fila."""
        fila = self.obtener_modelo_contexto_sesion(id)
        return cuenta_a_entidad(fila) if fila else None

    def obtener_por_cedula(self, cedula: str) -> Cuenta | None:
        fila = self._queryset().filter(cedula_id=cedula).first()
        return cuenta_a_entidad(fila) if fila else None

    def existe_cuenta_para_cedula(self, cedula: str) -> bool:
        return CuentaModel.objects.filter(cedula_id=cedula).exists()

    def _filtrar(self, qs, filtros: dict):
        rol_id = filtros.get('rol_id')
        is_active = filtros.get('is_active')
        cedula = filtros.get('cedula')
        nombre = filtros.get('nombre')
        correo = filtros.get('correo')
        cedulas_condicion = filtros.get('cedulas_condicion')

        if rol_id not in (None, ''):
            qs = qs.filter(rol_id=rol_id)
        if is_active not in (None, ''):
            qs = qs.filter(is_active=is_active)
        if cedula:
            qs = qs.filter(cedula__cedulaidentidad__icontains=cedula)
        if nombre:
            qs = qs.filter(
                Q(cedula__nombres__icontains=nombre)
                | Q(cedula__apellidos__icontains=nombre)
            )
        if correo:
            qs = qs.filter(cedula__correo__icontains=correo)
        if cedulas_condicion is not None:
            qs = qs.filter(cedula_id__in=cedulas_condicion)
        return qs

    def listar(self, filtros: dict) -> list[Cuenta]:
        qs = self._filtrar(self._queryset(), filtros).order_by('cedula__apellidos', 'cedula__nombres')
        return [cuenta_a_entidad(fila) for fila in qs]

    def listar_paginado(self, filtros: dict, offset: int, limite: int) -> tuple[list[Cuenta], int]:
        """Cuentas de una página y el total real de coincidencias (D4)."""
        qs = self._filtrar(self._queryset(), filtros).order_by(
            'cedula__apellidos', 'cedula__nombres', 'pk'
        )
        total = qs.count()
        filas = qs[offset:offset + limite]
        return [cuenta_a_entidad(fila) for fila in filas], total

    def crear(self, cedula: str, password: str, rol_id: int | None) -> Cuenta:
        if not EmployeeModel.objects.filter(cedulaidentidad=cedula).exists():
            raise NotFoundError(
                f"La cédula '{cedula}' no pertenece a ningún empleado registrado."
            )

        fila = CuentaModel(cedula_id=cedula, rol_id=rol_id)
        fila.set_password(password)
        fila.save()
        return cuenta_a_entidad(self._queryset().get(pk=fila.pk))

    def guardar(self, cuenta: Cuenta) -> Cuenta:
        fila = CuentaModel.objects.get(pk=cuenta.id)
        rol_anterior = fila.rol_id
        activa_anterior = fila.is_active
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
        # M2: cualquier cambio de contraseña invalida las sesiones abiertas.
        RepoPermisosVersionORM().incrementar_cuenta(fila.pk)
