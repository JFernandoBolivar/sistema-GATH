"""
Modelo ORM del historial de movimientos de cargo (Regla B26, Fase 2.5 del
plan de reparación). Réplica física de
`RAC/models/historial_personal_models.py::EmployeeMovementHistory`
(`git show HEAD:BACKEND/RAC/models/historial_personal_models.py`). Los
nombres de campo replican los del legado tal cual porque ninguno declaraba
`db_column` explícito: Django generó el nombre físico de columna a partir
del nombre del campo Python, y hay que igualar ese nombre para que el
mapeo `managed=False` apunte a la columna real.
"""
from django.db import models


class EmployeeMovementHistoryModel(models.Model):
    TIPO_MOVIMIENTO_CHOICES = [
        ('INGRESO', 'Ingreso inicial'),
        ('TRASLADO', 'Traslado administrativo'),
        ('EGRESO', 'Egreso/Desincorporación'),
        ('CAMBIO DE ESTATUS', '(ver observaciones)'),
    ]

    empleado = models.ForeignKey('personal.EmployeeModel', models.PROTECT, related_name='+')
    codigo_puesto = models.CharField(max_length=100)
    denominacioncargo = models.ForeignKey('cargos.DenominacionCargoModel', models.PROTECT, related_name='+')
    denominacioncargoespecifico = models.ForeignKey(
        'cargos.DenominacionCargoEspecificoModel', models.PROTECT, related_name='+',
    )
    gradoid = models.ForeignKey(
        'catalogos.GradoModel', models.PROTECT, related_name='+', null=True, blank=True,
    )
    tiponomina = models.ForeignKey('catalogos.TipoNominaModel', models.PROTECT, related_name='+')
    estatus = models.ForeignKey('catalogos.EstatusModel', models.PROTECT, related_name='+')
    tipo_personal = models.ForeignKey('catalogos.TipoPersonalModel', models.PROTECT, related_name='+')
    DependenciasId = models.ForeignKey('organizacion.DependenciaModel', models.PROTECT, related_name='+')
    DireccionGeneralid = models.ForeignKey(
        'organizacion.DireccionGeneralModel', models.PROTECT, related_name='+', null=True, blank=True,
    )
    DireccionLineaid = models.ForeignKey(
        'organizacion.DireccionLineaModel', models.PROTECT, related_name='+', null=True, blank=True,
    )
    Coordinacionid = models.ForeignKey(
        'organizacion.CoordinacionModel', models.PROTECT, related_name='+', null=True, blank=True,
    )

    tipo_movimiento = models.CharField(max_length=20, choices=TIPO_MOVIMIENTO_CHOICES)
    motivo = models.ForeignKey(
        'catalogos.TipoMovimientoModel', models.PROTECT, related_name='+', null=True, blank=True,
    )
    fecha_movimiento = models.DateTimeField(auto_now_add=True)
    ejecutado_por = models.ForeignKey(
        'identidad.CuentaModel', models.SET_NULL, related_name='+', null=True, blank=True,
    )

    class Meta:
        managed = False
        db_table = 'EmployeeMovementHistory'
        ordering = ['-fecha_movimiento']
        verbose_name = 'movimiento de cargo'
        verbose_name_plural = 'movimientos de cargo'

    def __str__(self) -> str:
        return f"{self.empleado_id} - {self.tipo_movimiento} - {self.fecha_movimiento}"
