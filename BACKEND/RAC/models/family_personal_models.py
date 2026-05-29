from django.db import models

from USER.models import cuenta
from simple_history.models import HistoricalRecords


class Parentesco(models.Model):
    id = models.AutoField(primary_key=True)
    descripcion_parentesco = models.CharField(max_length=100, unique=True)

    class Meta:
        managed = True
        verbose_name = "Parentesco"
        verbose_name_plural = "Parentescos"
        
        
    def __str__(self):
        return self.descripcion_parentesco

class Employeefamily(models.Model):
    id = models.AutoField(primary_key=True)
    employeecedula = models.ForeignKey('RAC.Employee', models.DO_NOTHING, db_column='employeeCedula',related_name='carga_familiar',to_field='cedulaidentidad')
    cedulaFamiliar = models.CharField(db_column='cedulaFamiliar', blank=True, null=True)
    primer_nombre = models.CharField(max_length=150) 
    segundo_nombre = models.CharField(null=True, blank=True, max_length=150)  
    primer_apellido = models.CharField(max_length=150) 
    segundo_apellido = models.CharField(null=True, blank=True, max_length=150) 
    parentesco = models.ForeignKey(Parentesco, models.DO_NOTHING,db_column='parentescoId')
    fechanacimiento = models.DateField(db_column='fechaNacimiento')   
    mismo_ente = models.BooleanField(db_column='mismo_ente',default=False)
    heredero = models.BooleanField(db_column='heredero',default=False)

  
    sexo = models.ForeignKey('RAC.Sexo', models.DO_NOTHING,db_column='sexoId')

    estadoCivil = models.ForeignKey('RAC.estado_civil', models.DO_NOTHING, db_column='estadoCivilId', blank=True, null=True)
    observaciones = models.TextField(blank=True, null=True)
    historial  = HistoricalRecords(user_model=cuenta)
    
    createdat = models.DateTimeField(auto_now_add=True, db_column='createdAt')  
    updatedat = models.DateTimeField(auto_now=True, db_column='updatedAt')  
    
    
    class Meta:
        unique_together = [['employeecedula', 'cedulaFamiliar']]
        constraints = [
            models.UniqueConstraint(
                fields=['employeecedula'], 
                condition=models.Q(heredero=True),
                name='unique_heredero_per_employee'
            )
        ]
        ordering = ['-updatedat']
        managed = True
        verbose_name = "Employeefamily"
        verbose_name_plural = "Employeefamilys"
        

class FamilyDocument(models.Model):
    TIPO_DOCUMENTO = [
        ("cedula", "Cédula"),
        ("partida_nacimiento", "Partida de Nacimiento"),
    ]
    familymember = models.ForeignKey(
        Employeefamily, on_delete=models.CASCADE, related_name="documentos"
    )
    document_type = models.CharField(max_length=30, choices=TIPO_DOCUMENTO)
    file = models.FileField(upload_to="familiares/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        verbose_name = "Documento Familiar"
        verbose_name_plural = "Documentos Familiares"

    def __str__(self):
        return f"{self.get_document_type_display()} - {self.familymember}"
        
