"""
Modelos ORM espejo (Regla B26/R7) de catálogos de apoyo usados por los datos
anidados del expediente de personal activo (vivienda, académico, contrato).

`managed = False`: las tablas ya existen en la base de datos física `GATH`
(creadas originalmente por las migraciones legadas de `RAC`). Estos modelos
no se migran aquí; solo leen/escriben sobre la tabla existente, igual que
`apps/personal/infrastructure/models/personal_models.py::EmployeeModel`.

Nota de alcance (tarea de migración funcional `apps/personal/activo`,
2026-08-24): estos catálogos existían ya en `RAC/models/personal_models.py`
sin mirror en `apps/`. Se decidió mirrorearlos aquí (en vez de en
`apps/catalogos/`) porque son de uso exclusivo del expediente de personal
(vivienda/académico/contrato) y no catálogos transversales a otros módulos;
si en el futuro otro módulo los necesita, deben moverse a `apps/catalogos/`
(regla B16).
"""
from django.db import models


class PoliticaModel(models.Model):
    tipo_politica = models.CharField(max_length=40, unique=True)

    class Meta:
        managed = False
        db_table = 'politicas'
        ordering = ['tipo_politica']
        verbose_name = 'política de contratación'
        verbose_name_plural = 'políticas de contratación'

    def __str__(self) -> str:
        return self.tipo_politica


class CondicionViviendaModel(models.Model):
    condicion = models.CharField(max_length=100, unique=True)

    class Meta:
        managed = False
        db_table = 'condicion_vivienda'
        verbose_name = 'condición de vivienda'
        verbose_name_plural = 'condiciones de vivienda'

    def __str__(self) -> str:
        return self.condicion


class CodigoPostalModel(models.Model):
    codigo = models.CharField(max_length=5)
    estado_id = models.ForeignKey(
        'catalogos.EstadoModel', models.PROTECT, db_column='estado_id',
    )

    class Meta:
        managed = False
        db_table = 'codigo_postal'
        ordering = ['codigo']
        verbose_name = 'código postal'
        verbose_name_plural = 'códigos postales'

    def __str__(self) -> str:
        return self.codigo


class GrupoSanguineoModel(models.Model):
    GrupoSanguineo = models.CharField(max_length=50, unique=True, db_column='GrupoSanguineo')

    class Meta:
        managed = False
        db_table = 'GrupoSanguineo'
        verbose_name = 'grupo sanguíneo'
        verbose_name_plural = 'grupos sanguíneos'

    def __str__(self) -> str:
        return self.GrupoSanguineo


class NivelAcademicoModel(models.Model):
    nivelacademico = models.CharField(max_length=50, unique=True, db_column='nivelAcademico')

    class Meta:
        managed = False
        db_table = 'NivelAcademico'
        ordering = ['nivelacademico']
        verbose_name = 'nivel académico'
        verbose_name_plural = 'niveles académicos'

    def __str__(self) -> str:
        return self.nivelacademico


class CarreraModel(models.Model):
    nombre_carrera = models.CharField(max_length=200, unique=True)
    nivel_academico_id = models.ForeignKey(
        NivelAcademicoModel, models.PROTECT, db_column='nivel_academico_id',
        null=True, blank=True, related_name='carreras',
    )

    class Meta:
        managed = False
        db_table = 'carreras'
        ordering = ['nombre_carrera']
        verbose_name = 'carrera'
        verbose_name_plural = 'carreras'

    def __str__(self) -> str:
        return self.nombre_carrera


class MencionModel(models.Model):
    carrera_id = models.ForeignKey(
        CarreraModel, models.PROTECT, db_column='carreraId', related_name='menciones',
    )
    nombre_mencion = models.CharField(max_length=200)

    class Meta:
        managed = False
        db_table = 'Menciones'
        ordering = ['nombre_mencion']
        verbose_name = 'mención'
        verbose_name_plural = 'menciones'

    def __str__(self) -> str:
        return self.nombre_mencion


class InstitucionModel(models.Model):
    nombre_institucion = models.CharField(max_length=200, unique=True)

    class Meta:
        managed = False
        db_table = 'Instituciones'
        ordering = ['nombre_institucion']
        verbose_name = 'institución'
        verbose_name_plural = 'instituciones'

    def __str__(self) -> str:
        return self.nombre_institucion
