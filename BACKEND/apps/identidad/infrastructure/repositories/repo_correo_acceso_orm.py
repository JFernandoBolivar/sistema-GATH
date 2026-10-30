"""Repositorio ORM del correo de acceso (`Employee.correo`) y del alternativo (B13)."""
from apps.autogestion.infrastructure.models.actualizacion_models import (
    DatosComplementariosTrabajadorModel,
)
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
        return EmployeeModel.objects.filter(correo__iexact=correo).exclude(cedulaidentidad=cedula).exists()

    def establecer_correo(self, cedula: str, correo: str) -> None:
        empleado = EmployeeModel.objects.get(cedulaidentidad=cedula)
        empleado.correo = correo
        empleado.save(update_fields=['correo', 'fecha_actualizacion'])
