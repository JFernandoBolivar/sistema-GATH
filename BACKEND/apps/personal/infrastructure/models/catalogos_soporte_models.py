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
        db_table = 'RAC_condicion_vivienda'
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
        db_table = 'RAC_gruposanguineo'
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
        db_table = 'RAC_carreras'
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
        db_table = 'RAC_menciones'
        ordering = ['nombre_mencion']
        verbose_name = 'mención'
        verbose_name_plural = 'menciones'

    def __str__(self) -> str:
        return self.nombre_mencion


class InstitucionModel(models.Model):
    nombre_institucion = models.CharField(max_length=200, unique=True)

    class Meta:
        managed = False
        db_table = 'RAC_instituciones'
        ordering = ['nombre_institucion']
        verbose_name = 'institución'
        verbose_name_plural = 'instituciones'

    def __str__(self) -> str:
        return self.nombre_institucion


class TipoPrendaModel(models.Model):
    """Catálogo de tipo de prenda (camisa, pantalón, zapatos, chaqueta)."""
    categoria = models.CharField(max_length=50, unique=True)

    class Meta:
        managed = False
        db_table = 'TipoPrenda'
        ordering = ['categoria']
        verbose_name = 'tipo de prenda'
        verbose_name_plural = 'tipos de prenda'

    def __str__(self) -> str:
        return self.categoria


class RegionTallaModel(models.Model):
    """Región de tallas (adulto, juvenil, niño, etc.)."""
    codigo = models.CharField(max_length=10, unique=True)
    descripcion = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'RegionTalla'
        ordering = ['codigo']
        verbose_name = 'región de talla'
        verbose_name_plural = 'regiones de talla'

    def __str__(self) -> str:
        return self.codigo


class TallaModel(models.Model):
    """Talla de prenda (valor + región + tipo de prenda)."""
    valor = models.CharField(max_length=20)
    region = models.ForeignKey(
        RegionTallaModel, models.PROTECT, db_column='region_id',
        null=True, blank=True, related_name='+',
    )
    tipo_prenda = models.ForeignKey(
        TipoPrendaModel, models.PROTECT, db_column='tipo_prenda_id',
        null=True, blank=True, related_name='tallas',
    )

    class Meta:
        managed = False
        db_table = 'Talla'
        ordering = ['valor']
        verbose_name = 'talla'
        verbose_name_plural = 'tallas'

    def __str__(self) -> str:
        return self.valor


class CapacitacionModel(models.Model):
    """Catálogo de capacitaciones/cursos (formación complementaria)."""
    nombre_capacitacion = models.CharField(max_length=200, unique=True)

    class Meta:
        managed = False
        db_table = 'RAC_capacitaciones'
        ordering = ['nombre_capacitacion']
        verbose_name = 'capacitación'
        verbose_name_plural = 'capacitaciones'

    def __str__(self) -> str:
        return self.nombre_capacitacion


class GrupoCapacitacionModel(models.Model):
    """Grupo de capacitaciones. Referenciado por `formacion_complementaria.grupo_id`."""
    nombre_grupo = models.CharField(max_length=200, unique=True)

    class Meta:
        managed = False
        db_table = 'grupos_capacitacion'
        ordering = ['nombre_grupo']
        verbose_name = 'grupo de capacitación'
        verbose_name_plural = 'grupos de capacitación'

    def __str__(self) -> str:
        return self.nombre_grupo


class AlergiaModel(models.Model):
    """Catálogo de alergias (M2M de perfil de salud)."""
    alergia = models.CharField(max_length=200)
    categoria = models.ForeignKey(
        'personal.CategoriaAlergiaModel', models.PROTECT, db_column='categoriaId',
        null=True, blank=True, related_name='+',
    )

    class Meta:
        managed = False
        db_table = 'RAC_alergias'
        ordering = ['alergia']
        verbose_name = 'alergia'
        verbose_name_plural = 'alergias'

    def __str__(self) -> str:
        return self.alergia


class CategoriaAlergiaModel(models.Model):
    """Categoría de alergias."""
    nombre_categoria = models.CharField(max_length=200, unique=True)

    class Meta:
        managed = False
        db_table = 'RAC_categorias_alergias'
        ordering = ['nombre_categoria']
        verbose_name = 'categoría de alergia'
        verbose_name_plural = 'categorías de alergia'

    def __str__(self) -> str:
        return self.nombre_categoria


class CategoriaPatologiaModel(models.Model):
    """Categoría de patologías."""
    nombre_categoria = models.CharField(max_length=200, unique=True)

    class Meta:
        managed = False
        db_table = 'RAC_categorias_patologias'
        ordering = ['nombre_categoria']
        verbose_name = 'categoría de patología'
        verbose_name_plural = 'categorías de patologías'

    def __str__(self) -> str:
        return self.nombre_categoria


class PatologiaCronicaModel(models.Model):
    """Catálogo de patologías crónicas (M2M de perfil de salud)."""
    patologia = models.CharField(max_length=200)
    categoria = models.ForeignKey(
        'personal.CategoriaPatologiaModel', models.PROTECT, db_column='categoriaId',
        null=True, blank=True, related_name='+',
    )

    class Meta:
        managed = False
        db_table = 'RAC_patologias_cronicas'
        ordering = ['patologia']
        verbose_name = 'patología crónica'
        verbose_name_plural = 'patologías crónicas'

    def __str__(self) -> str:
        return self.patologia


class CategoriaDiscapacidadModel(models.Model):
    """Categoría de discapacidades."""
    nombre_categoria = models.CharField(max_length=200, unique=True)

    class Meta:
        managed = False
        db_table = 'RAC_categorias_discapacidad'
        ordering = ['nombre_categoria']
        verbose_name = 'categoría de discapacidad'
        verbose_name_plural = 'categorías de discapacidades'

    def __str__(self) -> str:
        return self.nombre_categoria


class DiscapacidadModel(models.Model):
    """Catálogo de discapacidades (M2M de perfil de salud)."""
    discapacidad = models.CharField(max_length=200)
    categoria = models.ForeignKey(
        'personal.CategoriaDiscapacidadModel', models.PROTECT, db_column='categoriaId',
        null=True, blank=True, related_name='+',
    )

    class Meta:
        managed = False
        db_table = 'RAC_discapacidades'
        ordering = ['discapacidad']
        verbose_name = 'discapacidad'
        verbose_name_plural = 'discapacidades'

    def __str__(self) -> str:
        return self.discapacidad
