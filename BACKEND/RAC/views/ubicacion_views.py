from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404
from rest_framework import  status
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from ..models.ubicacion_models import *
from ..serializers.catalogs_serializers import *



@extend_schema(
    tags=["Recursos Humanos - Datos Vivienda"],
    summary="Listar regiones",
    description="Devuelve una lista de parroquias para un municipio específico.",
    responses=ParroquiaSerializer,
)
@api_view(['GET'])
def list_region(request):
    regiones = Region.objects.all()
    serializer = RegionSerializers(regiones, many=True)
    return Response({
        "status": "Ok",
        "message": "Regiones listadas",
        "data": serializer.data,},
         status=status.HTTP_200_OK)
    
 
@extend_schema(
    tags=["Recursos Humanos - Datos Vivienda"],
    summary="Listar estado por su region",
    responses=EstadoSerializer,
)
@api_view(['GET'])
def list_estados_by_region(request, region_id):
    get_object_or_404(Region, pk=region_id)
    
    try:
       
        estados = Estado.objects.filter(Region_id=region_id)
        serializer = EstadoSerializer(estados, many=True)
        
        return Response({
            'status': "success",
            'message': "Estados obtenidos correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "Ocurrio un error al recuperar los estados de esta region",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)  
        
        
         
@extend_schema(
    tags=["Recursos Humanos - Datos Vivienda"],
    summary="Listar estados",
    responses=EstadoSerializer,
)
@api_view(['GET'])
def list_estados(request):
    estados = Estado.objects.all()
    serializer = EstadoSerializer(estados, many=True)
    return Response({
        "status": "Ok",
        "message": "Estados listados",
        "data": serializer.data,},
         status=status.HTTP_200_OK)

@extend_schema(
    tags=["Recursos Humanos - Datos Vivienda"],
    summary="Listar Municipios por Estado",
    description="Devuelve una lista de municipios para un estado específico.",
    responses=MunicipioSerializer,
    )
@api_view(['GET'])
def list_municipios(request, estadoid):

    try:
        
        estado = Estado.objects.get(pk=estadoid)
    except Estado.DoesNotExist:
        return Response({
           
            "status": "Error",
            "message": "Estado no encontrado"
        }, status=status.HTTP_404_NOT_FOUND)
    municipios = Municipio.objects.filter(estadoid=estadoid)
    serializer = MunicipioSerializer(municipios, many=True)
    return Response({
        "status": "Ok",
        "message": f"Municipios del estado {estado.estado}",
        "data": serializer.data
    }, status=status.HTTP_200_OK)


@extend_schema(
    tags=["Recursos Humanos - Datos Vivienda"],
    summary="Listar Parroquias por Municipio",
    description="Devuelve una lista de parroquias para un municipio específico.",
    responses=ParroquiaSerializer,
)
@api_view(['GET'])
def list_parroquias(request, municipioid):
    try:
        municipio = Municipio.objects.get(pk=municipioid)
    except Municipio.DoesNotExist:
        return Response({
            "status": "Error",
            "message": "Municipio no encontrado"
        }, status=status.HTTP_404_NOT_FOUND)
    parroquias = Parroquia.objects.filter(municipioid=municipioid)
    serializer = ParroquiaSerializer(parroquias, many=True)
    return Response({
        "status": "Ok",
        "message": f"Parroquias del municipio {municipio.municipio}",
        "data": serializer.data
    }, status=status.HTTP_200_OK)



