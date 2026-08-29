"""
Modelos ORM de Cargos (Regla B26).
"""
from django.db import models


class DenominacionCargoModel(models.Model):
    cargo = models.CharField(max_length=200, unique=True)
    orden_by_cargo = models.PositiveIntegerField(default=30)

    class Meta:
        managed = False
        db_table = 'DenominacionCargo'
        ordering = ['cargo']
        verbose_name = 'denominación de cargo'
        verbose_name_plural = 'denominaciones de cargo'

    def __str__(self) -> str:
        return self.cargo


class DenominacionCargoEspecificoModel(models.Model):
    cargo = models.CharField(max_length=200, unique=True)
    orden_by_cargo = models.PositiveIntegerField(default=30)

    class Meta:
        managed = False
        db_table = 'DenominacionCargoEspecifico'
        ordering = ['cargo']
        verbose_name = 'denominación específica'
        verbose_name_plural = 'denominaciones específicas'

    def __str__(self) -> str:
        return self.cargo


class AsigTrabajoModel(models.Model):
    codigo = models.CharField(max_length=20)
    employee = models.ForeignKey(
        'personal.EmployeeModel',
        models.SET_NULL,
        related_name='+',
        to_field='cedulaidentidad',
        db_column='employeeCedula',
        null=True,
        blank=True,
    )

    denominacioncargoid = models.ForeignKey(
        DenominacionCargoModel,
        models.PROTECT,
        db_column='denominacionCargoId',
    )
    denominacioncargoespecificoid = models.ForeignKey(
        DenominacionCargoEspecificoModel,
        models.PROTECT,
        db_column='denominacionCargoEspecificoId',
    )
    tiponominaid = models.ForeignKey(
        'catalogos.TipoNominaModel',
        models.PROTECT,
        db_column='tipoNominaId',
    )
    estatusid = models.ForeignKey(
        'catalogos.EstatusModel',
        models.PROTECT,
        db_column='estatusId',
    )
    Dependencia = models.ForeignKey(
        'organizacion.DependenciaModel',
        models.PROTECT,
        db_column='dependenciaId',
        blank=True,
        null=True,
    )
    DireccionGeneral = models.ForeignKey(
        'organizacion.DireccionGeneralModel',
        models.PROTECT,
        db_column='direccionGeneralId',
        blank=True,
        null=True,
    )
    DireccionLinea = models.ForeignKey(
        'organizacion.DireccionLineaModel',
        models.PROTECT,
        db_column='direccionLineaId',
        blank=True,
        null=True,
    )
    Coordinacion = models.ForeignKey(
        'organizacion.CoordinacionModel',
        models.PROTECT,
        db_column='coordinacionId',
        blank=True,
        null=True,
    )
    # Campos añadidos en la migración funcional de personal/activo (gap #3:
    # asignación de cargo especial) para alcanzar paridad con
    # `RAC/models/personal_models.py::AsigTrabajo`, que ya los tenía.
    OrganismoAdscritoid = models.ForeignKey(
        'organizacion.OrganismoAdscritoModel',
        models.PROTECT,
        db_column='organismoAdscritoId',
        blank=True,
        null=True,
        related_name='+',
    )
    gradoid = models.ForeignKey(
        'catalogos.GradoModel',
        models.PROTECT,
        db_column='gradoId',
        blank=True,
        null=True,
        related_name='+',
    )
    Tipo_personal = models.ForeignKey(
        'catalogos.TipoPersonalModel',
        models.PROTECT,
        db_column='tipoPersonalId',
        blank=True,
        null=True,
        related_name='+',
    )
    tipo_procedencia = models.ForeignKey(
        'catalogos.TipoProcedenciaModel',
        models.PROTECT,
        db_column='tipo_procedencia_id',
        blank=True,
        null=True,
        related_name='+',
    )
    observaciones = models.TextField(blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'AsigTrabajo'
        ordering = ['-fecha_actualizacion']
        verbose_name = 'asignación de trabajo'
        verbose_name_plural = 'asignaciones de trabajo'

    def __str__(self) -> str:
        return f"{self.codigo} - {self.denominacioncargoid}"
