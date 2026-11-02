"""
Modelos ORM de Autogestión (Regla B26).
"""
from django.db import models


class TipoPreguntaModel(models.Model):
    nombre = models.CharField(max_length=50, unique=True)

    class Meta:
        managed = False
        db_table = "TipoPregunta"
        verbose_name = "tipo de pregunta"
        verbose_name_plural = "tipos de pregunta"

    def __str__(self) -> str:
        return self.nombre


class PreguntasEncuestasModel(models.Model):
    validacion = models.CharField(max_length=500, null=True, blank=True)
    enunciado = models.CharField(max_length=200, unique=True)
    tipo = models.ForeignKey(
        TipoPreguntaModel,
        models.PROTECT,
        db_column="tipo_id",
        related_name="preguntas",
    )
    orden = models.PositiveSmallIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "PreguntasEncuestas"
        ordering = ["orden"]
        verbose_name = "pregunta de encuesta"
        verbose_name_plural = "preguntas de encuesta"

    def __str__(self) -> str:
        return self.enunciado


class OpcionesPreguntaModel(models.Model):
    pregunta = models.ForeignKey(
        PreguntasEncuestasModel,
        models.CASCADE,
        db_column="pregunta_id",
        related_name="opciones",
    )
    tipo_opcion = models.CharField(max_length=200)
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        managed = False
        db_table = "OpcionesPregunta"
        ordering = ["pregunta", "orden"]
        verbose_name = "opción de pregunta"
        verbose_name_plural = "opciones de pregunta"

    def __str__(self) -> str:
        return f"{self.pregunta_id} → {self.tipo_opcion}"


class RespuestasEncuestaModel(models.Model):
    pregunta = models.ForeignKey(
        PreguntasEncuestasModel,
        models.PROTECT,
        db_column="pregunta_id",
        related_name="respuestas",
    )
    empleado = models.ForeignKey(
        'personal.EmployeeModel',
        models.PROTECT,
        to_field="cedulaidentidad",
        db_column="empleado_cedula",
        related_name="+",
    )

    opcion = models.ForeignKey(
        OpcionesPreguntaModel,
        models.PROTECT,
        db_column="opcion_id",
        null=True,
        blank=True,
    )
    respuesta = models.TextField(blank=True, default="")
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "RespuestasEncuesta"
        unique_together = ("pregunta", "empleado")
        ordering = ["-fecha_creacion"]
        verbose_name = "respuesta de encuesta"
        verbose_name_plural = "respuestas de encuesta"

    def __str__(self) -> str:
        return f"{self.empleado_id} → {self.pregunta_id}"
