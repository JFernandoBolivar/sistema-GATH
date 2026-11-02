"""
Modelos ORM de Geografía (Regla B26).
"""
from django.db import models


class RegionModel(models.Model):
    region = models.CharField(max_length=100, unique=True)

    class Meta:
        managed = False
        db_table = 'RAC_region'
        verbose_name = 'región'
        verbose_name_plural = 'regiones'

    def __str__(self) -> str:
        return self.region


class EstadoModel(models.Model):
    estado = models.CharField(max_length=100, unique=True)
    Region = models.ForeignKey(
        RegionModel,
        models.DO_NOTHING,
        null=True,
        blank=True,
        db_column='regionId',
        related_name='estados',
    )

    class Meta:
        managed = False
        db_table = 'RAC_estado'
        ordering = ['estado']
        verbose_name = 'estado'
        verbose_name_plural = 'estados'

    def __str__(self) -> str:
        return self.estado


class MunicipioModel(models.Model):
    municipio = models.CharField(max_length=100)
    estadoid = models.ForeignKey(
        EstadoModel,
        models.DO_NOTHING,
        db_column='estadoId',
        related_name='municipios',
    )

    class Meta:
        managed = False
        db_table = 'RAC_municipio'
        ordering = ['municipio']
        verbose_name = 'municipio'
        verbose_name_plural = 'municipios'

    def __str__(self) -> str:
        return self.municipio


class ParroquiaModel(models.Model):
    parroquia = models.CharField(max_length=100)
    municipioid = models.ForeignKey(
        MunicipioModel,
        models.DO_NOTHING,
        db_column='municipioId',
        related_name='parroquias',
    )

    class Meta:
        managed = False
        db_table = 'RAC_parroquia'
        ordering = ['parroquia']
        verbose_name = 'parroquia'
        verbose_name_plural = 'parroquias'

    def __str__(self) -> str:
        return self.parroquia
