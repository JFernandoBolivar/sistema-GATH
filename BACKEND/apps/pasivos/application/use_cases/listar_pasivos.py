"""
Casos de uso para consultar jubilados y pensionados.
"""
from apps.pasivos.application.dtos.pasivos_dtos import PasivoDTO
from apps.pasivos.domain.entities.pasivo import Pasivo
from apps.pasivos.domain.ports.repo_pasivos import RepoPasivos


def pasivo_a_dto(p: Pasivo) -> PasivoDTO:
    return PasivoDTO(
        id=p.id,
        cedula=p.cedula,
        nombres=p.nombres,
        apellidos=p.apellidos,
        nombre_completo=p.nombre_completo,
        tipo_pasivo=p.tipo_pasivo,
        tipo_nomina_id=p.tipo_nomina_id,
        fecha_egreso=p.fecha_egreso,
        motivo_egreso_id=p.motivo_egreso_id,
        motivo_egreso=p.motivo_egreso,
        resolucion=p.resolucion,
        observaciones=p.observaciones,
        correo=p.correo,
        correo_alternativo=p.correo_alternativo,
        telefono_movil=p.telefono_movil,
        telefono_habitacion=p.telefono_habitacion,
        carnet_patria=p.carnet_patria,
        carnet_patria_serial=p.carnet_patria_serial,
        fecha_nacimiento=p.fecha_nacimiento,
        sexo_nombre=p.sexo_nombre,
        fecha_ingreso_organismo=p.fecha_ingreso_organismo,
        estado_civil_id=p.estado_civil_id,
        nacionalidad_id=p.nacionalidad_id,
        datos_vivienda=p.datos_vivienda,
        perfil_salud=p.perfil_salud,
        perfil_fisico=p.perfil_fisico,
        formacion_academica=p.formacion_academica,
        formacion_complementaria=p.formacion_complementaria,
        contacto_emergencia=p.contacto_emergencia,
        antecedentes=p.antecedentes,
        apn_antecedentes=p.apn_antecedentes,
        apn_en_curso=p.apn_en_curso,
        apn_total=p.apn_total,
        apn_incompleto=p.apn_incompleto,
        fecha_ingreso_apn=p.fecha_ingreso_apn,
        contrato_actual=p.contrato_actual,
        cargos_historial=p.cargos_historial,
        contratos=p.contratos,
        asignaciones=p.asignaciones,
        encargadurias=p.encargadurias,
    )


def listar_pasivos(
    repo: RepoPasivos, busqueda: str | None = None
) -> list[PasivoDTO]:
    entidades = repo.listar_pasivos(busqueda=busqueda)
    return [pasivo_a_dto(e) for e in entidades]


def listar_pasivos_paginados(
    repo: RepoPasivos,
    *,
    cedula: str | None = None,
    nombre: str | None = None,
    codigo: str | None = None,
    tipo_nomina_id: int | None = None,
    motivo_id: int | None = None,
    fecha_desde=None,
    fecha_hasta=None,
    sin_cuenta: bool | None = None,
    limite: int = 10,
    desplazamiento: int = 0,
):
    """Página de pasivos con filtros; devuelve DTOs y total."""
    entidades, total = repo.listar_pasivos_paginados(
        cedula=cedula,
        nombre=nombre,
        codigo=codigo,
        tipo_nomina_id=tipo_nomina_id,
        motivo_id=motivo_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        sin_cuenta=sin_cuenta,
        limite=limite,
        desplazamiento=desplazamiento,
    )
    return [pasivo_a_dto(e) for e in entidades], total
