"""
Idiomas del trabajador (Fase 2, F-8). Tablas NUEVAS y gestionadas por Django (no heredadas): el catálogo de idiomas y los
idiomas que domina cada empleado, con su nivel. Si el idioma no está en el catálogo se guarda con su nombre en `otro_idioma`.
"""
from django.db import models


class IdiomaModel(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'catalogo_idioma'
        ordering = ['nombre']
        verbose_name = 'idioma'
        verbose_name_plural = 'idiomas'

    def __str__(self) -> str:
        return self.nombre


class EmpleadoIdiomaModel(models.Model):
    NIVELES = (('BIEN', 'Bien'), ('REGULAR', 'Regular'), ('POCO', 'Poco'))

    empleado = models.ForeignKey(
        'personal.EmployeeModel', models.CASCADE, db_column='empleado_id', related_name='idiomas',
    )
    idioma = models.ForeignKey(
        IdiomaModel, models.PROTECT, db_column='idioma_id', null=True, blank=True, related_name='+',
    )
    otro_idioma = models.CharField(max_length=60, blank=True, default='')
    nivel = models.CharField(max_length=8, choices=NIVELES)

    class Meta:
        db_table = 'empleado_idioma'
        ordering = ['id']
        verbose_name = 'idioma del empleado'
        verbose_name_plural = 'idiomas del empleado'
        constraints = [
            models.UniqueConstraint(
                fields=['empleado', 'idioma'], condition=models.Q(idioma__isnull=False),
                name='uq_empleado_idioma_catalogo',
            ),
            models.CheckConstraint(
                condition=(models.Q(idioma__isnull=False, otro_idioma='') | models.Q(idioma__isnull=True) & ~models.Q(otro_idioma='')),
                name='ck_empleado_idioma_uno_de_dos',
            ),
        ]
