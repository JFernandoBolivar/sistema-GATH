"""
Mapper ORM -> Entidad de Punto de Cuenta, resolviendo los nombres de
empleado/dependencias/motivo/oficinas/divisiones (joins de lectura tolerantes).
Optimizado para eliminar consultas N+1 mediante resolución en lote.
"""
from typing import Any, Iterable

from apps.catalogos.infrastructure.models.catalogo_models import TipoMovimientoModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.puntocuenta.domain.entities.punto_cuenta import PuntoCuenta


def construir_contexto_precarga(modelos: Iterable[Any]) -> dict[str, dict]:
    """
    Realiza una sola consulta por entidad relacionada para un conjunto de filas
    de PuntoCuentaModel, eliminando el problema N+1 al mapear listas.
    """
    modelos_lista = list(modelos)
    if not modelos_lista:
        return {
            'cargos': {},
            'empleados': {},
            'dependencias': {},
            'motivos': {},
            'oficinas': {},
            'divisiones': {},
        }

    cargos_ids = {m.cargo_id for m in modelos_lista if getattr(m, 'cargo_id', None)}
    cedulas = {m.empleado_cedula for m in modelos_lista if getattr(m, 'empleado_cedula', None)}
    deps_ids: set[int] = set()
    oficinas_ids: set[int] = set()
    divisiones_ids: set[int] = set()
    motivos_ids = {m.motivo_id for m in modelos_lista if getattr(m, 'motivo_id', None)}

    for m in modelos_lista:
        origen_dep = getattr(m, 'dependencia_origen_id', None)
        destino_dep = getattr(m, 'dependencia_destino_id', None)
        if origen_dep:
            deps_ids.add(origen_dep)
        if destino_dep:
            deps_ids.add(destino_dep)

        origen_ofi = getattr(m, 'oficina_origen_id', None)
        destino_ofi = getattr(m, 'oficina_destino_id', None)
        if origen_ofi:
            oficinas_ids.add(origen_ofi)
        if destino_ofi:
            oficinas_ids.add(destino_ofi)

        origen_div = getattr(m, 'division_origen_id', None)
        destino_div = getattr(m, 'division_destino_id', None)
        if origen_div:
            divisiones_ids.add(origen_div)
        if destino_div:
            divisiones_ids.add(destino_div)

    cargos = {}
    if cargos_ids:
        qs_cargos = AsigTrabajoModel.objects.filter(pk__in=cargos_ids).select_related('denominacioncargoid')
        for asig in qs_cargos:
            cod = asig.codigo
            denom = asig.denominacioncargoid.cargo if asig.denominacioncargoid else None
            cargos[asig.pk] = (cod, denom)

    empleados = {}
    if cedulas:
        for emp in EmployeeModel.objects.filter(cedulaidentidad__in=cedulas):
            empleados[emp.cedulaidentidad] = f"{emp.nombres} {emp.apellidos}".strip()

    dependencias = {}
    if deps_ids:
        for dep in DependenciaModel.objects.filter(pk__in=deps_ids):
            dependencias[dep.pk] = dep.dependencia

    motivos = {}
    if motivos_ids:
        for mot in TipoMovimientoModel.objects.filter(pk__in=motivos_ids):
            motivos[mot.pk] = mot.movimiento

    oficinas = {}
    if oficinas_ids:
        for ofi in DireccionGeneralModel.objects.filter(pk__in=oficinas_ids):
            oficinas[ofi.pk] = ofi.direccion_general

    divisiones = {}
    if divisiones_ids:
        for div in DireccionLineaModel.objects.filter(pk__in=divisiones_ids):
            divisiones[div.pk] = div.direccion_linea

    return {
        'cargos': cargos,
        'empleados': empleados,
        'dependencias': dependencias,
        'motivos': motivos,
        'oficinas': oficinas,
        'divisiones': divisiones,
    }


