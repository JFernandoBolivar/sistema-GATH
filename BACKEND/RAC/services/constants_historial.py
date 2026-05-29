
from ..models.historial_personal_models import EmployeeMovementHistory
def registrar_historial_movimiento(empleado, puesto, tipo_movimiento, motivo, usuario):
   
    
    return EmployeeMovementHistory.objects.create(
        empleado=empleado,
        codigo_puesto=puesto.codigo,
        denominacioncargo=puesto.denominacioncargoid,
        denominacioncargoespecifico=puesto.denominacioncargoespecificoid,
        gradoid=puesto.gradoid,
        tiponomina=puesto.tiponominaid,
        estatus=puesto.estatusid,
        tipo_personal=puesto.Tipo_personal,
        DependenciasId=puesto.Dependencia,
        DireccionGeneralid=puesto.DireccionGeneral, 
        DireccionLineaid=puesto.DireccionLinea,
        Coordinacionid=puesto.Coordinacion,
        tipo_movimiento=tipo_movimiento,
        motivo=motivo,
        ejecutado_por=usuario
    )