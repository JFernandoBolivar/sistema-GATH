"""Alcance de los procesos por tipo de pensión: AsigTrabajo PASIVO -> tipoNominaId (catálogo TipoNomina), todo por consulta."""
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.catalogos.infrastructure.models.catalogo_models import TipoNominaModel
from apps.fe_de_vida.domain.entities.pasivo import TipoPension
from apps.fe_de_vida.domain.value_objects.estados import CONDICION_PASIVO


def _pasivas():
    return AsigTrabajoModel.objects.filter(Tipo_personal__tipo_personal__iexact=CONDICION_PASIVO)


class LectorAlcanceORM:
    def tipo_nomina_de(self, cedula: str) -> int | None:
        return (
            _pasivas().filter(employee_id=cedula).order_by('-fecha_actualizacion')
            .values_list('tiponominaid_id', flat=True).first()
        )

    def cedulas_en_alcance(self, tipos_nomina: tuple[int, ...]) -> list[str]:
        qs = _pasivas()
        if tipos_nomina:
            qs = qs.filter(tiponominaid_id__in=tipos_nomina)
        return sorted({str(c) for c in qs.values_list('employee_id', flat=True)})

    def tipos_pension(self) -> list[TipoPension]:
        # Las nóminas de pasivos son las que el catálogo marca con `es_activo = False`.
        return [TipoPension(t.pk, t.nomina) for t in TipoNominaModel.objects.filter(es_activo=False).order_by('nomina')]

    def nombres_tipos(self, ids: list[int]) -> dict[int, str]:
        return {t.pk: t.nomina for t in TipoNominaModel.objects.filter(pk__in=ids)}
