"""Repositorio ORM del correo de acceso (`Employee.correo`) y del alternativo (B13)."""
from apps.autogestion.infrastructure.models.actualizacion_models import (
    DatosComplementariosTrabajadorModel,
)
from apps.identidad.domain.services.colisiones_correo import CedulasPorCorreo, agrupar_por_correo
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class RepoCorreoAccesoORM:
    def existe_empleado(self, cedula: str) -> bool:
        return EmployeeModel.objects.filter(cedulaidentidad=cedula).exists()

    def correo_de(self, cedula: str) -> str:
        correo = EmployeeModel.objects.filter(cedulaidentidad=cedula).values_list('correo', flat=True).first()
        return (correo or '').strip()

    def correo_alternativo_de(self, cedula: str) -> str:
        correo = (
            DatosComplementariosTrabajadorModel.objects.filter(cedula=cedula)
            .values_list('correo_alternativo', flat=True)
            .first()
        )
        return (correo or '').strip()

    def correo_en_uso_por_otro(self, cedula: str, correo: str) -> bool:
        c_limpio = (correo or '').strip().lower()
        if not c_limpio:
            return False
        if EmployeeModel.objects.filter(correo__iexact=c_limpio).exclude(cedulaidentidad=cedula).exists():
            return True
        return (
            DatosComplementariosTrabajadorModel.objects.filter(correo_alternativo__iexact=c_limpio)
            .exclude(cedula=cedula)
            .exists()
        )

    def establecer_correo(self, cedula: str, correo: str) -> None:
        empleado = EmployeeModel.objects.get(cedulaidentidad=cedula)
        empleado.correo = correo
        empleado.save(update_fields=['correo', 'fecha_actualizacion'])

    def cedulas_por_correo(self) -> tuple[CedulasPorCorreo, CedulasPorCorreo]:
        """(institucionales, alternativos) agrupados por correo normalizado, para detectar colisiones."""
        inst = EmployeeModel.objects.exclude(correo__isnull=True).values_list('cedulaidentidad', 'correo')
        alt = DatosComplementariosTrabajadorModel.objects.exclude(
            correo_alternativo__isnull=True,
        ).values_list('cedula', 'correo_alternativo')
        return agrupar_por_correo(list(inst)), agrupar_por_correo(list(alt))
