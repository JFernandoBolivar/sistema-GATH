"""
Mappers de Pasivos.
"""
from datetime import date
from types import SimpleNamespace

from apps.pasivos.domain.entities.pasivo import Pasivo
from apps.pasivos.infrastructure.models.pasivo_models import (
    CargoEgresadoModel,
    EmployeeEgresadoModel,
)
from apps.personal.shared.domain.services.tiempo_servicio import calcular_total_apn


def _a_fecha(valor) -> date | None:
    if valor in (None, ''):
        return None
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        return None


def _apn_desde_expediente(expediente: dict | None, fecha_egreso) -> dict:
    """Desglose APN del pasivo con la fórmula oficial, hasta su fecha de egreso."""
    antecedentes = [
        SimpleNamespace(
            fecha_ingreso=_a_fecha(a.get('fecha_ingreso')),
            fecha_egreso=_a_fecha(a.get('fecha_egreso')),
        )
        for a in (expediente or {}).get('antecedentes', [])
        if a
    ]
    contratos = (expediente or {}).get('contratos') or []
    respaldo = next(
        (
            _a_fecha(c.get('fecha_ingreso'))
            for c in contratos
            if c and c.get('fecha_ingreso')
        ),
        None,
    )
    corte = _a_fecha(fecha_egreso)
    return calcular_total_apn(
        antecedentes,
        fecha_corte=corte or date.today(),
        fecha_ingreso_en_curso=respaldo,
        fecha_egreso_en_curso=corte,
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
    apn = _apn_desde_expediente(expediente, modelo.fecha_egreso)
    motivo_nombre = modelo.motivo_egreso.movimiento if modelo.motivo_egreso else None
    fecha_egreso = str(modelo.fecha_egreso)[:10] if modelo.fecha_egreso else None
    return Pasivo(
        id=modelo.pk,
        cedula=str(modelo.employee_id),
        nombres=nombres,
        apellidos=apellidos,
        tipo_pasivo=str(tipo_nomina),
        tipo_nomina_id=tipo_nomina_id,
        fecha_egreso=fecha_egreso,
        motivo_egreso_id=getattr(modelo, 'motivo_egreso_id', None) or (
            getattr(modelo.motivo_egreso, 'pk', None) or getattr(modelo.motivo_egreso, 'id', None)
            if getattr(modelo, 'motivo_egreso', None)
            else None
        ),
        motivo_egreso=motivo_nombre,
        resolucion=modelo.n_contrato,
        correo=emp.correo if emp else None,
        telefono_movil=emp.telefono_movil if emp else None,
        telefono_habitacion=emp.telefono_habitacion if emp else None,
        carnet_patria=emp.carnet_patria if emp else None,
        carnet_patria_serial=emp.carnet_patria_serial if emp else None,
        fecha_nacimiento=str(emp.fecha_nacimiento) if emp and emp.fecha_nacimiento else None,
        sexo_nombre=_sexo_nombre(emp),
        fecha_ingreso_organismo=_fecha_ingreso_organismo(modelo, expediente),
        estado_civil_id=emp.estadoCivil_id if emp else None,
        nacionalidad_id=emp.nacionalidad_id if emp else None,
        cargos_historial=cargos,
        apn_antecedentes=apn.get('antecedentes'),
        apn_en_curso=apn.get('en_curso'),
        apn_total={'years': apn['years'], 'months': apn['months'], 'days': apn['days']},
        apn_incompleto=not apn.get('completo', True),
        fecha_ingreso_apn=(
            str(apn.get('inicio_curso')) if apn.get('inicio_curso') else None
        ),
        **(expediente or {}),
    )


def pasivo_desde_asignacion(asignacion, expediente: dict | None = None) -> Pasivo:
    """
    Mapea un `AsigTrabajoModel` con `Tipo_personal=PASIVO` (Fase 2.1 del
    plan de reparación) — el criterio real del legado para "es un pasivo con
    nómina activa" (`list_employees_pasive`), enriquecido con su fecha de vigencia
    y motivo si existe un registro `EmployeeEgresadoModel`.
    """
    emp = asignacion.employee
    apn = _apn_desde_expediente(expediente, asignacion.fecha_actualizacion)
    egreso = (
        EmployeeEgresadoModel.objects.select_related('motivo_egreso')
        .filter(employee_id=asignacion.employee_id)
        .order_by('-fecha_egreso')
        .first()
    )
    if egreso:
        fecha_egreso = str(egreso.fecha_egreso)[:10] if egreso.fecha_egreso else None
        motivo_egreso = egreso.motivo_egreso.movimiento if egreso.motivo_egreso else None
        motivo_egreso_id = egreso.motivo_egreso_id
    else:
        fecha_egreso = str(asignacion.fecha_actualizacion)[:10] if asignacion.fecha_actualizacion else None
        motivo_egreso = None
        motivo_egreso_id = None

    return Pasivo(
        id=asignacion.pk,
        cedula=str(asignacion.employee_id),
        nombres=emp.nombres if emp else "",
        apellidos=emp.apellidos if emp else "",
        tipo_pasivo=asignacion.tiponominaid.nomina if asignacion.tiponominaid else "PASIVO",
        tipo_nomina_id=asignacion.tiponominaid_id,
        fecha_egreso=fecha_egreso,
        motivo_egreso_id=motivo_egreso_id,
        motivo_egreso=motivo_egreso,
        resolucion=asignacion.codigo,
        observaciones=asignacion.observaciones,
        correo=emp.correo if emp else None,
        telefono_movil=emp.telefono_movil if emp else None,
        telefono_habitacion=emp.telefono_habitacion if emp else None,
        carnet_patria=emp.carnet_patria if emp else None,
        carnet_patria_serial=emp.carnet_patria_serial if emp else None,
        fecha_nacimiento=str(emp.fecha_nacimiento) if emp and emp.fecha_nacimiento else None,
        sexo_nombre=_sexo_nombre(emp),
        fecha_ingreso_organismo=_fecha_ingreso_organismo(asignacion, expediente),
        estado_civil_id=emp.estadoCivil_id if emp else None,
        nacionalidad_id=emp.nacionalidad_id if emp else None,
        apn_antecedentes=apn.get('antecedentes'),
        apn_en_curso=apn.get('en_curso'),
        apn_total={'years': apn['years'], 'months': apn['months'], 'days': apn['days']},
        apn_incompleto=not apn.get('completo', True),
        fecha_ingreso_apn=(
            str(apn.get('inicio_curso')) if apn.get('inicio_curso') else None
        ),
        **(expediente or {}),
    )
