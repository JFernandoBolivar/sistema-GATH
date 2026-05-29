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


def _build_censo_empleado_data(empleado):
    respuestas = RespuestasEncuesta.objects.filter(
        empleado=empleado
    ).select_related("pregunta__tipo", "opcion")

    from RAC.utils.tiempo_servicio import calcular_total_apn
    cerrados = empleado.antecedentes_servicio_set.filter(fecha_egreso__isnull=False)

    fecha_ingreso_org = None
    primera = empleado.antecedentes_servicio_set.order_by("fecha_ingreso").first()
    if primera:
        fecha_ingreso_org = primera.fecha_ingreso.isoformat() if primera.fecha_ingreso else None

    cargos_data = []
    for asignacion in empleado.assignments.select_related(
        "denominacioncargoid", "OrganismoAdscritoid"
    ):
        cargos_data.append({
            "id": asignacion.id,
            "codigo": asignacion.codigo,
            "cargo": asignacion.denominacioncargoid.cargo if asignacion.denominacioncargoid else None,
            "organismo": asignacion.OrganismoAdscritoid.Organismoadscrito if asignacion.OrganismoAdscritoid else None,
        })

    vivienda = empleado.datos_vivienda_set.first()
    datos_vivienda = None
    if vivienda:
        from RAC.serializers.catalogs_serializers import DatosViviendaSerializer
        datos_vivienda = DatosViviendaSerializer(vivienda).data

    return {
        "id": empleado.id,
        "cedula": empleado.cedulaidentidad,
        "nombres": empleado.nombres,
        "apellidos": empleado.apellidos,
        "fecha_nacimiento": empleado.fecha_nacimiento.isoformat() if empleado.fecha_nacimiento else None,
        "carnet_patria": empleado.carnet_patria,
        "cargos": cargos_data,
        "datos_vivienda": datos_vivienda,
        "total_apn": calcular_total_apn(cerrados),
        "fecha_ingreso_organismo": fecha_ingreso_org,
        "preguntas": [
            {
                "id": r.pregunta_id,
                "pregunta": r.pregunta.enunciado,
                "tipo": r.pregunta.tipo.nombre,
                "opcion": {"id": r.opcion_id, "opcion": r.opcion.tipo_opcion} if r.opcion else None,
                "respuesta": r.respuesta,
            }
            for r in respuestas
        ],
    }


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
        return Response(
            {
                "status": "success",
                "message": "Respuestas obtenidas correctamente",
                "data": [_build_censo_empleado_data(empleado)],
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

        data = [_build_censo_empleado_data(emp) for emp in empleados]

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


@extend_schema(
    tags=["AUTOGESTION - Censo Vivienda"],
    summary="Exportar censos a Excel",
    description="Genera y descarga un archivo Excel con todas las respuestas del censo de vivienda.",
)
@api_view(["GET"])
def exportar_censo_excel(request):
    try:
        import io
        from openpyxl import Workbook
        from django.http import HttpResponse

        empleados = Employee.objects.filter(
            respuestas_encuesta__isnull=False
        ).distinct().order_by("cedulaidentidad")

        wb = Workbook()
        ws = wb.active
        ws.title = "Censo Vivienda"

        preguntas = PreguntasEncuestas.objects.filter(activo=True).order_by("orden")
        pregunta_ids = list(preguntas.values_list("id", flat=True))

        headers = [
            "Cédula", "Nombres", "Apellidos", "Fecha Nacimiento",
            "Carnet Patria", "APN (años)", "APN (meses)", "APN (días)",
            "F. Ingreso Organismo", "Dirección Vivienda", "Código Postal",
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
