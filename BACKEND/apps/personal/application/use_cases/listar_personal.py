"""
Casos de uso para consultar la lista de empleados.
"""
from apps.personal.application.dtos.personal_dtos import EmpleadoDTO
from apps.personal.domain.entities.empleado import Empleado
from apps.personal.domain.ports.repo_personal import RepoPersonal


def _empleado_a_dto(e: Empleado) -> EmpleadoDTO:
    return EmpleadoDTO(
        id=e.id,
        cedula=e.cedula,
        nombres=e.nombres,
        apellidos=e.apellidos,
        nombre_completo=e.nombre_completo,
        sexo_id=e.sexo_id,
        sexo_nombre=e.sexo_nombre,
        correo=e.correo,
        telefono_movil=e.telefono_movil,
        telefono_habitacion=e.telefono_habitacion,
        fecha_nacimiento=e.fecha_nacimiento,
        estado_civil_id=e.estado_civil_id,
        estado_civil_nombre=e.estado_civil_nombre,
        carnet_patria=e.carnet_patria,
        total_anos_apn=e.total_anos_apn,
        datos_vivienda=e.datos_vivienda,
        perfil_salud=e.perfil_salud,
        perfil_fisico=e.perfil_fisico,
        formacion_academica=e.formacion_academica,
        formacion_complementaria=e.formacion_complementaria,
        contacto_emergencia=e.contacto_emergencia,
        antecedentes=e.antecedentes,
        contrato_actual=e.contrato_actual,
    )


def listar_personal(
    repo: RepoPersonal,
    busqueda: str | None = None,
    codigo: str | None = None,
    tipo_nomina: str | int | None = None,
) -> list[EmpleadoDTO]:
    entidades = repo.listar_empleados(
        busqueda=busqueda, codigo=codigo, tipo_nomina=tipo_nomina
    )
    return [_empleado_a_dto(e) for e in entidades]
