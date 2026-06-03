from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from AUTOGESTION.models.models_encuestas import PreguntasEncuestas
from AUTOGESTION.serializers.serializers_encuestas import (
    CensoEmpleadoSerializer,
    CensoViviendaSubmitSerializer,
    PreguntasEncuestasSerializer,
    CensoExcelFiltrosSerializer,
)
from AUTOGESTION.services.excel_service import generar_excel_censo
from RAC.models.personal_models import Employee
from RAC.utils.data_formatters import extract_first_error


@extend_schema(
    tags=["AUTOGESTION - Censo Vivienda"],
    summary="Listar preguntas activas del censo",
    description="Devuelve todas las preguntas activas ordenadas por el campo 'orden'.",
    request=PreguntasEncuestasSerializer,
)
@api_view(["GET"])
def listar_preguntas_censo(request):
    try:
        preguntas = PreguntasEncuestas.objects.filter(activo=True)
        serializer = PreguntasEncuestasSerializer(preguntas, many=True)
        return Response(
            {
                "status": "success",
                "message": "Preguntas obtenidas correctamente",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {
                "status": "error",
                "message": str(e),
                "data": [],
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


@extend_schema(
    tags=["AUTOGESTION - Censo Vivienda"],
    summary="Registrar respuestas del censo de vivienda",
    description="Guarda las respuestas del censo y actualiza el Carnet de la Patria en el perfil del trabajador.",
    request=CensoViviendaSubmitSerializer,
)
@api_view(["POST"])
def registrar_censo_vivienda(request, cedula_empleado):
    empleado = get_object_or_404(Employee, cedulaidentidad=cedula_empleado)

    serializer = CensoViviendaSubmitSerializer(
        data=request.data,
        context={"empleado": empleado, "request": request},
    )

    if serializer.is_valid():
        try:
            serializer.save()
            return Response(
                {
                    "status": "success",
                    "message": "Censo de vivienda registrado correctamente",
                    "data": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {
                    "status": "error",
                    "message": str(e),
                    "data": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    clean_message = extract_first_error(serializer.errors)
    return Response(
        {
            "status": "error",
            "message": clean_message,
            "data": None,
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


@extend_schema(
    tags=["AUTOGESTION - Censo Vivienda"],
    summary="Consultar respuestas de un trabajador",
    description="Devuelve las respuestas del censo de un trabajador identificado por su cédula.",
)
@api_view(["GET"])
def consultar_censo_empleado(request, cedula):
    try:
        empleado = Employee.objects.get(cedulaidentidad=cedula)
    except Employee.DoesNotExist:
        return Response(
            {
                "status": "error",
                "message": "No se encontró un trabajador con esa cédula.",
                "data": [],
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        serializer = CensoEmpleadoSerializer(empleado)
        return Response(
            {
                "status": "success",
                "message": "Respuestas obtenidas correctamente",
                "data": [serializer.data],
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {
                "status": "error",
                "message": str(e),
                "data": [],
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


@extend_schema(
    tags=["AUTOGESTION - Censo Vivienda"],
    summary="Consultar todos los censos registrados",
    description="Devuelve las respuestas del censo de todos los trabajadores que han respondido.",
)
@api_view(["GET"])
def consultar_todos_censos(request):
    try:
        empleados = Employee.objects.filter(
            respuestas_encuesta__isnull=False
        ).distinct().order_by("cedulaidentidad")

        serializer = CensoEmpleadoSerializer(empleados, many=True)

        return Response(
            {
                "status": "success",
                "message": "Respuestas obtenidas correctamente",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {
                "status": "error",
                "message": str(e),
                "data": [],
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

@extend_schema(
    tags=["AUTOGESTION - Censo Vivienda"],
    summary="Exportar censos a Excel con filtros",
    description="Genera y descarga un archivo Excel con las respuestas del censo de vivienda, aplicando filtros opcionales por direccion general, direccion de linea, dependencia, coordinacion o tipo de nomina.",
    request=CensoExcelFiltrosSerializer,
)
@api_view(["POST"])
def exportar_censo_excel(request):
    try:
        serializer = CensoExcelFiltrosSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": serializer.errors,
                    "data": [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        filtros = serializer.validated_data.get("filtros", {})
        output = generar_excel_censo(filtros)

        response = HttpResponse(
            output.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = (
            'attachment; filename="censo_vivienda.xlsx"'
        )
        return response
    except Exception as e:
        return Response(
            {
                "status": "error",
                "message": str(e),
                "data": [],
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
