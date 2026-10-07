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
        fecha_egreso=p.fecha_egreso,
        resolucion=p.resolucion,
        observaciones=p.observaciones,
        datos_vivienda=p.datos_vivienda,
        perfil_salud=p.perfil_salud,
        perfil_fisico=p.perfil_fisico,
        formacion_academica=p.formacion_academica,
        formacion_complementaria=p.formacion_complementaria,
        contacto_emergencia=p.contacto_emergencia,
        antecedentes=p.antecedentes,
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
