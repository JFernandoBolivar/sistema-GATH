from django.db import models
from .personal_models import *
from USER.models.user_models import cuenta



class categoria_movimiento(models.Model):
    categoria = models.CharField(max_length=20, unique=True)

class Tipo_movimiento(models.Model):
    movimiento = models.CharField(max_length=100)
    categoriaId = models.ForeignKey(categoria_movimiento,models.DO_NOTHING, db_column='categoriaId', null=True, blank=True )
    
    class Meta:
        managed = True
        ordering = ['movimiento']
        db_table = 'Tipo_movimiento'


class EmployeeMovementHistory(models.Model):
   
    TIPO_MOVIMIENTO_CHOICES = [
        ('INGRESO', 'Ingreso inicial'),
        ('TRASLADO', 'Traslado administrativo'),
        ('EGRESO', 'Egreso/Desincorporación'),
        ('CAMBIO DE ESTATUS', ' (ver observaciones)'),
    ]

    empleado = models.ForeignKey(
        Employee, 
        on_delete=models.CASCADE, 
        related_name='movimientos'
    )
    
    codigo_puesto = models.CharField(max_length=100)
    denominacioncargo = models.ForeignKey(Denominacioncargo, on_delete=models.PROTECT)
    denominacioncargoespecifico = models.ForeignKey(Denominacioncargoespecifico, on_delete=models.PROTECT)
    gradoid = models.ForeignKey(Grado, on_delete=models.PROTECT, null=True)
    tiponomina = models.ForeignKey(Tiponomina, on_delete=models.PROTECT)
    estatus = models.ForeignKey(Estatus, on_delete=models.PROTECT)
    tipo_personal = models.ForeignKey(Tipo_personal, on_delete=models.PROTECT)
    DependenciasId = models.ForeignKey(Dependencias, on_delete=models.PROTECT)
    DireccionGeneralid = models.ForeignKey(DireccionGeneral, on_delete=models.PROTECT, null=True)
    DireccionLineaid = models.ForeignKey(DireccionLinea, on_delete=models.PROTECT, null=True)
    Coordinacionid = models.ForeignKey(Coordinaciones, on_delete=models.PROTECT, null=True)

    # Datos del Movimiento
    tipo_movimiento = models.CharField(max_length=20, choices=TIPO_MOVIMIENTO_CHOICES)
    motivo = models.ForeignKey(Tipo_movimiento, on_delete=models.PROTECT, null=True)
    fecha_movimiento = models.DateTimeField(auto_now_add=True)
    ejecutado_por = models.ForeignKey(cuenta, on_delete=models.PROTECT)

    class Meta:
        db_table = 'EmployeeMovementHistory'
        ordering = ['-fecha_movimiento']
        
    
    
    
class EmployeeEgresado(models.Model):
    employee = models.ForeignKey(
        Employee, 
        on_delete=models.PROTECT, 
        to_field='cedulaidentidad',
        related_name='egresos', 
        db_column='employeeCedula'
    )
    
    n_contrato = models.TextField(blank=True, null=True) 
    fechaingresoorganismo = models.DateField(db_column='fechaIngresoOrganismo')
    fecha_egreso = models.DateTimeField(auto_now_add=True)
    
    motivo_egreso = models.ForeignKey(
        Tipo_movimiento, 
        models.DO_NOTHING, 
        db_column='motivoEgresoId'
    )

    class Meta:
        managed = True
        db_table = 'EmployeeEgresado'
        ordering = ['-fecha_egreso']

    @property
    def nombre_completo(self):
        return f"{self.employee.nombres} {self.employee.apellidos}"
    
    
class CargoEgresado(models.Model):
    egreso = models.ForeignKey(
        EmployeeEgresado, 
        related_name='cargos_historial', 
        on_delete=models.CASCADE
    )
    codigo = models.TextField(unique=True)
    denominacioncargoid = models.ForeignKey(Denominacioncargo, models.DO_NOTHING, db_column='denominacionCargoId')
    denominacioncargoespecificoid = models.ForeignKey(Denominacioncargoespecifico, models.DO_NOTHING, db_column='denominacionCargoEspecificoId')
    gradoid = models.ForeignKey(Grado, models.DO_NOTHING, db_column='gradoId', blank=True, null=True)
    tiponominaid = models.ForeignKey(Tiponomina, models.DO_NOTHING, db_column='tipoNominaId')
    TipoPersonalId = models.ForeignKey(Tipo_personal, models.DO_NOTHING, db_column='tipoPersonalId')
    Dependencia =  models.ForeignKey(Dependencias, models.DO_NOTHING, db_column='dependenciaId')
    DireccionGeneral = models.ForeignKey(DireccionGeneral, models.DO_NOTHING, db_column='direccionGeneralId', null=True)
    DireccionLinea = models.ForeignKey(DireccionLinea, models.DO_NOTHING, db_column='direccionLineaId', null=True)
    Coordinacion = models.ForeignKey(Coordinaciones, models.DO_NOTHING, db_column='coordinacionId', null=True)
    OrganismoAdscritoid = models.ForeignKey(OrganismoAdscrito, models.DO_NOTHING, db_column='organismoAdscritoId', null=True)

    class Meta:
        db_table = 'CargoEgresado'


class PrestamoCargo(models.Model):
    empleado_encargado = models.ForeignKey(
        Employee,
        models.PROTECT,
        related_name='encargadurias_asignadas',
        to_field='cedulaidentidad',
        db_column='empleadoEncargadoCedula'
    )
    cargo_encargado = models.ForeignKey(
        'AsigTrabajo',
        models.PROTECT,
        related_name='prestamos',
        db_column='cargoEncargadoId'
    )
    motivo = models.ForeignKey(
        Tipo_movimiento,
        models.PROTECT,
        db_column='motivoId',
        limit_choices_to={'categoriaId__categoria': 'ENCARGADURIA'}
    )
    estatus = models.ForeignKey(
        Estatus,
        models.PROTECT,
        db_column='estatusId'
    )
    fecha_inicio = models.DateField(db_column='fechaInicio')
    fecha_fin = models.DateField(db_column='fechaFin')
    fecha_creacion = models.DateTimeField(auto_now_add=True, db_column='fechaCreacion')
    ejecutado_por = models.ForeignKey(cuenta, models.PROTECT, db_column='ejecutadoPorId')

    class Meta:
        managed = True
        db_table = 'PrestamoCargo'
        ordering = ['fecha_inicio']
        app_label = 'RAC'