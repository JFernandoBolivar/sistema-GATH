"""
Modelos ORM de Organización (Regla B26).
Conectan directamente con las tablas físicas de la base de datos PostgreSQL GATH.
`managed = False` porque las tablas ya existen en el esquema institucional.
"""
from django.db import models


class DependenciaModel(models.Model):
    Codigo = models.CharField(max_length=20, unique=True)
    dependencia = models.CharField(max_length=200, unique=True)

    class Meta:
        managed = False
        db_table = 'Dependencias'
        ordering = ['Codigo']
        verbose_name = 'dependencia'
        verbose_name_plural = 'dependencias'

    def __str__(self) -> str:
        return f"{self.Codigo} - {self.dependencia}"


class DireccionGeneralModel(models.Model):
    Codigo = models.CharField(max_length=20, unique=True)
    direccion_general = models.CharField(max_length=200, unique=True)
    dependenciaId = models.ForeignKey(
        DependenciaModel,
        models.PROTECT,
        null=True,
        db_column='dependenciaId',
        related_name='direcciones_generales',
    )

    class Meta:
        managed = False
        db_table = 'DireccionGeneral'
        ordering = ['Codigo']
        verbose_name = 'dirección general'
        verbose_name_plural = 'direcciones generales'

    def __str__(self) -> str:
        return f"{self.Codigo} - {self.direccion_general}"


class DireccionLineaModel(models.Model):
    Codigo = models.CharField(max_length=20, unique=True)
    direccion_linea = models.CharField(max_length=200, unique=True)
    direccionGeneral = models.ForeignKey(
        DireccionGeneralModel,
        models.PROTECT,
        db_column='direccionGeneralId',
        related_name='direcciones_linea',
    )

    class Meta:
        managed = False
        db_table = 'DireccionLinea'
        ordering = ['Codigo']
        verbose_name = 'dirección de línea'
        verbose_name_plural = 'direcciones de línea'

    def __str__(self) -> str:
        return f"{self.Codigo} - {self.direccion_linea}"


class CoordinacionModel(models.Model):
    Codigo = models.CharField(max_length=20, unique=True)
    coordinacion = models.CharField(max_length=200, unique=True)
    direccionLinea = models.ForeignKey(
        DireccionLineaModel,
        models.PROTECT,
        null=True,
        blank=True,
        db_column='direccionLineaId',
        related_name='coordinaciones',
    )
    direccionGeneral = models.ForeignKey(
        DireccionGeneralModel,
        models.PROTECT,
        null=True,
        blank=True,
        db_column='direccionGeneralId',
        related_name='coordinaciones_directas',
    )

    class Meta:
        managed = False
        db_table = 'Coordinaciones'
        ordering = ['Codigo']
        verbose_name = 'coordinación'
        verbose_name_plural = 'coordinaciones'

    def __str__(self) -> str:
        return f"{self.Codigo} - {self.coordinacion}"


class OrganismoAdscritoModel(models.Model):
    Organismoadscrito = models.CharField(
        max_length=50, unique=True, db_column='organismoAdscrito'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sub_organismos',
        db_column='parent_id',
    )

    class Meta:
        managed = False
        db_table = 'OrganismoAdscrito'
        ordering = ['Organismoadscrito']
        verbose_name = 'organismo adscrito'
        verbose_name_plural = 'organismos adscritos'

    def __str__(self) -> str:
        return self.Organismoadscrito
