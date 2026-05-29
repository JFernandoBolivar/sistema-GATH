from datetime import date
from rest_framework import serializers
from ..models.historial_personal_models import PrestamoCargo
from ..models.personal_models import Estatus


def verificar_estatus_prestamo(prestamo):
    hoy = date.today()
    activo, _ = Estatus.objects.get_or_create(estatus__iexact="ACTIVO", defaults={"estatus": "ACTIVO"})
    por_vencer, _ = Estatus.objects.get_or_create(estatus__iexact="POR VENCER", defaults={"estatus": "POR VENCER"})
    finalizada, _ = Estatus.objects.get_or_create(estatus__iexact="FINALIZADA", defaults={"estatus": "FINALIZADA"})

    if prestamo.fecha_fin <= hoy:
        prestamo.estatus = finalizada
    elif (prestamo.fecha_fin - hoy).days <= 5:
        prestamo.estatus = por_vencer
    else:
        prestamo.estatus = activo
    prestamo.save()


def validar_encargaduria_unica(cargo, exclude_id=None):
    hoy = date.today()
    qs = PrestamoCargo.objects.filter(
        cargo_encargado=cargo,
        fecha_fin__gte=hoy
    ).exclude(
        estatus__estatus__iexact="FINALIZADA"
    )
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    if qs.exists():
        raise serializers.ValidationError(
            "Ya existe una encargaduria activa para este cargo"
        )


def validar_encargado_unico(empleado, exclude_id=None):
    hoy = date.today()
    qs = PrestamoCargo.objects.filter(
        empleado_encargado=empleado,
        fecha_fin__gte=hoy
    ).exclude(
        estatus__estatus__iexact="FINALIZADA"
    )
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    if qs.exists():
        raise serializers.ValidationError(
            "El trabajador ya tiene una encargaduria activa"
        )
