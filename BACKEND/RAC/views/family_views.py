from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from django.db import transaction
from rest_framework.response import Response
from RAC.utils.constants import *
from RAC.utils.data_formatters import extract_first_error
from ..models.family_personal_models import Employeefamily, Parentesco, FamilyDocument
from RAC.models.personal_models import Employee
from ..serializers.family_serializers import FamilyCreateSerializer,FamilyListSerializer,ParentescoSerializer,FamilyDocumentSerializer,FamilyDocumentReadSerializer
from RAC.filters.filters_personal import EmployeeFamilyFilter
from drf_spectacular.utils import extend_schema
 


@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Creaxion de familiares",
    description="Gestion de familiares de un empleado",
    request=FamilyCreateSerializer,
)
@api_view(['POST'])
def registrar_familiar(request, cedula_empleado): 
    empleado = get_object_or_404(Employee, cedulaidentidad=cedula_empleado)
    
 
    serializer = FamilyCreateSerializer(
        data=request.data, 
        context={'empleado': empleado, 'request': request}
    )
    
    if serializer.is_valid():
        try:
         
            familiar = serializer.save() 
            return Response({
                "status": "Ok",
                "message": "Familiar registrado exitosamente.",
                "data": {
                    "id": familiar.id,
                    "cedulaFamiliar": familiar.cedulaFamiliar,
                    "nombre_completo": f"{familiar.primer_nombre} {familiar.primer_apellido}",
                    "parentesco": familiar.parentesco.descripcion_parentesco 
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"status": "Error", "message": str(e)}, status=400)

    # Manejo de errores de validación (tu lógica actual)
    clean_message = extract_first_error(serializer.errors)
    return Response({"status": "Error", "message": clean_message}, status=400)

@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Actualizacion de familiares",
    description="Actualizacion de familiares de un empleado",
    request=FamilyCreateSerializer,
)
@api_view(['PATCH'])
def actualizar_familiar(request, familiar_id):
    familiar = get_object_or_404(Employeefamily, id=familiar_id)
    
    empleado = familiar.employeecedula 

    serializer = FamilyCreateSerializer(familiar, data=request.data, 
        context={'empleado': empleado, 'request': request},
        partial=True 
    )
    
    if serializer.is_valid():
        try:
            familiar_actualizado = serializer.save()
            
            return Response({
                "status": "Ok",
                "message": "Datos del familiar actualizados correctamente.",
                "data": {
                    "id": familiar_actualizado.id,
                    "cedulaFamiliar": familiar_actualizado.cedulaFamiliar,
                    "nombre_completo": f"{familiar_actualizado.primer_nombre} {familiar_actualizado.primer_apellido}",
                    "parentesco": familiar_actualizado.parentesco.descripcion_parentesco 
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "Error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    clean_message = extract_first_error(serializer.errors)
    
    return Response({"status": "Error", "message": clean_message}, status=status.HTTP_400_BAD_REQUEST)



@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Gestion de familiares",
    request=FamilyListSerializer,
)
@api_view(['GET'])
def listar_familiares(request):
    try:
        if not request.GET:
            return Response({
                "status": "Ok",
                "message": "No se proporcionaron parámetros de búsqueda.",
                "data": []
            }, status=status.HTTP_200_OK)

        queryset = Employeefamily.objects.select_related(
            'parentesco', 'sexo', 'estadoCivil', 'employeecedula'
        ).filter(
            employeecedula__assignments__Tipo_personal__tipo_personal__iexact=PERSONAL_ACTIVO
        )

        filterset = EmployeeFamilyFilter(request.GET, queryset=queryset)
        
        if not filterset.is_valid():
            return Response({
                "status": "Error",
                "message": "Los parámetros de filtro son inválidos.",
                "errors": filterset.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        familiares = filterset.qs.distinct()[:10]
        
        if not familiares.exists():
            return Response({
                "status": "Ok",
                "message": "No se encontraron resultados para la búsqueda.",
                "data": []
            }, status=status.HTTP_200_OK)

        serializer = FamilyListSerializer(familiares, many=True)
        
        return Response({
            "status": "Ok",
            "message": "Carga familiar listada correctamente",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "status": "Error",
            "message": f"Error al recuperar carga familiar: {str(e)}",
            "data": []
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Gestion de familiares  por id",

)
@api_view(['GET'])
def familiares_active_by(request, id_empleado): 
    try:
        queryset = Employeefamily.objects.select_related(
            'parentesco', 'sexo', 'estadoCivil', 'employeecedula'
        ).filter(
            employeecedula__id=id_empleado, # Filtro por el ID recibido en la URL
            employeecedula__assignments__Tipo_personal__tipo_personal__iexact=PERSONAL_ACTIVO
        ).distinct()

        # 2. Verificamos si existen resultados
        if not queryset.exists():
            return Response({
                "status": "Ok",
                "message": f"No se encontraron familiares para el empleado con ID {id_empleado} o no es personal pasivo.",
                "data": []
            }, status=status.HTTP_200_OK)

        serializer = FamilyListSerializer(queryset[:10], many=True)
        
        return Response({
            "status": "Ok",
            "message": "Carga familiar listada correctamente",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "status": "Error",
            "message": f"Error al recuperar carga familiar: {str(e)}",
            "data": []
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)





@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Gestion de familiares",

)
@api_view(['GET'])
def listar_familiares_pasivo(request):
    try:
        if not request.GET:
            return Response({
                "status": "Ok",
                "message": "No se proporcionaron parámetros de búsqueda.",
                "data": []
            }, status=status.HTTP_200_OK)

        queryset = Employeefamily.objects.select_related(
            'parentesco', 'sexo', 'estadoCivil', 'employeecedula'
        ).filter(
            employeecedula__assignments__Tipo_personal__tipo_personal__iexact=PERSONAL_PASIVO
        )

        filterset = EmployeeFamilyFilter(request.GET, queryset=queryset)
        
        if not filterset.is_valid():
            return Response({
                "status": "Error",
                "message": "Los parámetros de filtro son inválidos.",
                "errors": filterset.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        familiares = filterset.qs.distinct()[:10]
        
        if not familiares.exists():
            return Response({
                "status": "Ok",
                "message": "No se encontraron resultados para la búsqueda.",
                "data": []
            }, status=status.HTTP_200_OK)

        serializer = FamilyListSerializer(familiares, many=True)
        
        return Response({
            "status": "Ok",
            "message": "Carga familiar listada correctamente",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "status": "Error",
            "message": f"Error al recuperar carga familiar: {str(e)}",
            "data": []
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Gestion de familiares",

)

@api_view(['GET'])
def familiares_pasivo_by(request, id_empleado): 
    try:
        queryset = Employeefamily.objects.select_related(
            'parentesco', 'sexo', 'estadoCivil', 'employeecedula'
        ).filter(
            employeecedula__id=id_empleado,
            employeecedula__assignments__Tipo_personal__tipo_personal__iexact=PERSONAL_PASIVO
        ).distinct()

        if not queryset.exists():
            return Response({
                "status": "Ok",
                "message": f"No se encontraron familiares para el empleado con ID {id_empleado} o no es personal pasivo.",
                "data": []
            }, status=status.HTTP_200_OK)

        serializer = FamilyListSerializer(queryset[:10], many=True)
        
        return Response({
            "status": "Ok",
            "message": "Carga familiar listada correctamente",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "status": "Error",
            "message": f"Error al recuperar carga familiar: {str(e)}",
            "data": []
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Registro masivo de familiares",
    description="Registra múltiples familiares enviando una lista de objetos.",
    request=FamilyCreateSerializer(many=True),
)
@api_view(['POST'])
def registrar_familiares_masivo(request,cedula_empleado):
    
    empleado = get_object_or_404(Employee, cedulaidentidad=cedula_empleado)
    datos_sucios = request.data
    datos_filtrados = [item for item in datos_sucios if isinstance(item, dict) and 'cedulaFamiliar' in item]
    serializer = FamilyCreateSerializer(data=datos_filtrados, many=True, context={'request': request, 'empleado': empleado})
    
    if serializer.is_valid():
        try:
            with transaction.atomic():
                familiares_creados = serializer.save()
                
                data_response = [
                    {
                        "id": f.id,
                        "cedulaFamiliar": f.cedulaFamiliar,
                        "nombre_completo": f"{f.primer_nombre} {f.primer_apellido}",
                        "parentesco": f.parentesco.descripcion_parentesco if f.parentesco else None
                    }
                    for f in familiares_creados
                ]

                return Response({
                    "status": "Ok",
                    "message": "Familiares registrados correctamente.",
                    "data": data_response
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                "status": "Error",
                "message": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    clean_message = extract_first_error(serializer.errors)

    return Response({
        "status": "Error",
        "message": clean_message, 
        "data": []
    }, status=status.HTTP_400_BAD_REQUEST)
   
     
     
@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Listar patentescos",
    description="Devuelve una lista de todos los parentescosa disponibles.",
    responses=ParentescoSerializer,
)
@api_view(['GET'])
def listar_parentesco(request):
   try:
       valores_permitidos = ["CONYUGUE", "PADRE", "MADRE", "HIJO (A)"]
       queryset = Parentesco.objects.filter(descripcion_parentesco__in=valores_permitidos)
       serializer = ParentescoSerializer(queryset, many=True)
       return Response({
        "status": "Ok",
        "message": "Parentescos listados correctamente",
        "data": serializer.data
    }, status=status.HTTP_200_OK)
   except Exception as e:
        return Response({
            'status': 'Error',
            'message': str(e),
            "data": []
            }, status=status.HTTP_400_BAD_REQUEST)
        
        
@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    summary="Listar Relaciones de contacto de emergencisa",
    description="Devuelve una lista de todas las relaciones de contacto de emergenciaisponibles",
    responses=ParentescoSerializer
)       
@api_view(['GET'])
def list_relationship(request):
   try:
       
       queryset = Parentesco.objects.all()
       serializer = ParentescoSerializer(queryset, many=True)
       return Response({
        "status": "Ok",
        "message": "Relacion del contacto de emergencia listados correctamente",
        "data": serializer.data
    }, status=status.HTTP_200_OK)
   except Exception as e:
        return Response({
            'status': 'Error',
            'message': str(e),
            "data": []
            }, status=status.HTTP_400_BAD_REQUEST) 


@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Subir documento familiar",
    description="Sube un archivo (cédula o partida de nacimiento) para un familiar.",
    request=FamilyDocumentSerializer,
)
@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def subir_documento_familiar(request, familiar_id):
    familiar = get_object_or_404(Employeefamily, id=familiar_id)
    serializer = FamilyDocumentSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(familymember=familiar)
        return Response({
            "status": "Ok",
            "message": "Documento subido exitosamente.",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
    return Response({
        "status": "Error",
        "errors": serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Familiares de Empleados"],
    summary="Listar documentos de un familiar",
)
@api_view(['GET'])
def listar_documentos_familiar(request, familiar_id):
    familiar = get_object_or_404(Employeefamily, id=familiar_id)
    docs = familiar.documentos.all()
    serializer = FamilyDocumentReadSerializer(docs, many=True)
    return Response({
        "status": "Ok",
        "data": serializer.data
    }, status=status.HTTP_200_OK) 
