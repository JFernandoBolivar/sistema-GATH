"""Puestos vacantes para Presupuesto (E-1, E-2): reutiliza la consulta de `apps.cargos`; solo agrega la exclusión de los reservados."""
from apps.cargos.infrastructure.mappers.mapper_cargos import cargo_asignacion_a_entidad
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.postulacion.domain.entities.reserva import ACTIVA
from apps.postulacion.domain.entities.vacantes import FiltroVacantes, PuestoVacante
from apps.postulacion.infrastructure.models.presupuesto_models import ReservaPuestoModel
from core.domain.paginacion import Paginacion

_RELACIONES = (
    'denominacioncargoid', 'denominacioncargoespecificoid', 'tiponominaid', 'estatusid', 'Dependencia',
    'DireccionGeneral', 'DireccionLinea', 'Coordinacion', 'employee',
)


def _a_puesto(fila: AsigTrabajoModel) -> PuestoVacante:
    c = cargo_asignacion_a_entidad(fila)
    return PuestoVacante(
        id=c.id, codigo=c.codigo, cargo_id=c.denominacion_id, cargo_nombre=c.denominacion_nombre,
        cargo_especifico_id=c.especifica_id, cargo_especifico_nombre=c.especifica_nombre,
        tipo_nomina_id=c.tipo_nomina_id, tipo_nomina_nombre=c.tipo_nomina_nombre,
        dependencia_id=c.dependencia_id, dependencia_nombre=c.dependencia_nombre or '',
        direccion_general_id=c.direccion_general_id, direccion_general_nombre=c.direccion_general_nombre or '',
        direccion_linea_id=c.direccion_linea_id, direccion_linea_nombre=c.direccion_linea_nombre or '',
        coordinacion_id=c.coordinacion_id, coordinacion_nombre=c.coordinacion_nombre or '',
        vacante=c.esta_vacante,
    )


class PuestosVacantesORM:
    """«Vacante» es la misma noción de Cargos (`employee` nulo, sin puestos de pasivos); no se duplica."""

    def listar_vacantes(self, filtro: FiltroVacantes, paginacion: Paginacion) -> tuple[list[PuestoVacante], int]:
        qs = RepoCargosORM._consulta_cargos(  # noqa: SLF001 - la lógica de vacantes vive en Cargos; se reutiliza tal cual
            None, filtro.dependencia_id, True, filtro.direccion_general_id, filtro.direccion_linea_id,
            filtro.coordinacion_id, None, busqueda=filtro.texto or None,
        )
        if filtro.cargo_id is not None:
            qs = qs.filter(denominacioncargoid_id=filtro.cargo_id)
        reservados = ReservaPuestoModel.objects.filter(estado=ACTIVA)
        if filtro.expediente_propio_id:
            reservados = reservados.exclude(expediente_id=filtro.expediente_propio_id)
        qs = qs.exclude(pk__in=reservados.values('puesto_id')).order_by('codigo', 'pk')
        total = qs.count()
        pagina = qs[paginacion.offset:paginacion.offset + paginacion.tamano]
        return [_a_puesto(f) for f in pagina], total

    def obtener_puesto(self, puesto_id: int, bloquear: bool = False) -> PuestoVacante | None:
        if bloquear:
            # Bloquea SOLO la fila del puesto (sin joins): dos reservas del mismo puesto se serializan aquí.
            if not AsigTrabajoModel.objects.select_for_update().filter(pk=puesto_id).exists():
                return None
        fila = AsigTrabajoModel.objects.select_related(*_RELACIONES).filter(pk=puesto_id).first()
        return _a_puesto(fila) if fila else None
