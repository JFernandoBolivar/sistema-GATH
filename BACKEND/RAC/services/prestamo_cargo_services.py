from datetime import date
from rest_framework import serializers
from ..models.historial_personal_models import PrestamoCargo
from ..models.personal_models import Estatus, AsigTrabajo


def sincronizar_estatus_cargos(prestamo):
    """
    Sincroniza los estatus de los cargos de AsigTrabajo según el estado del préstamo.

    - ACTIVO / POR VENCER:
        * Cargo original del encargado -> SUSPENDIDO
        * Cargo prestado (del titular) -> SUSPENDIDO
    - FINALIZADA:
        * Cargo original del encargado -> ACTIVO
        * Cargo prestado (del titular) -> ACTIVO
    """
    # Obtener estatus necesarios
    activo_asig, _ = Estatus.objects.get_or_create(estatus__iexact="ACTIVO", defaults={"estatus": "ACTIVO"})
    suspendido, _ = Estatus.objects.get_or_create(estatus__iexact="SUSPENDIDO", defaults={"estatus": "SUSPENDIDO"})

    estatus_prestamo = prestamo.estatus.estatus.upper()

    if estatus_prestamo in ["ACTIVO", "POR VENCER"]:
        # 1. Suspender cargos originales del empleado encargado (quien toma prestado el cargo)
        AsigTrabajo.objects.filter(
            employee=prestamo.empleado_encargado,
            estatusid__estatus__iexact="ACTIVO"
        ).update(estatusid=suspendido)

        # 2. Suspender el cargo prestado (para que el titular quede suspendido del mismo)
        cargo = prestamo.cargo_encargado
        if cargo:
            cargo.estatusid = suspendido
            cargo.save()

    elif estatus_prestamo == "FINALIZADA":
        # 1. Reactivar cargos originales del empleado encargado
        AsigTrabajo.objects.filter(
            employee=prestamo.empleado_encargado,
            estatusid__estatus__iexact="SUSPENDIDO"
        ).update(estatusid=activo_asig)

        # 2. Reactivar el cargo prestado
        cargo = prestamo.cargo_encargado
        if cargo:
            cargo.estatusid = activo_asig
            cargo.save()


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

    # Sincronizar los estatus de los cargos involucrados
    sincronizar_estatus_cargos(prestamo)


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
