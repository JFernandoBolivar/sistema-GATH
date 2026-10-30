"""Lectura de los datos del pasivo (ficha legada, tipo de nómina y correos) para constancia y avisos."""
from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.fe_de_vida.domain.entities.pasivo import DatosPasivo
from apps.fe_de_vida.domain.value_objects.estados import CONDICION_PASIVO
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import NotFoundError


def _nombre(e: EmployeeModel) -> str:
    return f'{e.nombres} {e.apellidos}'.strip()


class LectorPasivosORM:
    def datos(self, cedula: str) -> DatosPasivo:
        e = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if e is None:
            raise NotFoundError("No existe el trabajador.")
        asignacion = (
            AsigTrabajoModel.objects.filter(employee_id=cedula, Tipo_personal__tipo_personal__iexact=CONDICION_PASIVO)
            .select_related('tiponominaid').order_by('-fecha_actualizacion').first()
        )
        complementarios = DatosComplementariosTrabajadorModel.objects.filter(cedula=cedula).first()
        return DatosPasivo(
            cedula=cedula, nombre_completo=_nombre(e), condicion=asignacion.tiponominaid.nomina if asignacion else '',
            correo=e.correo or '', correo_alternativo=(complementarios.correo_alternativo if complementarios else '') or '',
        )

    def nombre_de(self, cedula: str) -> str:
        e = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        return _nombre(e) if e else cedula

    def nombres_de(self, cedulas: list[str]) -> dict[str, str]:
        return {e.cedulaidentidad: _nombre(e) for e in EmployeeModel.objects.filter(cedulaidentidad__in=cedulas)}
