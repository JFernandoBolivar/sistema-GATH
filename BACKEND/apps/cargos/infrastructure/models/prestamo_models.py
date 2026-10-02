"""
Modelo ORM de Préstamo de Cargo / Encargaduría (Regla B26, Fase 2.5 del plan
de reparación). Réplica física de
`RAC/models/historial_personal_models.py::PrestamoCargo`
(`git show HEAD:BACKEND/RAC/models/historial_personal_models.py`).
"""
from django.db import models


class PrestamoCargoModel(models.Model):
    empleado_encargado = models.ForeignKey(
        'personal.EmployeeModel',
        models.PROTECT,
        related_name='+',
        to_field='cedulaidentidad',
        db_column='empleadoEncargadoCedula',
    )
    cargo_encargado = models.ForeignKey(
        'cargos.AsigTrabajoModel',
        models.PROTECT,
        related_name='prestamos',
        db_column='cargoEncargadoId',
    )
    motivo = models.ForeignKey(
        'catalogos.TipoMovimientoModel',
        models.PROTECT,
        db_column='motivoId',
    )
    estatus = models.ForeignKey(
        'catalogos.EstatusModel',
        models.PROTECT,
        db_column='estatusId',
    )
    fecha_inicio = models.DateField(db_column='fechaInicio')
    fecha_fin = models.DateField(db_column='fechaFin')
    fecha_creacion = models.DateTimeField(auto_now_add=True, db_column='fechaCreacion')
    ejecutado_por = models.ForeignKey(
        'identidad.CuentaModel',
        models.SET_NULL,
        db_column='ejecutadoPorId',
        null=True,
        blank=True,
    )

    class Meta:
        managed = False
        db_table = 'PrestamoCargo'
        ordering = ['fecha_inicio']
        verbose_name = 'préstamo de cargo'
        verbose_name_plural = 'préstamos de cargo'

    def __str__(self) -> str:
        return f"{self.empleado_encargado_id} -> {self.cargo_encargado_id}"
