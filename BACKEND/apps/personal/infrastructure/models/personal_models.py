"""
Modelos ORM de Personal (Regla B26).
"""
from django.db import models


class EmployeeModel(models.Model):
    cedulaidentidad = models.CharField(max_length=10, db_column='cedulaIdentidad', unique=True)

    nombres = models.TextField()
    apellidos = models.TextField()
    fecha_nacimiento = models.DateField(db_column='fechaNacimiento', blank=True, null=True)
    profile = models.TextField(blank=True, null=True)
    total_anos_apn = models.DecimalField(
        db_column='total_anos_apn',
        max_digits=5,
        decimal_places=2,
        default=0.00,
        editable=False,
    )
    sexoid = models.ForeignKey(
        'catalogos.SexoModel',
        models.PROTECT,
        db_column='sexoId',
    )
    estadoCivil = models.ForeignKey(
        'catalogos.EstadoCivilModel',
        models.PROTECT,
        db_column='estadoCivilId',
        blank=True,
        null=True,
    )

    correo = models.EmailField(blank=True, null=True, unique=True)
    telefono_habitacion = models.CharField(max_length=20, blank=True, null=True)
    telefono_movil = models.CharField(max_length=20, blank=True, null=True)
    carnet_patria = models.CharField(max_length=30, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'Employee'
        ordering = ['-fecha_actualizacion']
        verbose_name = 'empleado'
        verbose_name_plural = 'empleados'

    def __str__(self) -> str:
        return f"{self.cedulaidentidad} - {self.nombres} {self.apellidos}"
