import json
import os
import uuid
import urllib.request

from io import BytesIO

from django.conf import settings
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from RAC.models import Employee, AsigTrabajo, Denominacioncargo, DireccionGeneral
from .models import CarnetEmitido, MotivosEmision, CarnetTemplate
from .serializers import CarnetTemplateSerializer

from RAC.serializers.catalogs_serializers import (
    denominacionCargoSerializer as DenominacioncargoSerializer,
    DireccionGeneralSerializer,
)
from .services.helpers import  *
from .services.designer import designer as carnet_designer
from .services.generator import generator as carnet_generator


def _fetch_photo_from_nestjs(cedula):
    url = f"{settings.NESTJS_URL}read-file/profile/{cedula}/"
    try:
        with urllib.request.urlopen(url) as resp:
            if resp.status == 200:
                return BytesIO(resp.read())
    except Exception:
        pass
    return None


def _upload_to_nestjs(file_obj, cedula):
    url = f"{settings.NESTJS_URL}file-save/upload/profile/{cedula}/"
    file_data = file_obj.read()
    boundary = uuid.uuid4().hex
    filename = os.path.basename(file_obj.name)

    body_parts = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: {file_obj.content_type or 'application/octet-stream'}\r\n\r\n".encode("utf-8"),
        file_data,
        f"\r\n--{boundary}--\r\n".encode("utf-8"),
    ]
    body = b"".join(body_parts)

    req = urllib.request.Request(url, data=body)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 201)
    except Exception:
        return False


# ─────────────────────────────────────────────
# API REST (DRF - para NextJS)
# ─────────────────────────────────────────────

@api_view(['GET'])
def api_buscar_personal(request):
    query = request.GET.get("q", "").strip()
    if not query:
        return Response([])

    employees = Employee.objects.filter(
        Q(cedulaidentidad__icontains=query) |
        Q(nombres__icontains=query) |
        Q(apellidos__icontains=query)
    ).order_by('apellidos', 'nombres')[:20]

    results = []
    for emp in employees:
        info = get_employee_carnet_info(emp)
        carnet = CarnetEmitido.objects.filter(employee=emp, activo=True).first()
        info['tiene_carnet'] = carnet is not None
        info['total_solicitudes'] = CarnetEmitido.objects.filter(employee=emp).count()
        results.append(info)

    return Response(results)


