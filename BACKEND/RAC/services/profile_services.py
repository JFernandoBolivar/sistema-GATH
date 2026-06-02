from ..models.personal_models import (
    datos_vivienda, perfil_salud, perfil_fisico,
    formacion_academica, formacion_complementaria,
    contacto_emergencia, antecedentes_servicio,
    contratos, OrganismoAdscrito, Estatus,
)
from datetime import date
from django.db import IntegrityError
from ..utils.constants import (
    ESTATUS_ACTIVO,
    ESTATUS_VENCIDO,
    ESTATUS_POR_VENCER,
)


# ---------------------------------------------------------------------------
# Helpers de perfil (sin cambios de lógica)
# ---------------------------------------------------------------------------

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
    # Proteger antecedentes que tienen un contrato asociado
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


# ---------------------------------------------------------------------------
# Lógica de contratos
# ---------------------------------------------------------------------------

def _get_estatus_contratos():
    """
    Obtiene los tres objetos Estatus requeridos para la lógica de contratos.

    Usa get() explícito (no get_or_create) para que los errores de configuración
    sean visibles. Si algún estatus falta, lanza ValueError con instrucciones.
    Ejecute 'python manage.py seed_estatus_contratos' para garantizar su existencia.
    """
    faltantes = []
    result = {}

    for nombre, clave in [
        (ESTATUS_ACTIVO,     'activo'),
        (ESTATUS_POR_VENCER, 'por_vencer'),
        (ESTATUS_VENCIDO,    'vencido'),
    ]:
        try:
            result[clave] = Estatus.objects.get(estatus__iexact=nombre)
        except Estatus.DoesNotExist:
            faltantes.append(nombre)

    if faltantes:
        raise ValueError(
            f"Faltan estatus requeridos en la base de datos: {', '.join(faltantes)}. "
            "Ejecute: python manage.py seed_estatus_contratos"
        )

    return result['activo'], result['por_vencer'], result['vencido']


def _generar_n_contrato(empleado, politica_obj, cantidad_actual):
    """
    Genera el número de contrato con la nomenclatura oficial:
        {inicial_politica}-{cedula}-{correlativo_zfill_2}

    Ejemplos:
        C-30540767-01   (1er contrato, política CONTRATADO)
        C-30540767-02   (2do contrato)
        C-30540767-03   (3er contrato → FIJO)

    Este número SIEMPRE es generado por el backend.
    Cualquier valor que envíe el frontend debe ser ignorado.
    """
    if hasattr(politica_obj, 'tipo_politica'):
        inicial = politica_obj.tipo_politica[0].upper()
    else:
        inicial = 'C'
    cedula = str(empleado.cedulaidentidad)
    correlativo = str(cantidad_actual + 1).zfill(2)
    return f"{inicial}-{cedula}-{correlativo}"


def verificar_estatus_contrato(contrato):
    """
    Determina y guarda el estatus del contrato según sus fechas y modalidad.

    Reglas:
    - Si es_fijo=True: siempre ACTIVO, fecha_culminacion se fuerza a NULL.
      El contrato fijo nunca vence hasta un egreso formal del empleado.
    - Si es_fijo=False:
        · fecha_culminacion NULL          → ACTIVO
        · fecha_culminacion <= hoy        → VENCIDO (incluye el día de vencimiento)
        · fecha_culminacion en ≤ 30 días  → POR VENCER
        · fecha_culminacion en > 30 días  → ACTIVO

    Lanza ValueError si faltan estatus requeridos en la BD.
    """
    activo, por_vencer, vencido = _get_estatus_contratos()
    hoy = date.today()

    # --- Contrato FIJO: nunca vence ---
    if contrato.es_fijo:
        contrato.fecha_culminacion = None
        contrato.estatus_id = activo
        contrato.save()
        return

    # --- Contrato temporal: calcular estatus por fecha ---
    if not contrato.fecha_culminacion:
        contrato.estatus_id = activo
    elif contrato.fecha_culminacion <= hoy:   # BUG FIX: <= incluye el día mismo de vencimiento
        contrato.estatus_id = vencido
    elif (contrato.fecha_culminacion - hoy).days <= 30:
        contrato.estatus_id = por_vencer
    else:
        contrato.estatus_id = activo

    contrato.save()

    # Al vencer, cerrar el antecedente asociado
    if contrato.estatus_id == vencido and contrato.antecedente_id:
        ant = contrato.antecedente_id
        if not ant.fecha_egreso:
            ant.fecha_egreso = hoy
            ant.save()


