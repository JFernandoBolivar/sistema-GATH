"""
Utilidades compartidas por los repositorios de reportes (G11).

Concentran, en un solo lugar, las reglas que deben ser idénticas en **todos**
los reportes:

- tope de filas y metadatos de truncado (`pagina_con_metadatos`),
- elección de la asignación de trabajo de un empleado cuando tiene varias
  (`elegir_asignaciones`): la ACTIVA o, si no hay, la más reciente,
- fecha de ingreso = reingreso más reciente (`fechas_de_ingreso`),
- lotes acotados para traer datos relacionados sin N+1 (`en_lotes`).

Las tablas son legadas (`managed=False`) y `AsigTrabajo.employee` apunta a la
**cédula**, mientras `AntecedenteServicio.empleado` apunta a la **PK** de
`Employee`: cada función recibe la clave que corresponde.
"""
from django.db.models import Max

TAMANO_DE_LOTE = 500

# Valor del catálogo `EstatusModel.estatus` que marca una asignación vigente.
ESTATUS_ASIGNACION_ACTIVA = 'ACTIVO'


def en_lotes(valores: list) -> list[list]:
    """Parte una lista en lotes de `TAMANO_DE_LOTE` (acota el `IN (...)` del SQL)."""
    valores = list(valores)
    return [
        valores[inicio:inicio + TAMANO_DE_LOTE]
        for inicio in range(0, len(valores), TAMANO_DE_LOTE)
    ]


def pagina_con_metadatos(qs, limite: int) -> tuple[list, dict]:
    """Materializa la página **una sola vez** y arma los metadatos de truncado.

    `limite = 0` significa «sin tope» (solo lo usan las salidas que no son PDF).
    """
    total_encontrados = qs.count()
    metadatos = {
        'total_encontrados': total_encontrados,
        'limite': limite,
        'truncado': bool(limite > 0 and total_encontrados > limite),
    }
    return (list(qs[:limite] if limite > 0 else qs), metadatos)


def es_asignacion_activa(asignacion) -> bool:
    estatus = getattr(getattr(asignacion, 'estatusid', None), 'estatus', None) or ''
    return estatus.strip().upper() == ESTATUS_ASIGNACION_ACTIVA


def clave_de_asignacion(asignacion) -> tuple[int, float, int]:
    """Orden total de preferencia entre asignaciones de un mismo empleado.

    Activa primero; luego la más reciente (`fecha_actualizacion`, el único
    campo de fecha de `AsigTrabajo`); la PK desempata para que dos ejecuciones
    devuelvan siempre la misma.
    """
    actualizada = (
        asignacion.fecha_actualizacion.timestamp()
        if asignacion.fecha_actualizacion else 0.0
    )
    return (1 if es_asignacion_activa(asignacion) else 0, actualizada, asignacion.pk)


def elegir_asignaciones(asignaciones) -> dict:
    """Una asignación por cédula: la ACTIVA o, si no hay, la más reciente."""
    elegidas = {}
    for asignacion in asignaciones:
        if asignacion.employee_id is None:
            continue
        actual = elegidas.get(asignacion.employee_id)
        if actual is None or clave_de_asignacion(asignacion) > clave_de_asignacion(actual):
            elegidas[asignacion.employee_id] = asignacion
    return elegidas


def fechas_de_ingreso(antecedente_model, empleado_pks) -> dict:
    """Fecha del **reingreso más reciente** por PK de empleado, en lotes."""
    fechas = {}
    for lote in en_lotes(list(empleado_pks)):
        filas = (
            antecedente_model.objects
            .filter(empleado__in=lote)
            .values('empleado_id')
            .annotate(ultimo=Max('fecha_ingreso'))
        )
        fechas.update({fila['empleado_id']: fila['ultimo'] for fila in filas})
    return fechas


def ingresos_por_empleado(antecedente_model, empleado_pks) -> dict:
    """Todas las fechas de ingreso (ascendentes, sin nulos) por PK de empleado, en lotes."""
    ingresos: dict = {}
    for lote in en_lotes(list(empleado_pks)):
        filas = (
            antecedente_model.objects
            .filter(empleado__in=lote, fecha_ingreso__isnull=False)
            .order_by('empleado_id', 'fecha_ingreso')
            .values_list('empleado_id', 'fecha_ingreso')
        )
        for empleado_id, fecha in filas:
            ingresos.setdefault(empleado_id, []).append(fecha)
    return ingresos


def ingreso_previo_a(fechas_ingreso: list, fecha_egreso):
    """
    Ingreso que corresponde a un egreso: el más reciente que no sea posterior a
    él (con reingresos, cada egreso muestra su propio ingreso). Sin fecha de
    egreso, el reingreso más reciente; sin ingresos previos, `None`.
    """
    if not fechas_ingreso:
        return None
    if fecha_egreso is None:
        return fechas_ingreso[-1]
    limite = fecha_egreso.date() if hasattr(fecha_egreso, 'date') else fecha_egreso
    previos = [f for f in fechas_ingreso if f <= limite]
    return previos[-1] if previos else None
