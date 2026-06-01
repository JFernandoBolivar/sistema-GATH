from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from AUTOGESTION.models.models_encuestas import PreguntasEncuestas, RespuestasEncuesta
from AUTOGESTION.serializers.serializers_encuestas import (
    CensoEmpleadoSerializer,
    CensoViviendaSubmitSerializer,
    PreguntasEncuestasSerializer,
)
from AUTOGESTION.services.censo_service import build_censo_queryset
from AUTOGESTION.utils.mapa_reporte import MAPA_REPORTES
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


class CensoExcelFiltrosSerializer(serializers.Serializer):
    filtros = serializers.JSONField(required=False, default=dict)

    def validate_filtros(self, value):
        config = MAPA_REPORTES.get("censo_vivienda", {})
        filtros_permitidos = config.get("filtros_permitidos", {})
        for key in value:
            if key not in filtros_permitidos:
                raise serializers.ValidationError(
                    f"El filtro '{key}' no esta permitido. Filtros disponibles: {list(filtros_permitidos.keys())}"
                )
        return value


@extend_schema(
    tags=["AUTOGESTION - Censo Vivienda"],
    summary="Exportar censos a Excel con filtros",
    description="Genera y descarga un archivo Excel con las respuestas del censo de vivienda, aplicando filtros opcionales por direccion general, direccion de linea, dependencia, coordinacion o tipo de nomina.",
    request=CensoExcelFiltrosSerializer,
)
@api_view(["POST"])
def exportar_censo_excel(request):
    try:
        import io
        from openpyxl import Workbook
        from django.http import HttpResponse

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

        empleados = build_censo_queryset(filtros)

        wb = Workbook()
        ws = wb.active
        ws.title = "Censo Vivienda"

        preguntas = PreguntasEncuestas.objects.filter(activo=True).order_by("orden")
        pregunta_ids = list(preguntas.values_list("id", flat=True))

        headers = [
            "Cédula", "Nombres", "Apellidos", "Fecha Nacimiento",
            "Carnet Patria", "APN (años)", "APN (meses)", "APN (días)",
            "F. Ingreso Organismo", "Dirección General", "Tipo de Nómina",
            "Dirección Vivienda", "Código Postal",
        ]
        for p in preguntas:
            headers.append(p.enunciado)

        ws.append(headers)

        for emp in empleados:
            respuestas = RespuestasEncuesta.objects.filter(
                empleado=emp
            ).select_related("pregunta", "opcion")

            respuestas_map = {}
            for r in respuestas:
                respuestas_map[r.pregunta_id] = r.opcion.tipo_opcion if r.opcion else r.respuesta

            from RAC.utils.tiempo_servicio import calcular_total_apn
            cerrados = emp.antecedentes_servicio_set.filter(fecha_egreso__isnull=False)
            total_apn = calcular_total_apn(cerrados)

            fecha_ingreso_org = ""
            primera = emp.antecedentes_servicio_set.order_by("fecha_ingreso").first()
            if primera and primera.fecha_ingreso:
                fecha_ingreso_org = primera.fecha_ingreso.isoformat()

            vivienda = emp.datos_vivienda_set.first()
            direccion = vivienda.direccion_exacta if vivienda else ""
            codigo_postal = vivienda.codigo_postal if vivienda else ""

            asignaciones = getattr(emp, "filtered_assignments", [])
            dg_nombre = ""
            nomina_nombre = ""
            if asignaciones:
                dg = asignaciones[0].DireccionGeneral
                dg_nombre = dg.direccion_general if dg else ""
                nomina = asignaciones[0].tiponominaid
                nomina_nombre = nomina.nomina if nomina else ""

            row = [
                emp.cedulaidentidad,
                emp.nombres,
                emp.apellidos,
                emp.fecha_nacimiento.isoformat() if emp.fecha_nacimiento else "",
                emp.carnet_patria or "",
                total_apn["years"],
                total_apn["months"],
                total_apn["days"],
                fecha_ingreso_org,
                dg_nombre,
                nomina_nombre,
                direccion,
                codigo_postal,
            ]

            for pid in pregunta_ids:
                row.append(respuestas_map.get(pid, ""))

            ws.append(row)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

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
