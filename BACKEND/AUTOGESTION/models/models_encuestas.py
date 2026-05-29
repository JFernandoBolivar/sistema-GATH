from django.db import models
from RAC.models.personal_models import Employee


class TipoPregunta(models.Model):
    nombre = models.CharField(max_length=50, unique=True)

    class Meta:
        managed = True
        db_table = "TipoPregunta"
        app_label = "AUTOGESTION"

    def __str__(self):
        return self.nombre


class PreguntasEncuestas(models.Model):
    enunciado = models.CharField(max_length=200, unique=True)
    tipo = models.ForeignKey(
        TipoPregunta,
        models.PROTECT,
        db_column="tipo_id",
        related_name="preguntas",
    )
    orden = models.PositiveSmallIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        managed = True
        db_table = "PreguntasEncuestas"
        app_label = "AUTOGESTION"
        ordering = ["orden"]

    def __str__(self):
        return self.enunciado


class OpcionesPregunta(models.Model):
    pregunta = models.ForeignKey(
        PreguntasEncuestas,
        models.CASCADE,
        db_column="pregunta_id",
        related_name="opciones",
    )
    tipo_opcion = models.CharField(max_length=200)
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        managed = True
        db_table = "OpcionesPregunta"
        app_label = "AUTOGESTION"
        ordering = ["pregunta", "orden"]

    def __str__(self):
        return f"{self.pregunta.enunciado[:40]} → {self.tipo_opcion}"


class RespuestasEncuesta(models.Model):
    pregunta = models.ForeignKey(
        PreguntasEncuestas,
        models.PROTECT,
        db_column="pregunta_id",
        related_name="respuestas",
    )
    empleado = models.ForeignKey(
        Employee,
        models.PROTECT,
        to_field="cedulaidentidad",
        db_column="empleado_cedula",
        related_name="respuestas_encuesta",
    )
    opcion = models.ForeignKey(
        OpcionesPregunta,
        models.PROTECT,
        db_column="opcion_id",
        null=True,
        blank=True,
    )
    respuesta = models.TextField(blank=True, default="")

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "RespuestasEncuesta"
        app_label = "AUTOGESTION"
        unique_together = ("pregunta", "empleado")
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"{self.empleado.cedulaidentidad} → {self.pregunta.enunciado[:50]}"