def a_entidad(modelo, contexto: dict[str, dict] | None = None) -> PuntoCuenta:
    if contexto is None:
        contexto = construir_contexto_precarga([modelo])

    cargos_map = contexto.get('cargos', {})
    empleados_map = contexto.get('empleados', {})
    deps_map = contexto.get('dependencias', {})
    motivos_map = contexto.get('motivos', {})
    oficinas_map = contexto.get('oficinas', {})
    divisiones_map = contexto.get('divisiones', {})

    cargo_id = getattr(modelo, 'cargo_id', None)
    if cargo_id:
        if cargo_id in cargos_map:
            cargo_cod, cargo_nom = cargos_map[cargo_id]
        else:
            cargo_cod, cargo_nom = str(cargo_id), None
    else:
        cargo_cod, cargo_nom = None, None

    cedula = getattr(modelo, 'empleado_cedula', None)
    empleado_nom = empleados_map.get(cedula) if cedula else None

    dep_orig_id = getattr(modelo, 'dependencia_origen_id', None)
    dep_dest_id = getattr(modelo, 'dependencia_destino_id', None)
    dep_orig_nom = deps_map.get(dep_orig_id) if dep_orig_id else None
    dep_dest_nom = deps_map.get(dep_dest_id) if dep_dest_id else None

    motivo_id = getattr(modelo, 'motivo_id', None)
    motivo_nom = motivos_map.get(motivo_id) if motivo_id else None

    ofi_orig_id = getattr(modelo, 'oficina_origen_id', None)
    ofi_dest_id = getattr(modelo, 'oficina_destino_id', None)
    ofi_orig_nom = oficinas_map.get(ofi_orig_id) if ofi_orig_id else None
    ofi_dest_nom = oficinas_map.get(ofi_dest_id) if ofi_dest_id else None

    div_orig_id = getattr(modelo, 'division_origen_id', None)
    div_dest_id = getattr(modelo, 'division_destino_id', None)
    div_orig_nom = divisiones_map.get(div_orig_id) if div_orig_id else None
    div_dest_nom = divisiones_map.get(div_dest_id) if div_dest_id else None

    return PuntoCuenta(
        id=str(modelo.pk),
        cargo_id=cargo_id,
        empleado_cedula=cedula,
        empleado_nombre=empleado_nom,
        dependencia_origen_id=dep_orig_id,
        dependencia_origen_nombre=dep_orig_nom,
        dependencia_destino_id=dep_dest_id,
        dependencia_destino_nombre=dep_dest_nom,
        motivo_id=motivo_id,
        motivo_nombre=motivo_nom,
        usuario_id=getattr(modelo, 'usuario_id', None),
        fecha=modelo.fecha.isoformat(),
        documento_pdf_clave=getattr(modelo, 'documento_pdf_clave', None),
        oficina_origen_id=ofi_orig_id,
        oficina_origen_nombre=ofi_orig_nom,
        oficina_destino_id=ofi_dest_id,
        oficina_destino_nombre=ofi_dest_nom,
        division_origen_id=div_orig_id,
        division_origen_nombre=div_orig_nom,
        division_destino_id=div_dest_id,
        division_destino_nombre=div_dest_nom,
        numero=getattr(modelo, 'numero', None),
        anio=getattr(modelo, 'anio', None),
        secuencia=getattr(modelo, 'secuencia', None),
        cargo_codigo=cargo_cod,
        cargo_nombre=cargo_nom,
        configuracion_version=getattr(modelo, 'configuracion_version', None),
        snapshot_formato=getattr(modelo, 'snapshot_formato', None),
    )


def a_entidades(modelos: Iterable[Any]) -> list[PuntoCuenta]:
    """Mapea una colección de PuntoCuentaModel a entidades PuntoCuenta resolviendo referencias en lote."""
    modelos_lista = list(modelos)
    if not modelos_lista:
        return []
    contexto = construir_contexto_precarga(modelos_lista)
    return [a_entidad(m, contexto) for m in modelos_lista]
