"""
Mappers de Pasivos.
"""
from apps.pasivos.domain.entities.pasivo import Pasivo
from apps.pasivos.infrastructure.models.pasivo_models import (
    CargoEgresadoModel,
    EmployeeEgresadoModel,
)


def cargo_egresado_a_dict(c: CargoEgresadoModel) -> dict:
    """
    Incluye tanto el `_id` crudo como el `_nombre` ya resuelto de cada
    catálogo (mismo patrón que `CargoAsignacionSerializer` de `apps.cargos`
    para los cargos activos): la UI de detalle de pasivo no debe resolver
    ~9 catálogos por su cuenta solo para mostrar el historial de cargos.
    """
    return {
        'codigo': c.codigo,
        'denominacioncargo_id': c.denominacioncargoid_id,
        'denominacioncargo_nombre': c.denominacioncargoid.cargo,
        'denominacioncargoespecifico_id': c.denominacioncargoespecificoid_id,
        'denominacioncargoespecifico_nombre': c.denominacioncargoespecificoid.cargo,
        'grado_id': c.gradoId_id,
        'grado_nombre': c.gradoId.grado if c.gradoId_id else None,
        'tipo_nomina_id': c.tipoNominaId_id,
        'tipo_nomina_nombre': c.tipoNominaId.nomina,
        'tipo_personal_id': c.tipoPersonalId_id,
        'tipo_personal_nombre': c.tipoPersonalId.tipo_personal,
        'dependencia_id': c.dependenciaId_id,
        'dependencia_nombre': c.dependenciaId.dependencia,
        'direccion_general_id': c.direccionGeneralId_id,
        'direccion_general_nombre': c.direccionGeneralId.direccion_general if c.direccionGeneralId_id else None,
        'direccion_linea_id': c.direccionLineaId_id,
        'direccion_linea_nombre': c.direccionLineaId.direccion_linea if c.direccionLineaId_id else None,
        'coordinacion_id': c.coordinacionId_id,
        'coordinacion_nombre': c.coordinacionId.coordinacion if c.coordinacionId_id else None,
        'organismo_adscrito_id': c.organismoAdscritoId_id,
        'organismo_adscrito_nombre': c.organismoAdscritoId.Organismoadscrito if c.organismoAdscritoId_id else None,
    }


def cargos_historial_de_egreso(egreso_id: int) -> list[dict]:
    qs = CargoEgresadoModel.objects.filter(egreso_id=egreso_id).select_related(
        'denominacioncargoid',
        'denominacioncargoespecificoid',
        'gradoId',
        'tipoNominaId',
        'tipoPersonalId',
        'dependenciaId',
        'direccionGeneralId',
        'direccionLineaId',
        'coordinacionId',
        'organismoAdscritoId',
    ).order_by('-pk')
    return [cargo_egresado_a_dict(c) for c in qs]


def _sexo_nombre(emp) -> str | None:
    if emp is None or not getattr(emp, 'sexoid_id', None):
        return None
    return getattr(getattr(emp, 'sexoid', None), 'sexo', None)


def _fecha_ingreso_organismo(modelo, expediente: dict | None = None) -> str | None:
    """Fecha de ingreso al organismo: anotada en el listado o derivada del expediente."""
    anotada = getattr(modelo, 'fecha_ingreso_organismo', None)
    if anotada:
        return str(anotada)
    fechas = [
        a.get('fecha_ingreso')
        for a in (expediente or {}).get('antecedentes', [])
        if a.get('fecha_ingreso')
    ]
    return min(fechas) if fechas else None


def pasivo_a_entidad(modelo: EmployeeEgresadoModel, expediente: dict | None = None) -> Pasivo:
    emp = modelo.employee
    nombres = emp.nombres if emp else ""
    apellidos = emp.apellidos if emp else ""
    cargos = cargos_historial_de_egreso(modelo.pk)
    # El tipo de pasivo debe ser el tipo de nómina (JUBILADO/PENSIONADO/…), no
    # el motivo del movimiento de egreso (ANULACIÓN, ABANDONO, etc.).
    tipo_nomina = cargos[0]['tipo_nomina_nombre'] if cargos else "PASIVO"
    tipo_nomina_id = cargos[0]['tipo_nomina_id'] if cargos else None
    return Pasivo(
        id=modelo.pk,
        cedula=str(modelo.employee_id),
        nombres=nombres,
        apellidos=apellidos,
        tipo_pasivo=str(tipo_nomina),
        tipo_nomina_id=tipo_nomina_id,
        fecha_egreso=str(modelo.fecha_egreso),
        resolucion=modelo.n_contrato,
        correo=emp.correo if emp else None,
        telefono_movil=emp.telefono_movil if emp else None,
        telefono_habitacion=emp.telefono_habitacion if emp else None,
        carnet_patria=emp.carnet_patria if emp else None,
        fecha_nacimiento=str(emp.fecha_nacimiento) if emp and emp.fecha_nacimiento else None,
        sexo_nombre=_sexo_nombre(emp),
        fecha_ingreso_organismo=_fecha_ingreso_organismo(modelo, expediente),
        estado_civil_id=emp.estadoCivil_id if emp else None,
        nacionalidad_id=emp.nacionalidad_id if emp else None,
        cargos_historial=cargos,
        **(expediente or {}),
    )


def pasivo_desde_asignacion(asignacion, expediente: dict | None = None) -> Pasivo:
    """
    Mapea un `AsigTrabajoModel` con `Tipo_personal=PASIVO` (Fase 2.1 del
    plan de reparación) — el criterio real del legado para "es un pasivo con
    nómina activa" (`list_employees_pasive`), distinto de un registro
    `EmployeeEgresadoModel` (egreso definitivo, ver `pasivo_a_entidad`).
    """
    emp = asignacion.employee
    return Pasivo(
        id=asignacion.pk,
        cedula=str(asignacion.employee_id),
        nombres=emp.nombres if emp else "",
        apellidos=emp.apellidos if emp else "",
        tipo_pasivo=asignacion.tiponominaid.nomina if asignacion.tiponominaid else "PASIVO",
        tipo_nomina_id=asignacion.tiponominaid_id,
        fecha_egreso=str(asignacion.fecha_actualizacion),
        resolucion=asignacion.codigo,
        observaciones=asignacion.observaciones,
        correo=emp.correo if emp else None,
        telefono_movil=emp.telefono_movil if emp else None,
        telefono_habitacion=emp.telefono_habitacion if emp else None,
        carnet_patria=emp.carnet_patria if emp else None,
        fecha_nacimiento=str(emp.fecha_nacimiento) if emp and emp.fecha_nacimiento else None,
        sexo_nombre=_sexo_nombre(emp),
        fecha_ingreso_organismo=_fecha_ingreso_organismo(asignacion, expediente),
        estado_civil_id=emp.estadoCivil_id if emp else None,
        nacionalidad_id=emp.nacionalidad_id if emp else None,
        **(expediente or {}),
    )
