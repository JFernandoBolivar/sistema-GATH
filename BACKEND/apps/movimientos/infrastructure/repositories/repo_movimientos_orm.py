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
from apps.catalogos.infrastructure.models.catalogo_models import TipoPersonalModel
from apps.movimientos.domain.entities.movimiento import MovimientoCargo
from apps.movimientos.infrastructure.mappers.mapper_movimientos import movimiento_a_entidad
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

# Rendimiento (2026-11-03): con las 14 relaciones en select_related la consulta
# unía 15 tablas y PostgreSQL tardaba 0,5-0,8 s solo en PLANIFICARLA (ejecutarla,
# 10-60 ms). Se une solo lo imprescindible y los catálogos pequeños se cargan con
# prefetch_related (una consulta simple por catálogo). El resultado es el mismo.
_SELECT_RELATED = ('empleado', 'ejecutado_por', 'ejecutado_por__cedula')
_PREFETCH_CATALOGOS = (
    'denominacioncargo', 'denominacioncargoespecifico', 'gradoid', 'tiponomina', 'estatus',
    'tipo_personal', 'DependenciasId', 'DireccionGeneralid', 'DireccionLineaid',
    'Coordinacionid', 'motivo',
)


def _con_relaciones(qs):
    return qs.select_related(*_SELECT_RELATED).prefetch_related(*_PREFETCH_CATALOGOS)


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
        if cargo.Dependencia_id is None:
            raise ValidationError(
                f'El código {cargo.codigo} no tiene Nivel (Dependencia) asignado. '
                'Edite el código en Gestión de códigos y complete su ubicación antes de asignarlo.'
            )
        tipo_personal_id = cargo.Tipo_personal_id
        if tipo_personal_id is None:
            # Códigos de personal activo creados sin tipo de personal.
            tipo_personal_id = (
                TipoPersonalModel.objects.filter(tipo_personal__iexact='ACTIVO')
                .values_list('pk', flat=True).first()
            )
        if tipo_personal_id is None:
            raise ValidationError(
                'No está configurado el tipo de personal ACTIVO en el sistema. Contacte al administrador.'
            )

        fila = EmployeeMovementHistoryModel.objects.create(
            empleado=empleado,
            codigo_puesto=cargo.codigo,
            denominacioncargo_id=cargo.denominacioncargoid_id,
            denominacioncargoespecifico_id=cargo.denominacioncargoespecificoid_id,
            gradoid_id=cargo.gradoid_id,
            tiponomina_id=cargo.tiponominaid_id,
            estatus_id=cargo.estatusid_id,
            tipo_personal_id=tipo_personal_id,
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
            _con_relaciones(EmployeeMovementHistoryModel.objects)
            .filter(pk=movimiento_id)
            .first()
        )
        return movimiento_a_entidad(fila) if fila else None

    def listar_historial_por_empleado(self, cedula: str) -> list[MovimientoCargo]:
        qs = _con_relaciones(EmployeeMovementHistoryModel.objects).filter(
            empleado__cedulaidentidad=cedula
        )
        return [movimiento_a_entidad(m) for m in qs]

    def listar_historial_por_cargo(self, codigo_puesto: str) -> list[MovimientoCargo]:
        qs = _con_relaciones(EmployeeMovementHistoryModel.objects).filter(
            codigo_puesto=codigo_puesto
        )
        return [movimiento_a_entidad(m) for m in qs]

    def listar_historial(
        self,
        filtros,
        limite: int,
        offset: int = 0,
    ) -> tuple[list[MovimientoCargo], int]:
        """Página del historial con orden total (fecha y PK) y total de coincidencias."""
        from django.db.models import Q

        qs = _con_relaciones(EmployeeMovementHistoryModel.objects)
        if filtros.cedula:
            qs = qs.filter(empleado__cedulaidentidad=filtros.cedula)
        if filtros.codigo_puesto:
            qs = qs.filter(codigo_puesto__icontains=filtros.codigo_puesto)
        if filtros.categoria:
            qs = qs.filter(
                Q(tipo_movimiento__iexact=filtros.categoria)
                | Q(motivo__categoria__categoria__iexact=filtros.categoria)
            )
        if filtros.tipo_movimiento:
            qs = qs.filter(
                Q(tipo_movimiento__iexact=filtros.tipo_movimiento)
                | Q(motivo__movimiento__iexact=filtros.tipo_movimiento)
            )
        if filtros.fecha_inicio:
            qs = qs.filter(fecha_movimiento__date__gte=filtros.fecha_inicio)
        if filtros.fecha_fin:
            qs = qs.filter(fecha_movimiento__date__lte=filtros.fecha_fin)
        if filtros.gerencia:
            qs = qs.filter(DireccionGeneralid__direccion_general__icontains=filtros.gerencia)
        if filtros.estatus:
            qs = qs.filter(estatus__estatus__icontains=filtros.estatus)

        # Orden total y determinista: el movimiento más reciente primero y la PK
        # como desempate (dos movimientos del mismo instante no cambian de lugar).
        qs = qs.order_by('-fecha_movimiento', '-pk')
        total = qs.count()
        pagina = qs[offset:offset + limite] if limite > 0 else qs[offset:]
        return [movimiento_a_entidad(m) for m in pagina], total

    def listar_tipos_movimiento_disponibles(self) -> dict:
        """
        Retorna la estructura jerárquica de categorías y motivos existentes en la DB:
        - Categorías de movimiento (CategoriaMovimientoModel + tipos físicos)
        - Motivos asociados a cada categoría (TipoMovimientoModel)
        """
        from apps.catalogos.infrastructure.models.catalogo_models import (
            CategoriaMovimientoModel,
            TipoMovimientoModel,
        )

        categorias_base = [
            'INGRESO', 'TRASLADO', 'EGRESO', 'ENCARGADURIA', 'ESTATUS', 'ESTATUS PASIVO', 'PASE A PASIVO', 'EGRESO PASIVO',
        ]
        categorias_db = list(
            CategoriaMovimientoModel.objects.values_list('categoria', flat=True).order_by('categoria')
        )

        categorias_unificadas = []
        for c in categorias_base:
            if c not in categorias_unificadas:
                categorias_unificadas.append(c)
        for c in categorias_db:
            if c not in categorias_unificadas:
                categorias_unificadas.append(c)

        motivos_por_categoria: dict[str, list[str]] = {c: [] for c in categorias_unificadas}
        qs_motivos = (
            TipoMovimientoModel.objects.select_related('categoria')
            .all()
            .order_by('movimiento')
        )
        for tm in qs_motivos:
            cat_nombre = tm.categoria.categoria if tm.categoria else None
            if cat_nombre and cat_nombre in motivos_por_categoria:
                if tm.movimiento not in motivos_por_categoria[cat_nombre]:
                    motivos_por_categoria[cat_nombre].append(tm.movimiento)
            elif cat_nombre:
                motivos_por_categoria[cat_nombre] = [tm.movimiento]

        if 'INGRESO' in motivos_por_categoria and not motivos_por_categoria['INGRESO']:
            motivos_por_categoria['INGRESO'] = ['INGRESO']

        return {
            'categorias': categorias_unificadas,
            'motivos_por_categoria': motivos_por_categoria,
        }

