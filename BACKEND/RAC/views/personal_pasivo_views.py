
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework import status
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from RAC.serializers.personal_pasivo_serializers import *
from django.db.models import Prefetch
from ..models.personal_models import *

from RAC.filters.filters_personal import EmployeeFilter, AsigTrabajoFilter
from ..utils.constants import *

from drf_spectacular.utils import extend_schema

from rest_framework.response import Response
from rest_framework import status
from ..utils.data_formatters import extract_first_error




@extend_schema(
    tags=["Gestion de Personal Pasivo"],
    summary="Editar datos de un cargo",
    description="Actualiza los datos de un cargo existente identificado por su id.",
    request=CodigosCreateUpdatePassiveSerializer,
) 
@api_view(['PUT'])
def update_position_passive(request, id):
    codigo = get_object_or_404(AsigTrabajo, id=id)
    serializer = CodigosCreateUpdatePassiveSerializer(codigo, data=request.data, partial=True)
    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'status': "success",
            'message': "Cargo actualizado correctamente",
            'data': serializer.data            
        }, status=status.HTTP_200_OK)

    except ValidationError:
        clean_message = extract_first_error(serializer.errors)

        return Response({
            'status': "error",
            'message': clean_message,
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e),
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(
    tags=["Gestion de Personal Pasivo"],
    methods=['GET'],
    summary="Listar Cargos Generales del personal pasivo",
    description="Devuelve una lista de todos los cargos registrados con filtros.",
  
)
@extend_schema(
    tags=["Gestion de Personal Pasivo"],
    methods=['POST'],
    summary="Crear Cargo de Personal Pasivo",
    description="Registra un nuevo cargo para personal pasivo.",
    request=CodigosCreateUpdatePassiveSerializer,

)
@api_view(['GET', 'POST'])
def work_codes_passive(request):
    if request.method == 'GET':
        try:
            queryset = AsigTrabajo.objects.filter(
                Tipo_personal__tipo_personal__iexact=PERSONAL_PASIVO
            )
            filterset = AsigTrabajoFilter(request.GET, queryset=queryset)
            
            if not filterset.is_valid():
                return Response({
                    'status': "error",
                    'message': "Los parámetros de filtro son inválidos.",
                    'data': []
                }, status=status.HTTP_400_BAD_REQUEST)

            codigos = filterset.qs.distinct()[:10]
            serializer = ListerCodigosPassiveSerializer(codigos, many=True)
            
            return Response({
                'status': "OK",
                'message': "Códigos de trabajo listados correctamente",
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': "error",
                'message': f"Error al listar: {str(e)}",
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        serializer = CodigosCreateUpdatePassiveSerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save()
                return Response({
                    'status': "success",
                    "message": "Cargo creado correctamente",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'status': "error",
                    'message': str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
        
        first_error = list(serializer.errors.values())[0][0]
        return Response({
            'status': "error",
            'message': first_error,
        }, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(
    tags=["Gestion de Personal Pasivo"],
    summary="Listar personal Pasivo con sus cargos",
    description="Devuelve una lista el personal Pasivo con sus cargos",
    request=EmployeePasiveDetailSerializer,
)

@api_view(['GET'])
def list_employees_pasive(request):
    try:
        filtro_asignaciones = AsigTrabajo.objects.select_related('Tipo_personal').filter(
            Tipo_personal__tipo_personal__iexact=PERSONAL_PASIVO
        )
        
        queryset = Employee.objects.filter(
            assignments__Tipo_personal__tipo_personal__iexact=PERSONAL_PASIVO
        ).prefetch_related(
            Prefetch('assignments', queryset=filtro_asignaciones)
        ).distinct()

        filterset = EmployeeFilter(request.GET, queryset=queryset)
        
        if not filterset.is_valid():
            return Response({
                'status': "error",
                'message': "Los parámetros de búsqueda son inválidos.",
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

   
        empleados = filterset.qs[:10]

        serializer = EmployeePasiveDetailSerializer(empleados, many=True)

        return Response({
            'status': "success",
            'message': "Trabajadores pasivos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': f"Error al recuperar la lista de empleados: {str(e)}",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
    


    
      
@extend_schema(
    tags=["Gestion de Personal Pasivo"],
    summary="Listar personal Pasivo con sus cargos por su cedula",
    description="Devuelve una lista el personal Pasivo con sus cargos por su cedula",
)     
@api_view(['GET'])
def employee__passive_by(request, cedulaidentidad):

    try:
        filtro_asignaciones = AsigTrabajo.objects.filter(
            Tipo_personal__tipo_personal__iexact=PERSONAL_PASIVO
        )

        empleado = Employee.objects.filter(
            cedulaidentidad=cedulaidentidad,
            assignments__Tipo_personal__tipo_personal__iexact=PERSONAL_PASIVO
        ).prefetch_related(
            Prefetch('assignments', queryset=filtro_asignaciones)
        ).distinct().first()

        if not empleado:
            return Response({
                'status': "error",
                'message': "No se encontró el empleado o no posee cargos activos.",
                'data': []
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = EmployeePasiveDetailSerializer(empleado)
        
        return Response({
            'status': "success",
            'message': "Empleado localizado con éxito",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception:
        return Response({
            'status': "error",
            'message': "Ocurrió un error al procesar la búsqueda del empleado.",
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)
        
  
  