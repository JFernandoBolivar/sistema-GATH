from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from AUTOGESTION.models.models_encuestas import PreguntasEncuestas, RespuestasEncuesta
from AUTOGESTION.serializers.serializers_encuestas import (
    PreguntasEncuestasSerializer,
    CensoViviendaSubmitSerializer,
)
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

    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "status": "success",
                "message": "Censo de vivienda registrado correctamente",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )
    except ValidationError:
        clean_message = extract_first_error(serializer.errors)
        return Response(
            {
                "status": "error",
                "message": clean_message,
                "data": None,
            },
            status=status.HTTP_400_BAD_REQUEST,
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


@extend_schema(
    tags=["AUTOGESTION - Censo Vivienda"],
    summary="Consultar respuestas de un trabajador",
    description="Devuelve las respuestas del censo de un trabajador identificado por su cédula.",
)
@api_view(["GET"])
def consultar_censo_empleado(request, cedula):
    try:
        empleado = get_object_or_404(Employee, cedulaidentidad=cedula)
    except Exception:
        return Response(
            {
                "status": "error",
                "message": "No se encontró un trabajador con esa cédula.",
                "data": [],
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        respuestas = RespuestasEncuesta.objects.filter(
            empleado=empleado
        ).select_related("pregunta__tipo", "opcion")

        data = {
            "empleado_cedula": empleado.cedulaidentidad,
            "carnet_patria": empleado.carnet_patria or "",
            "respuestas": [
                {
                    "pregunta_id": r.pregunta_id,
                    "pregunta": r.pregunta.enunciado,
                    "tipo": r.pregunta.tipo.nombre,
                    "opcion_id": r.opcion_id,
                    "opcion": r.opcion.tipo_opcion if r.opcion else None,
                    "respuesta": r.respuesta,
                }
                for r in respuestas
            ],
        }

        return Response(
            {
                "status": "success",
                "message": "Respuestas obtenidas correctamente",
                "data": data,
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
