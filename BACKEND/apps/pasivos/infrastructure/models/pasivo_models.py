"""
Modelos ORM de Pasivos (Regla B26).
"""
from django.db import models


class EmployeeEgresadoModel(models.Model):
    employee = models.ForeignKey(
        'personal.EmployeeModel',
        on_delete=models.PROTECT,
        to_field='cedulaidentidad',
        related_name='+',
        db_column='employeeCedula',
    )
    n_contrato = models.TextField(blank=True, null=True)
    fechaingresoorganismo = models.DateField(db_column='fechaIngresoOrganismo')
    fecha_egreso = models.DateTimeField(auto_now_add=True)
    motivo_egreso = models.ForeignKey(
        'catalogos.TipoMovimientoModel',
        models.DO_NOTHING,
        db_column='motivoEgresoId',
    )


    class Meta:
        managed = False
        db_table = 'EmployeeEgresado'
        ordering = ['-fecha_egreso']
        verbose_name = 'empleado egresado / pasivo'
        verbose_name_plural = 'empleados egresados / pasivos'

    def __str__(self) -> str:
        return f"{self.employee_id} - {self.motivo_egreso}"
