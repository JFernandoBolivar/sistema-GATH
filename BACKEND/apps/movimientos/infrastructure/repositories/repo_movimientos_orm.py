"""
Repositorio ORM de Movimientos (Reglas B4, B7, D-09).

Cruza a `apps.cargos` (`AsigTrabajoModel`, para la "foto" del cargo en el
momento del movimiento) y `apps.personal` (`EmployeeModel`) desde
`infrastructure/` — mismo patrón ya establecido en
`apps.pasivos.infrastructure.repositories.repo_pasivos_orm` para el acceso
entre módulos hermanos.
"""
from core.domain.exceptions import NotFoundError, ValidationError
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.movimientos.domain.entities.movimiento import MovimientoCargo
from apps.movimientos.infrastructure.mappers.mapper_movimientos import movimiento_a_entidad
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

_SELECT_RELATED = (
    'empleado', 'denominacioncargo', 'denominacioncargoespecifico', 'gradoid',
    'tiponomina', 'estatus', 'tipo_personal', 'DependenciasId', 'DireccionGeneralid',
    'DireccionLineaid', 'Coordinacionid', 'motivo', 'ejecutado_por', 'ejecutado_por__cedula',
)


class RepoMovimientosORM:
    def registrar_movimiento(
        self,
        cargo_id: int,
        cedula: str,
        tipo_movimiento: str,
        motivo_id: int | None,
        usuario_id: int,
    ) -> MovimientoCargo:
        cargo = (
            AsigTrabajoModel.objects.select_related(
                'denominacioncargoid', 'denominacioncargoespecificoid', 'gradoid', 'tiponominaid',
                'estatusid', 'Tipo_personal', 'Dependencia', 'DireccionGeneral', 'DireccionLinea', 'Coordinacion',
            )
            .filter(pk=cargo_id)
            .first()
        )
        if not cargo:
            raise NotFoundError(f"Cargo con id {cargo_id} no encontrado")

        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not empleado:
            raise NotFoundError(f"Empleado con cédula {cedula} no encontrado.")

        # La tabla física heredada (`EmployeeMovementHistory`) exige
        # tipo_personal y dependencia (columnas NOT NULL en el legado). Si
        # el cargo no los tiene, se prefiere fallar de forma explícita (y
        # que la transacción que originó el evento haga rollback) antes que
        # dejar una fila de auditoría a medias.
        if cargo.Tipo_personal_id is None or cargo.Dependencia_id is None:
            raise ValidationError(
                'El cargo no tiene tipo de personal o dependencia asignados: '
                'la tabla física de historial exige ambos campos.'
            )

        fila = EmployeeMovementHistoryModel.objects.create(
            empleado=empleado,
            codigo_puesto=cargo.codigo,
            denominacioncargo_id=cargo.denominacioncargoid_id,
            denominacioncargoespecifico_id=cargo.denominacioncargoespecificoid_id,
            gradoid_id=cargo.gradoid_id,
            tiponomina_id=cargo.tiponominaid_id,
            estatus_id=cargo.estatusid_id,
            tipo_personal_id=cargo.Tipo_personal_id,
            DependenciasId_id=cargo.Dependencia_id,
            DireccionGeneralid_id=cargo.DireccionGeneral_id,
            DireccionLineaid_id=cargo.DireccionLinea_id,
            Coordinacionid_id=cargo.Coordinacion_id,
            tipo_movimiento=tipo_movimiento,
            motivo_id=motivo_id,
            ejecutado_por_id=usuario_id,
        )
        return self._obtener(fila.pk)

    def _obtener(self, movimiento_id: int) -> MovimientoCargo | None:
        fila = (
            EmployeeMovementHistoryModel.objects.select_related(*_SELECT_RELATED)
            .filter(pk=movimiento_id)
            .first()
        )
        return movimiento_a_entidad(fila) if fila else None

    def listar_historial_por_empleado(self, cedula: str) -> list[MovimientoCargo]:
        qs = EmployeeMovementHistoryModel.objects.select_related(*_SELECT_RELATED).filter(
            empleado__cedulaidentidad=cedula
        )
        return [movimiento_a_entidad(m) for m in qs]

    def listar_historial_por_cargo(self, codigo_puesto: str) -> list[MovimientoCargo]:
        qs = EmployeeMovementHistoryModel.objects.select_related(*_SELECT_RELATED).filter(
            codigo_puesto=codigo_puesto
        )
        return [movimiento_a_entidad(m) for m in qs]
