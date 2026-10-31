"""
Casos de uso de consulta de la bitácora (D10). Puros: reciben el repositorio y
los filtros validados. El saneamiento de datos sensibles se aplica aquí, antes
de que cualquier detalle salga hacia la capa de presentación.
"""
from apps.auditoria.application.dtos.auditoria_dtos import (
    DetalleAuditoriaDTO,
    DocumentoAuditoriaDTO,
    IncidenteSeguridadDTO,
    PaginaAuditoriaDTO,
    RegistroAuditoriaDTO,
)
from apps.auditoria.domain.entities.registro import RegistroAuditoria
from apps.auditoria.domain.ports.repo_auditoria import RepoAuditoria
from apps.auditoria.domain.value_objects.filtros_auditoria import Paginacion
from core.domain.auditoria import diferencias, sanear_estado
from core.domain.exceptions import NotFoundError


def _resumen(registro: RegistroAuditoria) -> RegistroAuditoriaDTO:
    return RegistroAuditoriaDTO(
        id=registro.id,
        fecha_hora=registro.fecha_hora,
        actor_cedula=registro.actor_cedula,
        actor_nombre=registro.actor_nombre,
        actor_rol=registro.actor_rol,
        modulo=registro.modulo,
        accion=registro.accion,
        recurso_tipo=registro.recurso_tipo,
        recurso_id=registro.recurso_id,
        ip=registro.ip,
        user_agent=registro.user_agent,
        resultado=registro.resultado,
    )


def consultar_auditoria(repo: RepoAuditoria, filtros, paginacion: Paginacion) -> PaginaAuditoriaDTO:
    registros, total = repo.listar(filtros, paginacion.tamano, paginacion.offset)
    return PaginaAuditoriaDTO(
        resultados=[_resumen(r) for r in registros],
        total=total,
        pagina=paginacion.pagina,
        tamano=paginacion.tamano,
    )


def obtener_detalle(repo: RepoAuditoria, id: str) -> DetalleAuditoriaDTO:
    registro = repo.obtener(id)
    if registro is None:
        raise NotFoundError('El registro de auditoría no existe.')
    previo = sanear_estado(registro.estado_previo)
    nuevo = sanear_estado(registro.estado_nuevo)
    return DetalleAuditoriaDTO(
        **_resumen(registro).__dict__,
        estado_previo=previo,
        estado_nuevo=nuevo,
        # La comparación se hace sobre los valores reales para que un cambio de
        # contraseña/token cuente; la salida de `diferencias` ya viene enmascarada.
        diferencias=diferencias(registro.estado_previo, registro.estado_nuevo),
    )


def exportar_auditoria(repo: RepoAuditoria, filtros, limite: int) -> DocumentoAuditoriaDTO:
    registros, total = repo.listar(filtros, limite, 0)
    return DocumentoAuditoriaDTO(
        registros=[_resumen(r) for r in registros],
        filtros=filtros.como_etiquetas(),
        total_encontrados=total,
        limite=limite,
        truncado=bool(limite > 0 and total > limite),
    )


def consultar_incidentes(repo: RepoAuditoria, filtros, paginacion: Paginacion) -> dict:
    incidentes, total = repo.listar_incidentes(filtros, paginacion.tamano, paginacion.offset)
    return {
        'resultados': [
            IncidenteSeguridadDTO(
                id=i.id,
                fecha_hora=i.fecha_hora,
                cedula=i.cedula,
                nombre=i.nombre,
                ip=i.ip,
                resultado=i.resultado,
            )
            for i in incidentes
        ],
        'total': total,
        'pagina': paginacion.pagina,
        'tamano': paginacion.tamano,
        'total_paginas': max(1, -(-total // paginacion.tamano)),
    }
