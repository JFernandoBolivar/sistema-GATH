from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema

from AUTOGESTION.serializers.serializers_reporte_censo import (
    ReporteCensoDependenciasSerializer,
    ReporteCensoResponseSerializer,
)
from AUTOGESTION.services.censo_report_service import (
    construir_grafico_torta,
    construir_grafico_barras,
)
from RAC.utils.data_formatters import extract_first_error


@extend_schema(
    tags=["AUTOGESTION - Reporte Censo"],
    summary="Generar datos de gráficos de censo por dependencias",
    description=(
        "Recibe IDs de dependencias, direcciones generales, "
        "direcciones de línea y/o coordinaciones como parámetros de consulta (query params). "
        "Devuelve datos agregados para un gráfico de torta "
        "(respondidos vs no respondidos) y un gráfico de barras "
        "(desglose por sub-nivel organizacional)."
    ),
    parameters=[ReporteCensoDependenciasSerializer],
    responses={200: ReporteCensoResponseSerializer},
)
@api_view(["GET"])
def reporte_censo_por_dependencias(request):
    # Obtener y formatear parámetros de consulta (query params)
    query_data = {
        "dependencia_id": [
            int(x) for x in (
                request.query_params.getlist("dependencia_id") +
                request.query_params.getlist("dependencia_id[]") +
                request.query_params.getlist("dependencia_ids") +
                request.query_params.getlist("dependencia_ids[]")
            )
            if str(x).isdigit()
        ],
        "direccion_general_id": [
            int(x) for x in (
                request.query_params.getlist("direccion_general_id") +
                request.query_params.getlist("direccion_general_id[]") +
                request.query_params.getlist("direccion_general_ids") +
                request.query_params.getlist("direccion_general_ids[]")
            )
            if str(x).isdigit()
        ],
        "direccion_linea_id": [
            int(x) for x in (
                request.query_params.getlist("direccion_linea_id") +
                request.query_params.getlist("direccion_linea_id[]") +
                request.query_params.getlist("direccion_linea_ids") +
                request.query_params.getlist("direccion_linea_ids[]")
            )
            if str(x).isdigit()
        ],
        "coordinacion_id": [
            int(x) for x in (
                request.query_params.getlist("coordinacion_id") +
                request.query_params.getlist("coordinacion_id[]") +
                request.query_params.getlist("coordinacion_ids") +
                request.query_params.getlist("coordinacion_ids[]")
            )
            if str(x).isdigit()
        ],
    }

    serializer = ReporteCensoDependenciasSerializer(data=query_data)

    if not serializer.is_valid():
        clean_message = extract_first_error(serializer.errors)
        return Response(
            {
                "status": "error",
                "message": clean_message,
                "data": None,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        data = serializer.validated_data
        dep = data.get("dependencia_id", [])
        dg = data.get("direccion_general_id", [])
        dl = data.get("direccion_linea_id", [])
        coord = data.get("coordinacion_id", [])

        pie_chart = construir_grafico_torta(dep, dg, dl, coord)
        bar_chart = construir_grafico_barras(dep, dg, dl, coord)

        return Response(
            {
                "status": "success",
                "message": "Reporte generado correctamente",
                "data": {
                    "pie_chart": pie_chart,
                    "bar_chart": bar_chart,
                },
            },
            status=status.HTTP_200_OK,
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
