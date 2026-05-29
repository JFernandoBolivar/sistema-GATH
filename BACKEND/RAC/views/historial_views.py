from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status,serializers
from django.db.models.functions import  Extract, Concat
from django.db.models import Count, Value, CharField

from ..models.historial_personal_models import EmployeeMovementHistory, EmployeeEgresado, Tipo_movimiento
from ..models.personal_models import Employee,AsigTrabajo
from ..serializers.historial_personal_serializers import MovimintoCargoSerializer,GestionStatusSerializer,GestionEgreso_PasivoSerializer,EmployeeCargoHistorySerializer, TipoMovimientoSerializer
from drf_spectacular.utils import extend_schema
from ..utils.data_formatters import extract_first_error



@extend_schema(
    tags=["Movimientos de Personal"],
    summary="Cambiar Asignación de Cargo ",
    description="Permite realizar un cambio de cargo",
    request=MovimintoCargoSerializer
)
@api_view(['PATCH'])
def cambiar_cargo(request, cargo_id):
    try:
        puesto_actual = AsigTrabajo.objects.get(pk=cargo_id)
    except AsigTrabajo.DoesNotExist:
        return Response({
            "status": "Error",
            "message": "El código de cargo no fue encontrado",
            "data": []
        }, status=status.HTTP_404_NOT_FOUND)

    if puesto_actual.employee is None:
        return Response({
            "status": "Error",
            "message": "No se puede realizar un movimiento desde un puesto sin empleado asignado",
            "data": []
        }, status=status.HTTP_400_BAD_REQUEST)
    serializer = MovimintoCargoSerializer(puesto_actual, data=request.data, partial=True)
    
    if serializer.is_valid():
        try:
            puesto_nuevo = serializer.save()
            return Response({
                "status": "Ok",
                "message": "Movimiento registrado correctamente",
                "data": {
                    "nuevo_puesto": puesto_nuevo.codigo,
                    "empleado": f"{puesto_nuevo.employee.nombres} {puesto_nuevo.employee.apellidos}"
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "Error",
                "message": f"Error en la operación: {str(e)}",
                "data": []
            }, status=status.HTTP_400_BAD_REQUEST)
    clean_message = extract_first_error(serializer.errors)

    return Response({
        "status": "Error",
        "message": clean_message,
    }, status=status.HTTP_400_BAD_REQUEST)
    

@extend_schema(
    tags=["Movimientos de Personal"],
    summary="Gestionar Estatus de cargo (Bloqueo/Suspensión/Activo)",
    description="Permite cambiar el estatus de un puesto activo a uno de los estatus permitidos",
    request=GestionStatusSerializer
)
@api_view(['PATCH'])
def gestionar_estatus_puesto(request, cargo_id):
    try:
        puesto = AsigTrabajo.objects.get(pk=cargo_id)
    except AsigTrabajo.DoesNotExist:
        return Response({
            "status": "Error",
            "message": "El cargo no existe"
        }, status=status.HTTP_404_NOT_FOUND)

    if puesto.employee is None:
        return Response({
            "status": "Error",
            "message": "No se puede gestionar el estatus de un puesto que no tiene un empleado asignado"
        }, status=status.HTTP_400_BAD_REQUEST)
    serializer = GestionStatusSerializer(puesto, data=request.data, partial=True)
    if serializer.is_valid():
        try:
            serializer.save()
            return Response({
                "status": "Ok",
                "message": "El estatus ha sido actualizado exitosamente",
                "data": {
                    "codigo": puesto.codigo,
                    "nuevo_estatus": puesto.estatusid.estatus
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "Error",
                "message": f"Error al procesar el cambio de estatus: {str(e)}",
                "data": []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    clean_message = extract_first_error(serializer.errors)

    return Response({
        "status": "Error",
        "message": clean_message,
        "data": []
    }, status=status.HTTP_400_BAD_REQUEST) 


@extend_schema(
    tags=["Movimientos de Personal"],
    summary="Gestión de Egreso o Cambio a Pasivo",
    description="Gestiona el movimiento de un personal a cargo pasivo o egreso",
    request=GestionEgreso_PasivoSerializer
)
@api_view(['PATCH'])
def gestion_egreso_pasivo(request, cedulaidentidad):
    try:
        empleado = Employee.objects.get(cedulaidentidad=cedulaidentidad)
    except Employee.DoesNotExist:
        return Response({
            "status": "Error",
            "message": "No se encontró el empleado",
            "data": []
        }, status=status.HTTP_404_NOT_FOUND)

    serializer = GestionEgreso_PasivoSerializer(empleado, data=request.data, partial=True)
    if serializer.is_valid():
        try:
            serializer.save()
            return Response({
                "status": "Ok",
                "message": "Gestion realizada exitosamente",
                "data": {
                    "empleado_id": empleado.id,
                    "nombre": f"{empleado.nombres} {empleado.apellidos}",
                    "cedula": empleado.cedulaidentidad
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "Error",
                "message": f"Error al procesar el movimiento: {str(e)}",
                "data": []
            }, status=status.HTTP_400_BAD_REQUEST)
    clean_message = extract_first_error(serializer.errors)
    return Response({
        "status": "Error",
        "message": clean_message,
        "data": []
    }, status=status.HTTP_400_BAD_REQUEST)
    

@extend_schema(
    tags=["Movimientos de Personal"],
    summary="Historial de movimientos de de cargo personal",
    description="Gestiona el historial de cargos del personal",
    request=GestionEgreso_PasivoSerializer
)
@api_view(['GET'])
def listar_historial_cargo(request, cedulaidentidad):

    if not Employee.objects.filter(cedulaidentidad=cedulaidentidad).exists():
        return Response({
            "status": "Error",
            "message": "No se encontró registro del empleado",
            "data": []
        }, status=status.HTTP_404_NOT_FOUND)

  
    movimientos = EmployeeMovementHistory.objects.filter(
        empleado__cedulaidentidad=cedulaidentidad
    ).exclude(
     motivo__movimiento='ASIGNACION DE CARGO' 
).select_related(
        'empleado', 
        'denominacioncargo', 
        'denominacioncargoespecifico', 
        'gradoid', 
        'tiponomina', 
        'estatus', 
        'motivo', 
        'ejecutado_por'
    ).order_by('-fecha_movimiento') 

    serializer = EmployeeCargoHistorySerializer(movimientos, many=True)
    if not serializer.data:
        return Response({
            "status": "Ok",
            "message": "El empleado no posee historial de movimientos o cambios de estatus",
            "data": []
        }, status=status.HTTP_200_OK)
    return Response({
        "status": "Ok",
        "message": "Historial listado correctamente",
        "data": serializer.data
    }, status=status.HTTP_200_OK)
        
@extend_schema(
    tags=['Reportes'],
    summary="Reporte historico de movimientos de personal  mensual",
    description="Calcula el total de movimientos realizados por mes.",
)
@api_view(['GET'])
def reporte_movimientos(request):
    try:
        contadores = EmployeeMovementHistory.objects.annotate(

            year=Extract('fecha_movimiento', 'year'),

            month=Extract('fecha_movimiento', 'month'),
        ).annotate( mes_formato=Concat('year', Value('-'), 'month', output_field=CharField() )
        ).values('mes_formato').annotate(
            count=Count('id') 
        ).order_by('mes_formato')
        data_final = []
        for item in contadores:
            data_final.append({
                'mes': item['mes_formato'], 
                'count': item['count']
            })
        
        return Response(
            { 
                'status':'OK',
                'message': 'Reporte de movimientos generado correctamente',
                'data': data_final, 
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                'status': 'Error',
                'message': 'Error de datos', 
            }, 
            status=status.HTTP_400_BAD_REQUEST
        )
        
@extend_schema(
    tags=["Movimientos de Personal"],
    summary="Tipo de movimientos para gestionar egresos",
    description="Permite listar los tipos de movimientos para gestionar egresos",
    request=TipoMovimientoSerializer
)    
@api_view(['GET'])
def listar_motivos_fallecimiento(request):

    try:
 
        queryset = Tipo_movimiento.objects.filter(movimiento= "FALLECIMIENTO")
        serializer = TipoMovimientoSerializer(queryset, many=True)
        
        return Response({
            "status": "Ok",
            "message": "Motivos de egreso listados correctamente",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "status": "Error",
            "message": f"Error al consultar los motivos de egreso: {str(e)}",
            "data": []
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
@extend_schema(
    tags=["Movimientos de Personal"],
    summary="Tipo de movimientos para gestionar egresos",
    description="Permite listar los tipos de movimientos para gestionar egresos",
    request=TipoMovimientoSerializer
)    
@api_view(['GET'])
def listar_motivos_egreso(request):

    try:
 
        queryset = Tipo_movimiento.objects.filter(categoriaId__categoria= "EGRESO")
        serializer = TipoMovimientoSerializer(queryset, many=True)
        
        return Response({
            "status": "Ok",
            "message": "Motivos de egreso listados correctamente",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "status": "Error",
            "message": f"Error al consultar los motivos de egreso: {str(e)}",
            "data": []
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
        
@extend_schema(
    tags=["Movimientos de Personal"],
    summary="Tipo de movimientos para gestionar movimientos",
    description="Permite listar los tipos de movimientos para gestionar movimientos",
    request=TipoMovimientoSerializer
)       
@api_view(['GET'])
def listar_motivos_internos(request):

    try:
        queryset = Tipo_movimiento.objects.filter(categoriaId__categoria= "TRASLADO")
        serializer = TipoMovimientoSerializer(queryset, many=True)
        
        return Response({
            "status": "Ok",
            "message": "Motivos para realizar moviminetos listados correctamente",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "status": "Error",
            "message": f"Error al consultar los motivos internos: {str(e)}",
            "data": []
        }, status=status.HTTP_400_BAD_REQUEST)
        
   
@extend_schema(
    tags=["Movimientos de Personal"],
    summary="Tipo de movimientos para cambiar estatus",
    description="Permite listar los tipos de movimientos para cambiar estatus",
    request=TipoMovimientoSerializer
)        
@api_view(['GET'])
def listar_suspendido(request):
    try:   
        queryset = Tipo_movimiento.objects.filter(categoriaId__categoria= "ESTATUS")
        serializer = TipoMovimientoSerializer(queryset, many=True)
        
        return Response({
            "status": "Ok",
            "message": "Motivos para cambiar estatus listados correctamente",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "status": "Error",
            "message": f"Error al consultar los motivos : {str(e)}",
            "data": []
        }, status=status.HTTP_400_BAD_REQUEST)
        

@extend_schema(
    tags=["Movimientos de Personal"],
    summary="Tipo de movimientos para cambiar estatus a personal pasivo",
    description="Permite listar los tipos de movimientos para cambiar estatus",
    request=TipoMovimientoSerializer
)        
@api_view(['GET'])
def listar_suspendido_pasivo(request):
    try:   
        queryset = Tipo_movimiento.objects.filter(categoriaId__categoria= "ESTATUS PASIVO")
        serializer = TipoMovimientoSerializer(queryset, many=True)
        
        return Response({
            "status": "Ok",
            "message": "Motivos para cambiar estatus listados correctamente",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "status": "Error",
            "message": f"Error al consultar los motivos : {str(e)}",
            "data": []
        }, status=status.HTTP_400_BAD_REQUEST)