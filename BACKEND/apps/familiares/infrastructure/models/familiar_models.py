"""
Modelos ORM de Cargas Familiares (Regla B26).
"""
from django.db import models


class EmployeefamilyModel(models.Model):
    id = models.AutoField(primary_key=True)
    employeecedula = models.ForeignKey(
        'personal.EmployeeModel',
        models.CASCADE,
        db_column='employeeCedula',
        related_name='+',
        to_field='cedulaidentidad',
    )
    cedulaFamiliar = models.CharField(max_length=10, db_column='cedulaFamiliar', blank=True, null=True)

    primer_nombre = models.CharField(max_length=150)
    segundo_nombre = models.CharField(null=True, blank=True, max_length=150)
    primer_apellido = models.CharField(max_length=150)
    segundo_apellido = models.CharField(null=True, blank=True, max_length=150)
    parentesco = models.ForeignKey(
        'catalogos.ParentescoModel',
        models.PROTECT,
        db_column='parentescoId',
    )
    fechanacimiento = models.DateField(db_column='fechaNacimiento')
    mismo_ente = models.BooleanField(db_column='mismo_ente', default=False)
    heredero = models.BooleanField(db_column='heredero', default=False)
    sexo = models.ForeignKey(
        'catalogos.SexoModel',
        models.PROTECT,
        db_column='sexoId',
    )
    observaciones = models.TextField(blank=True, null=True)
    createdat = models.DateTimeField(auto_now_add=True, db_column='createdAt')
    updatedat = models.DateTimeField(auto_now=True, db_column='updatedAt')

    class Meta:
        managed = False
        db_table = 'RAC_employeefamily'
        ordering = ['-updatedat']
        verbose_name = 'familiar de empleado'
        verbose_name_plural = 'familiares de empleados'

    def __str__(self) -> str:
        return f"{self.primer_nombre} {self.primer_apellido} ({self.parentesco})"


class FamilyDocumentModel(models.Model):
    familymember = models.ForeignKey(
        EmployeefamilyModel,
        on_delete=models.CASCADE,
        related_name='documentos',
    )
    document_type = models.CharField(max_length=30)
    file = models.FileField(upload_to='familiares/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'RAC_familydocument'
        ordering = ['-uploaded_at']
        verbose_name = 'documento familiar'
        verbose_name_plural = 'documentos familiares'

    def __str__(self) -> str:
        return f"{self.document_type} - {self.familymember_id}"