def upsert_contrato(empleado, contrato_data):
    """
    Crea o actualiza contratos para un empleado.

    El n_contrato SIEMPRE es generado por el backend con _generar_n_contrato.
    Si el item trae n_contrato, se usa solo para buscar si el contrato ya existe
    en BD (actualización). Si no existe, se genera uno nuevo con el formato oficial:
        {inicial_politica}-{cedula}-{correlativo_02}

    Regla FIJO: al registrar el 3er contrato, se marca automáticamente como
    es_fijo=True y fecha_culminacion=None. Este contrato no vencerá hasta
    que el empleado sea egresado formalmente.
    """
    if not contrato_data:
        return None

    if isinstance(contrato_data, dict):
        contrato_data = [contrato_data]

    try:
        organismo_conatel = OrganismoAdscrito.objects.get(
            Organismoadscrito__iexact="CONATEL"
        )
    except OrganismoAdscrito.DoesNotExist:
        raise ValueError(
            "El organismo 'CONATEL' no está registrado en el sistema. "
            "Regístrelo antes de gestionar contratos."
        )

    activo, _, _ = _get_estatus_contratos()
    resultados = []

    for item in contrato_data:
        n_contrato_externo = item.get('n_contrato')   # puede venir del frontend o de la carga masiva
        fecha_ingreso      = item.get('fecha_ingreso')
        politica_id        = item.get('politica_id')
        fecha_culminacion  = item.get('fecha_culminacion')

        if not fecha_ingreso or not politica_id:
            continue

        # Contar contratos actuales del empleado
        cantidad_actual = contratos.objects.filter(
            antecedente_id__empleado_id=empleado
        ).count()

        # Buscar si ya existe por n_contrato (actualización)
        existing = None
        if n_contrato_externo:
            existing = contratos.objects.filter(
                n_contrato=n_contrato_externo,
                antecedente_id__empleado_id=empleado
            ).select_related('antecedente_id').first()

        # Determinar si será el 3er contrato (solo aplica a creaciones nuevas)
        es_tercer_contrato = (not existing) and (cantidad_actual == 2)

        # Gestionar antecedente de servicio
        if existing:
            ant = existing.antecedente_id
            if ant:
                ant.fecha_ingreso = fecha_ingreso
                ant.save()
        else:
            ant = antecedentes_servicio.objects.create(
                empleado_id=empleado,
                organismo_id=organismo_conatel,
                fecha_ingreso=fecha_ingreso,
            )

        # El 3er contrato nunca tiene fecha de fin
        if es_tercer_contrato:
            fecha_culminacion = None

        defaults = {
            'antecedente_id':    ant,
            'fecha_culminacion': fecha_culminacion,
            'politica_id':       politica_id,
            'estatus_id':        activo,
            'es_fijo':           es_tercer_contrato,
        }

        if existing:
            # En actualización: respetar es_fijo ya guardado en BD
            defaults['es_fijo'] = existing.es_fijo
            if existing.es_fijo:
                # Proteger: un contrato fijo no puede recibir fecha_culminacion
                defaults['fecha_culminacion'] = None
            for key, val in defaults.items():
                setattr(existing, key, val)
            existing.save()
            contrato = existing
        else:
            # Si el frontend/Excel envió un n_contrato, usarlo;
            # si no, auto-generar con la nomenclatura oficial
            if n_contrato_externo:
                n_contrato = n_contrato_externo
            else:
                n_contrato = _generar_n_contrato(empleado, politica_id, cantidad_actual)
            try:
                contrato = contratos.objects.create(n_contrato=n_contrato, **defaults)
            except IntegrityError:
                # Race condition: ya existe con ese n_contrato, actualizar
                contratos.objects.filter(n_contrato=n_contrato).update(**defaults)
                contrato = contratos.objects.get(n_contrato=n_contrato)

        verificar_estatus_contrato(contrato)
        resultados.append(contrato)

    return resultados[0] if resultados else None