@api_view(['GET'])
def api_listar_cargos(request):
    cargos = Denominacioncargo.objects.all().order_by('cargo')
    serializer = DenominacioncargoSerializer(cargos, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def api_listar_departamentos(request):
    deptos = DireccionGeneral.objects.all().order_by('direccion_general')
    serializer = DireccionGeneralSerializer(deptos, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def api_listar_motivos(request):
    motivos = MotivosEmision.objects.all().order_by('nombre')
    return Response([{"id": m.id, "nombre": m.nombre} for m in motivos])


@api_view(['POST'])
def api_actualizar_vista_previa(request, cedula):
    try:
        employee = get_object_or_404(Employee, cedulaidentidad=cedula)
        data = request.data or {}

        foto_buffer = _fetch_photo_from_nestjs(cedula)

        personal_virtual = employee_to_carnet_data(employee, datos_editados=data)
        nueva_vista_previa = carnet_designer.generar_vista_previa_html(
            personal_virtual, foto_buffer, data
        )

        return Response({"success": True, "vista_previa": nueva_vista_previa})
    except Exception as exc:
        return Response({"success": False, "error": str(exc)}, status=500)


@api_view(['POST'])
def api_subir_foto(request, cedula):
    try:
        employee = get_object_or_404(Employee, cedulaidentidad=cedula)
        file = request.FILES.get("foto")
        if not file:
            return Response({"success": False, "error": "No se envió ninguna foto"})

        if not file.name:
            return Response({"success": False, "error": "Nombre de archivo vacío"})

        exito = _upload_to_nestjs(file, cedula)
        if not exito:
            return Response({"success": False, "error": "Error al guardar la foto en el servidor de archivos"})

        datos_editados = {
            "nombre": request.POST.get("nombre", f"{employee.nombres} {employee.apellidos}"),
            "cedula": cedula,
        }

        foto_buffer = _fetch_photo_from_nestjs(cedula)
        personal_virtual = employee_to_carnet_data(employee, datos_editados=datos_editados)
        nueva_vista_previa = carnet_designer.generar_vista_previa_html(
            personal_virtual, foto_buffer, datos_editados
        )

        return Response({
            "success": True,
            "filename": file.name,
            "vista_previa": nueva_vista_previa,
            "message": "Foto subida exitosamente",
        })
    except Exception as exc:
        return Response({"success": False, "error": str(exc)}, status=500)


@api_view(['POST'])
def api_registrar_solicitud(request, cedula):
    try:
        employee = get_object_or_404(Employee, cedulaidentidad=cedula)
        data = request.data or {}

        CarnetEmitido.objects.filter(employee=employee, activo=True).update(activo=False)

        motivo_id = data.get("motivo_id")
        if not motivo_id:
            default = MotivosEmision.objects.first()
            motivo_id = default.id if default else 1

        CarnetEmitido.objects.create(
            employee=employee,
            motivo_id=motivo_id,
            observaciones=data.get("observaciones", ""),
            activo=True,
        )

        total = CarnetEmitido.objects.filter(employee=employee).count()
        return Response({
            "status": "success",
            "message": "Solicitud registrada exitosamente",
            "total": total,
        })
    except Exception as exc:
        return Response({"status": "error", "message": str(exc)}, status=500)


@api_view(['POST'])
def api_generar_carnet(request, cedula):
    try:
        employee = get_object_or_404(Employee, cedulaidentidad=cedula)
        data = request.data or {}

        CarnetEmitido.objects.filter(employee=employee, activo=True).update(activo=False)

        motivo_id = data.get("motivo_id")
        if not motivo_id:
            default = MotivosEmision.objects.first()
            motivo_id = default.id if default else 1

        carnet = CarnetEmitido.objects.create(
            employee=employee,
            motivo_id=motivo_id,
            observaciones=data.get("observaciones", ""),
            activo=True,
        )

        foto_buffer = _fetch_photo_from_nestjs(cedula)

        datos_editados = data.get("datos_editados", {})
        personal_virtual = employee_to_carnet_data(employee, datos_editados=datos_editados)
        personal_virtual.total_solicitudes = CarnetEmitido.objects.filter(employee=employee).count()

        solicitud_numero = personal_virtual.total_solicitudes

        pdf_path, pdf_buffer = carnet_designer.generar_carnet(
            personal=personal_virtual,
            solicitud_numero=solicitud_numero,
            carnet_id=carnet.id,
            security_hash=carnet.security_hash,
            foto_buffer=foto_buffer,
        )

        response = HttpResponse(pdf_buffer, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="carnet_{cedula}.pdf"'
        return response
    except Exception as exc:
        return Response({"status": "error", "message": str(exc)}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def api_validar_carnet(request, carnet_id):
    carnet = CarnetEmitido.objects.filter(id=carnet_id, activo=True).select_related('employee').first()
    if not carnet:
        return Response({
            "estado": "NO_VÁLIDO",
            "mensaje": "Carnet no encontrado o inválido",
        })

    expected_hash = carnet._compute_security_hash()
    if carnet.security_hash != expected_hash:
        return Response({
            "estado": "NO_VÁLIDO",
            "mensaje": "Hash de seguridad inválido",
        })

    employee = carnet.employee
    nombre_completo = f"{employee.nombres} {employee.apellidos}".strip()

    cargo = ""
    codigo = ""
    ubicacion = ""
    tipo_nomina = ""

    asig = AsigTrabajo.objects.filter(
        employee=employee.cedulaidentidad
    ).select_related(
        'denominacioncargoid',
        'Coordinacion',
        'DireccionLinea',
        'DireccionGeneral',
        'tiponominaid',
    ).first()

    if asig:
        if asig.denominacioncargoid:
            cargo = asig.denominacioncargoid.cargo
        codigo = asig.codigo
        if asig.Coordinacion:
            ubicacion = asig.Coordinacion.coordinacion
        elif asig.DireccionLinea:
            ubicacion = asig.DireccionLinea.direccion_linea
        elif asig.DireccionGeneral:
            ubicacion = asig.DireccionGeneral.direccion_general
        if asig.tiponominaid:
            tipo_nomina = asig.tiponominaid.nomina

    return Response({
        "estado": "VÁLIDO",
        "datos": {
            "id": carnet.id,
            "cedula": employee.cedulaidentidad,
            "nombre_completo": nombre_completo,
            "cargo": cargo,
            "codigo": codigo,
            "ubicacion": ubicacion,
            "tipo_nomina": tipo_nomina,
        },
    })


@api_view(['GET'])
def api_estadisticas(request):
    from django.utils import timezone

    stats = carnet_generator.obtener_estadisticas()
    total = CarnetEmitido.objects.count()
    activos = CarnetEmitido.objects.filter(activo=True).count()
    local_now = timezone.localtime(timezone.now())
    hoy = CarnetEmitido.objects.filter(
        fecha_emision__date=local_now.date()
    ).count()
    this_month = CarnetEmitido.objects.filter(
        fecha_emision__gte=local_now.replace(day=1)
    ).count()

    ultimos = []
    solicitudes = CarnetEmitido.objects.select_related(
        'employee', 'motivo'
    ).order_by('-fecha_emision')[:10]

    for s in solicitudes:
        emp = s.employee
        ultimos.append({
            'nombre': f"{emp.nombres} {emp.apellidos}",
            'cedula': emp.cedulaidentidad,
            'fecha': s.fecha_emision.strftime('%d/%m/%Y %H:%M'),
            'motivo': s.motivo.nombre if s.motivo else '',
            'motivo_id': s.motivo_id,
            'activo': s.activo,
        })

    return Response({
        'total': total,
        'activos': activos,
        'hoy': hoy,
        'this_month': this_month,
        'tamano_total': stats.get('tamano_total', '0 MB'),
        'ultimos': ultimos,
    })


@api_view(['GET'])
def api_listar_plantillas(request):
    plantillas = CarnetTemplate.objects.all().order_by('-activo', '-creado')
    serializer = CarnetTemplateSerializer(plantillas, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def api_crear_plantilla(request):
    serializer = CarnetTemplateSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['POST'])
def api_activar_plantilla(request, plantilla_id):
    plantilla = get_object_or_404(CarnetTemplate, id=plantilla_id)
    CarnetTemplate.objects.filter(activo=True).exclude(id=plantilla_id).update(activo=False)
    plantilla.activo = True
    plantilla.save(update_fields=['activo'])
    serializer = CarnetTemplateSerializer(plantilla)
    return Response(serializer.data)
