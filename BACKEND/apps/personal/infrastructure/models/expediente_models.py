"""
Modelos ORM espejo (Regla B26/R7) de los datos anidados del expediente de
personal activo: vivienda, perfil de salud (escalar), formación académica,
contacto de emergencia, antecedentes de servicio y contratos.

`managed = False`: mismas tablas físicas que `RAC/models/personal_models.py`
(base de datos `GATH`). Se crean como modelos propios de `apps.personal`
(en vez de reexportar los de `RAC`) porque `RAC` **no** está instalado bajo
`GATH.settings` — un intento de `import RAC.models...` desde código alcanzable
por `apps/personal` revienta con
`RuntimeError: ... doesn't declare an explicit app_label and isn't in an
application in INSTALLED_APPS` (verificado empíricamente antes de escribir
este archivo, ver Entrada de bitácora de esta tarea). Es la misma restricción
documentada en la Entrada #033 para `token_service.py`/`AUTH_USER_MODEL`,
aplicada aquí a todo el árbol de modelos de `RAC`.

⚠️ Alcance NO cubierto por estos mirrors (documentado, no un olvido):
`perfil_fisico` (tallas: camisa/pantalón/zapatos/chaqueta) y
`formacion_complementaria` (capacitaciones) no se mirrorean en esta tarea.
El perfil de salud tampoco mirrorea las M2M `alergias` / `patologiaCronica`
/ `discapacidad` — solo el grupo sanguíneo escalar. Ver detalle de alcance
en la bitácora.
"""
from django.db import models


class AntecedenteServicioModel(models.Model):
    empleado = models.ForeignKey(
        'personal.EmployeeModel',
        models.PROTECT,
        db_column='empleadoId',
        null=True,
        blank=True,
        related_name='antecedentes_servicio',
    )
    organismo = models.ForeignKey(
        'organizacion.OrganismoAdscritoModel',
        models.PROTECT,
        db_column='organismo_id',
        null=True,
        blank=True,
        related_name='+',
    )
    fecha_ingreso = models.DateField(db_column='fechaIngreso')
    fecha_egreso = models.DateField(db_column='fechaEgreso', blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'antecedentes_servicio'
        ordering = ['fecha_ingreso']
        verbose_name = 'antecedente de servicio'
        verbose_name_plural = 'antecedentes de servicio'


class ContratoModel(models.Model):
    n_contrato = models.CharField(max_length=20, unique=True)
    fecha_culminacion = models.DateField(blank=True, null=True)
    politica = models.ForeignKey(
        'personal.PoliticaModel', models.PROTECT, db_column='politica_id', related_name='+',
    )
    estatus = models.ForeignKey(
        'catalogos.EstatusModel', models.PROTECT, db_column='estatus_id', related_name='+',
    )
    antecedente = models.ForeignKey(
        AntecedenteServicioModel, models.PROTECT, db_column='antecedente_id',
        null=True, blank=True, related_name='+',
    )
    es_fijo = models.BooleanField(default=False, db_column='es_fijo')

    class Meta:
        managed = False
        db_table = 'contratos'
        ordering = ['-fecha_culminacion']
        verbose_name = 'contrato'
        verbose_name_plural = 'contratos'

    @property
    def fecha_ingreso(self):
        return self.antecedente.fecha_ingreso if self.antecedente_id else None


class DatosViviendaModel(models.Model):
    empleado = models.ForeignKey(
        'personal.EmployeeModel', models.PROTECT, db_column='empleadoId',
        null=True, blank=True, related_name='datos_vivienda',
    )
    estado = models.ForeignKey(
        'catalogos.EstadoModel', models.PROTECT, db_column='estadoId', related_name='+',
    )
    municipio = models.ForeignKey(
        'catalogos.MunicipioModel', models.PROTECT, db_column='municipioId', related_name='+',
    )
    parroquia = models.ForeignKey(
        'catalogos.ParroquiaModel', models.PROTECT, db_column='parroquiaId', related_name='+',
    )
    direccion_exacta = models.TextField(db_column='direccionExacta')
    condicion_vivienda = models.ForeignKey(
        'personal.CondicionViviendaModel', models.PROTECT, db_column='condicionViviendaId', related_name='+',
    )
    codigo_postal = models.ForeignKey(
        'personal.CodigoPostalModel', models.CASCADE, db_column='codigo_postal_id', related_name='+',
    )

    class Meta:
        managed = False
        db_table = 'datos_vivienda'
        verbose_name = 'datos de vivienda'
        verbose_name_plural = 'datos de vivienda'


class PerfilSaludModel(models.Model):
    """
    Espejo parcial (solo campo escalar): NO incluye las M2M
    `alergias` / `patologiaCronica` / `discapacidad` (fuera de alcance).
    """
    empleado = models.ForeignKey(
        'personal.EmployeeModel', models.PROTECT, db_column='empleadoId',
        null=True, blank=True, related_name='perfil_salud',
    )
    grupo_sanguineo = models.ForeignKey(
        'personal.GrupoSanguineoModel', models.PROTECT, db_column='grupoSanguineoId',
        null=True, blank=True, related_name='+',
    )

    class Meta:
        managed = False
        db_table = 'perfil_salud'
        verbose_name = 'perfil de salud'
        verbose_name_plural = 'perfiles de salud'


class FormacionAcademicaModel(models.Model):
    empleado = models.ForeignKey(
        'personal.EmployeeModel', models.PROTECT, db_column='empleadoId',
        null=True, blank=True, related_name='formacion_academica',
    )
    nivel_academico = models.ForeignKey(
        'personal.NivelAcademicoModel', models.PROTECT, db_column='nivelAcademicoId',
        null=True, blank=True, related_name='+',
    )
    carrera = models.ForeignKey(
        'personal.CarreraModel', models.PROTECT, db_column='carreraId',
        null=True, blank=True, related_name='+',
    )
    mencion = models.ForeignKey(
        'personal.MencionModel', models.PROTECT, db_column='mencionId',
        null=True, blank=True, related_name='+',
    )
    institucion = models.ForeignKey(
        'personal.InstitucionModel', models.PROTECT, db_column='institucionId',
        null=True, blank=True, related_name='+',
    )

    class Meta:
        managed = False
        db_table = 'formacion_academica'
        verbose_name = 'formación académica'
        verbose_name_plural = 'formaciones académicas'


class ContactoEmergenciaModel(models.Model):
    empleado = models.ForeignKey(
        'personal.EmployeeModel', models.PROTECT, db_column='empleadoId',
        null=True, blank=True, related_name='contacto_emergencia',
    )
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    relacion = models.ForeignKey(
        'catalogos.ParentescoModel', models.PROTECT, db_column='relacionId',
        null=True, blank=True, related_name='+',
    )

    class Meta:
        managed = False
        db_table = 'contacto_emergencia'
        verbose_name = 'contacto de emergencia'
        verbose_name_plural = 'contactos de emergencia'
