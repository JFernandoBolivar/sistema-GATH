from django.db import models

class Region(models.Model):
    region = models.CharField(max_length=100, unique=True)
    

class Estado(models.Model):
    estado = models.CharField(max_length=100, unique=True)
    Region = models.ForeignKey(Region, models.DO_NOTHING, null= True,blank=True,db_column='regionId')
    
    def __str__(self):
        return self.estado 
    
class Municipio(models.Model):
    municipio = models.CharField(max_length=100)
    estadoid = models.ForeignKey(Estado, models.DO_NOTHING, db_column='estadoId')
    
    def __str__(self):
        return self.municipio
    
class Parroquia(models.Model):
    parroquia = models.CharField(max_length=100)
    municipioid = models.ForeignKey(Municipio, models.DO_NOTHING, db_column='municipioId')
    
    def __str__(self):
        return self.parroquia