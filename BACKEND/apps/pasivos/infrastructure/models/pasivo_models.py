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
        models.PROTECT,
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


class CargoEgresadoModel(models.Model):
    """
    Snapshot de los cargos que tenía un empleado al pasar a pasivo (Fase 8 de
    paridad funcional, bloque `CargoEgresado`). `managed=False` sobre la tabla
    física `CargoEgresado`; registra los detalle del cargo en el momento del
    egreso (historiza, no referencia el registro vivo que queda VACANTE).
    """
    egreso = models.ForeignKey(
        'pasivos.EmployeeEgresadoModel',
        models.PROTECT,
        db_column='egreso_id',
        related_name='cargos_historial',
    )
    codigo = models.TextField(db_column='codigo')
    denominacioncargoid = models.ForeignKey(
        'cargos.DenominacionCargoModel', models.PROTECT, db_column='denominacionCargoId',
    )
    denominacioncargoespecificoid = models.ForeignKey(
        'cargos.DenominacionCargoEspecificoModel', models.PROTECT, db_column='denominacionCargoEspecificoId',
    )
    gradoId = models.ForeignKey(
        'catalogos.GradoModel', models.PROTECT, db_column='gradoId',
        null=True, blank=True, related_name='+',
    )
    tipoNominaId = models.ForeignKey(
        'catalogos.TipoNominaModel', models.PROTECT, db_column='tipoNominaId',
    )
    tipoPersonalId = models.ForeignKey(
        'catalogos.TipoPersonalModel', models.PROTECT, db_column='tipoPersonalId',
    )
    dependenciaId = models.ForeignKey(
        'organizacion.DependenciaModel', models.PROTECT, db_column='dependenciaId',
    )
    direccionGeneralId = models.ForeignKey(
        'organizacion.DireccionGeneralModel', models.PROTECT, db_column='direccionGeneralId',
        null=True, blank=True, related_name='+',
    )
    direccionLineaId = models.ForeignKey(
        'organizacion.DireccionLineaModel', models.PROTECT, db_column='direccionLineaId',
        null=True, blank=True, related_name='+',
    )
    coordinacionId = models.ForeignKey(
        'organizacion.CoordinacionModel', models.PROTECT, db_column='coordinacionId',
        null=True, blank=True, related_name='+',
    )
    organismoAdscritoId = models.ForeignKey(
        'organizacion.OrganismoAdscritoModel', models.PROTECT, db_column='organismoAdscritoId',
        null=True, blank=True, related_name='+',
    )

    class Meta:
        managed = False
        db_table = 'CargoEgresado'
        verbose_name = 'cargo del empleado egresado'
        verbose_name_plural = 'cargos de empleados egresados'

    def __str__(self) -> str:
        return f"{self.codigo} - egreso {self.egreso_id}"
