"""
Modelos ORM de Tablas Maestras y Catálogos.
"""
from django.db import models


class SexoModel(models.Model):
    sexo = models.CharField(max_length=20, unique=True)

    class Meta:
        managed = False
        db_table = 'Sexo'
        ordering = ['sexo']
        verbose_name = 'sexo'
        verbose_name_plural = 'sexos'

    def __str__(self) -> str:
        return self.sexo


class EstatusModel(models.Model):
    estatus = models.CharField(max_length=50, unique=True)

    class Meta:
        managed = False
        db_table = 'Estatus'
        ordering = ['estatus']
        verbose_name = 'estatus'
        verbose_name_plural = 'estatus'

    def __str__(self) -> str:
        return self.estatus


class TipoPersonalModel(models.Model):
    tipo_personal = models.CharField(max_length=50, unique=True, db_column='tipoPersonal')

    class Meta:
        managed = False
        db_table = 'TipoPersonal'
        ordering = ['tipo_personal']
        verbose_name = 'tipo de personal'
        verbose_name_plural = 'tipos de personal'

    def __str__(self) -> str:
        return self.tipo_personal


class TipoNominaModel(models.Model):
    nomina = models.CharField(max_length=50, unique=True)
    requiere_codig = models.BooleanField(db_column='requiereCodig', default=False)
    es_activo = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'TipoNomina'
        ordering = ['nomina']
        verbose_name = 'tipo de nómina'
        verbose_name_plural = 'tipos de nómina'

    def __str__(self) -> str:
        return self.nomina


class ParentescoModel(models.Model):
    descripcion_parentesco = models.CharField(max_length=100, unique=True, db_column='descripcion_parentesco')

    class Meta:
        managed = False
        db_table = 'RAC_parentesco'
        ordering = ['descripcion_parentesco']
        verbose_name = 'parentesco'
        verbose_name_plural = 'parentescos'

    def __str__(self) -> str:
        return self.descripcion_parentesco

    @property
    def parentesco(self) -> str:
        return self.descripcion_parentesco


class TipoProcedenciaModel(models.Model):
    tipo_procedencia = models.CharField(max_length=20, unique=True)

    class Meta:
        managed = False
        db_table = 'TipoProcedencia'
        ordering = ['tipo_procedencia']
        verbose_name = 'tipo de procedencia'
        verbose_name_plural = 'tipos de procedencia'

    def __str__(self) -> str:
        return self.tipo_procedencia


class GradoModel(models.Model):
    grado = models.CharField(max_length=50, unique=True)

    class Meta:
        managed = False
        db_table = 'Grado'
        ordering = ['grado']
        verbose_name = 'grado'
        verbose_name_plural = 'grados'

    def __str__(self) -> str:
        return self.grado


class EstadoCivilModel(models.Model):
    estadoCivil = models.CharField(max_length=100, unique=True, db_column='estadoCivil')

    class Meta:
        managed = False
        db_table = 'RAC_estado_civil'
        ordering = ['estadoCivil']
        verbose_name = 'estado civil'
        verbose_name_plural = 'estados civiles'

    def __str__(self) -> str:
        return self.estadoCivil


class CategoriaMovimientoModel(models.Model):
    categoria = models.CharField(max_length=20, unique=True)

    class Meta:
        managed = False
        db_table = 'RAC_categoria_movimiento'
        ordering = ['categoria']
        verbose_name = 'categoría de movimiento'
        verbose_name_plural = 'categorías de movimiento'

    def __str__(self) -> str:
        return self.categoria


class TipoMovimientoModel(models.Model):
    """
    Fase 2.5 del plan de reparación (`PLAN_REPARACION_GATH.md`): este modelo
    ya existía (introducido en la Fase 2.1 para `procesar_egreso`) pero con
    un campo `tipo_movimiento`/`db_column='tipo_movimiento'` que no
    corresponde a la tabla física real (verificado vía
    `git show HEAD:BACKEND/RAC/models/historial_personal_models.py`: las
    columnas reales son `movimiento` y `categoriaId`). Como es
    `managed=False`, Django nunca validó el esquema y el bug nunca se
    manifestó porque los tests de pasivos usan un repositorio en memoria.
    Corregido aquí para que coincida con la tabla física real.
    """
    movimiento = models.CharField(max_length=100, db_column='movimiento')
    categoria = models.ForeignKey(
        CategoriaMovimientoModel,
        models.DO_NOTHING,
        db_column='categoriaId',
        null=True,
        blank=True,
        related_name='+',
    )

    class Meta:
        managed = False
        db_table = 'Tipo_movimiento'
        ordering = ['movimiento']
        verbose_name = 'tipo de movimiento'
        verbose_name_plural = 'tipos de movimientos'

    def __str__(self) -> str:
        return self.movimiento


class NacionalidadModel(models.Model):
    codigo = models.CharField(max_length=2, unique=True)
    nombre = models.CharField(max_length=50, unique=True)

    class Meta:
        managed = False
        db_table = 'Nacionalidad'
        ordering = ['id']
        verbose_name = 'nacionalidad'
        verbose_name_plural = 'nacionalidades'

    def __str__(self) -> str:
        return f"{self.codigo} - {self.nombre}"



