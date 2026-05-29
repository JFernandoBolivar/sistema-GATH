from ..models.personal_models import (
    datos_vivienda, perfil_salud, perfil_fisico,
    formacion_academica, formacion_complementaria,
    contacto_emergencia, antecedentes_servicio,
    contratos, OrganismoAdscrito, Estatus,
)
from datetime import date, timedelta
from django.db import IntegrityError


def upsert_vivienda(instance, data):
    if not data:
        return
    datos_vivienda.objects.update_or_create(empleado_id=instance, defaults=data)


def upsert_health_profile(instance, data, related_field="empleado_id"):
    if not data:
        return
    patologias = data.pop("patologiaCronica", None)
    discapacidades = data.pop("discapacidad", None)
    alergias = data.pop("alergias", None)
    kwargs = {related_field: instance}
    s_obj, _ = perfil_salud.objects.update_or_create(**kwargs, defaults=data)
    if patologias is not None:
        s_obj.patologiaCronica.set(patologias)
    if discapacidades is not None:
        s_obj.discapacidad.set(discapacidades)
    if alergias is not None:
        s_obj.alergias.set(alergias)


def create_health_profile(instance, data, related_field="familiar_id"):
    if not data:
        return
    patologias = data.pop("patologiaCronica", [])
    discapacidades = data.pop("discapacidad", [])
    alergias = data.pop("alergias", [])
    kwargs = {related_field: instance}
    s_obj = perfil_salud.objects.create(**kwargs, **data)
    if patologias:
        s_obj.patologiaCronica.set(patologias)
    if discapacidades:
        s_obj.discapacidad.set(discapacidades)
    if alergias:
        s_obj.alergias.set(alergias)


def upsert_physical_profile(instance, data, related_field="empleado_id"):
    if not data:
        return
    kwargs = {related_field: instance}
    perfil_fisico.objects.update_or_create(**kwargs, defaults=data)


def create_physical_profile(instance, data, related_field="familiar_id"):
    if not data:
        return
    kwargs = {related_field: instance}
    perfil_fisico.objects.create(**kwargs, **data)


def upsert_academic_profile(instance, data, related_field="empleado_id"):
    if not data:
        return
    if isinstance(data, list):
        formacion_academica.objects.filter(**{related_field: instance}).delete()
        for item in data:
            formacion_academica.objects.create(**{related_field: instance, **item})
    else:
        kwargs = {related_field: instance}
        formacion_academica.objects.update_or_create(**kwargs, defaults=data)


def create_academic_profile(instance, data, related_field="familiar_id"):
    if not data:
        return
    kwargs = {related_field: instance}
    formacion_academica.objects.create(**kwargs, **data)


def replace_complementaria(instance, data_list):
    if data_list is None:
        return
    instance.formacion_complementaria_set.all().delete()
    for item in data_list:
        if not item.get('capacitacion_id'):
            continue
        formacion_complementaria.objects.create(empleado_id=instance, **item)


def replace_contacto_emergencia(instance, data_list):
    if data_list is None:
        return
    contacto_emergencia.objects.filter(empleado_id=instance).delete()
    for item in data_list:
        contacto_emergencia.objects.create(empleado_id=instance, **item)


def replace_antecedentes(instance, data_list):
    if data_list is None:
        return
    existing_qs = instance.antecedentes_servicio_set.all()
    existing_ids = set(existing_qs.values_list('id', flat=True))
    protected_ids = set(
        contratos.objects.filter(
            antecedente_id__in=existing_ids
        ).values_list('antecedente_id', flat=True)
    )
    kept_ids = set()
    for item in data_list:
        if not item.get('fecha_ingreso'):
            continue
        ingreso = item.get('fecha_ingreso')
        egreso = item.get('fecha_egreso')
        org_id = item.get('organismo_id')
        match = existing_qs.filter(
            organismo_id=org_id,
            fecha_ingreso=ingreso,
            fecha_egreso=egreso,
        ).first()
        if match:
            kept_ids.add(match.id)
            continue
        antecedentes_servicio.objects.create(empleado_id=instance, **item)
    deleteable = existing_ids - kept_ids - protected_ids
    if deleteable:
        instance.antecedentes_servicio_set.filter(id__in=deleteable).delete()


def verificar_estatus_contrato(contrato):
    hoy = date.today()

    try:
        activo = Estatus.objects.get(estatus__iexact="ACTIVO")
        por_vencer, _ = Estatus.objects.get_or_create(estatus="POR VENCER")
        vencido = Estatus.objects.get(estatus__iexact="VENCIDO")
    except Estatus.DoesNotExist:
        return

    if not contrato.fecha_culminacion:
        contrato.estatus_id = activo
    elif contrato.fecha_culminacion < hoy:
        contrato.estatus_id = vencido
    elif (contrato.fecha_culminacion - hoy).days <= 30:
        contrato.estatus_id = por_vencer
    else:
        contrato.estatus_id = activo

    contrato.save()

    # al vencer, cerrar el antecedente de este contrato
    if contrato.estatus_id == vencido and contrato.antecedente_id:
        ant = contrato.antecedente_id
        if not ant.fecha_egreso:
            ant.fecha_egreso = hoy
            ant.save()


def upsert_contrato(empleado, contrato_data):
    if not contrato_data:
        return None

    if isinstance(contrato_data, dict):
        contrato_data = [contrato_data]

    organismo_conatel = OrganismoAdscrito.objects.get(
        Organismoadscrito__iexact="CONATEL"
    )

    resultados = []

    for item in contrato_data:
        n_contrato = item.get('n_contrato')
        fecha_ingreso = item.get('fecha_ingreso')
        politica_id = item.get('politica_id')
        fecha_culminacion = item.get('fecha_culminacion')

        if not n_contrato or not fecha_ingreso or not politica_id:
            continue

        # cada contrato tiene su propio antecedente
        updated = contratos.objects.filter(n_contrato=n_contrato).select_related('antecedente_id').first()

        if updated:
            ant = updated.antecedente_id
            if ant:
                ant.fecha_ingreso = fecha_ingreso
                ant.save()
        else:
            ant = antecedentes_servicio.objects.create(
                empleado_id=empleado,
                organismo_id=organismo_conatel,
                fecha_ingreso=fecha_ingreso,
            )

        defaults = {
            'antecedente_id': ant,
            'fecha_culminacion': fecha_culminacion,
            'politica_id': politica_id,
            'estatus_id': Estatus.objects.get(estatus__iexact="ACTIVO"),
        }

        if updated:
            for key, val in defaults.items():
                setattr(updated, key, val)
            updated.save()
            contrato = updated
        else:
            try:
                contrato = contratos.objects.create(n_contrato=n_contrato, **defaults)
            except IntegrityError:
                contratos.objects.filter(n_contrato=n_contrato).update(**defaults)
                contrato = contratos.objects.get(n_contrato=n_contrato)

        verificar_estatus_contrato(contrato)
        resultados.append(contrato)

    return resultados[0] if resultados else None
