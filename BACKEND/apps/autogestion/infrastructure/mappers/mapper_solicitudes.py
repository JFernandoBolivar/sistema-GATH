"""
Mappers ORM <-> entidades de la solicitud de actualización.
"""
from apps.autogestion.domain.entities.solicitud_actualizacion import (
    CambioPropuesto,
    DatosComplementarios,
    ProrrogaVentana,
    SeccionAutogestionable,
    SoporteDocumental,
    SolicitudActualizacion,
)
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from apps.autogestion.domain.value_objects.secciones import DecisionCambio


def solicitud_a_entidad(m) -> SolicitudActualizacion:
    return SolicitudActualizacion(
        id=str(m.id), cedula=m.cedula, estado=EstadoSolicitud(m.estado),
        secciones_solicitadas=tuple(m.secciones_solicitadas or ()), motivo=m.motivo,
        secciones_habilitadas=tuple(m.secciones_habilitadas or ()),
        ventana_inicio=m.ventana_inicio, ventana_fin=m.ventana_fin, plazo_dias=m.plazo_dias,
        habilitada_por=m.habilitada_por, decidida_por=m.decidida_por, motivo_decision=m.motivo_decision,
        version=m.version, fecha_solicitud=m.created_at, fecha_envio=m.fecha_envio, fecha_decision=m.fecha_decision,
    )


def campos_de_solicitud(s: SolicitudActualizacion) -> dict:
    return {
        'estado': s.estado.value, 'secciones_solicitadas': list(s.secciones_solicitadas),
        'secciones_habilitadas': list(s.secciones_habilitadas), 'motivo': s.motivo,
        'ventana_inicio': s.ventana_inicio, 'ventana_fin': s.ventana_fin, 'plazo_dias': s.plazo_dias,
        'habilitada_por': s.habilitada_por, 'decidida_por': s.decidida_por,
        'motivo_decision': s.motivo_decision, 'fecha_envio': s.fecha_envio, 'fecha_decision': s.fecha_decision,
    }


def prorroga_a_entidad(m) -> ProrrogaVentana:
    return ProrrogaVentana(
        id=str(m.id), solicitud_id=str(m.solicitud_id), fecha_fin_anterior=m.fecha_fin_anterior,
        fecha_fin_nueva=m.fecha_fin_nueva, motivo=m.motivo, prorrogada_por=m.prorrogada_por, fecha=m.fecha,
    )


def cambio_a_entidad(m) -> CambioPropuesto:
    return CambioPropuesto(
        id=str(m.id), origen_tipo=m.origen_tipo, origen_id=str(m.origen_id), seccion=m.seccion, accion=m.accion,
        entidad_destino=m.entidad_destino, entidad_id=m.entidad_id, campo=m.campo,
        valor_anterior=m.valor_anterior, valor_propuesto=m.valor_propuesto,
        decision=DecisionCambio(m.decision), motivo_decision=m.motivo_decision, decidido_por=m.decidido_por,
        fecha_decision=m.fecha_decision,
    )


def soporte_a_entidad(m) -> SoporteDocumental:
    return SoporteDocumental(
        id=str(m.id), origen_tipo=m.origen_tipo, origen_id=str(m.origen_id), seccion=m.seccion, tipo=m.tipo,
        clave_s3=m.clave_s3, mime_real=m.mime_real, tamano_bytes=m.tamano_bytes, sha256=m.sha256,
        nombre_original=m.nombre_original, subido_por=m.subido_por, fecha=m.created_at,
    )


def seccion_a_entidad(m) -> SeccionAutogestionable:
    return SeccionAutogestionable(codigo=m.codigo, nombre=m.nombre, requiere_soporte=m.requiere_soporte, activa=m.activa)


def complementarios_a_entidad(m) -> DatosComplementarios:
    return DatosComplementarios(
        cedula=m.cedula, correo_alternativo=m.correo_alternativo, tiene_hijos=m.tiene_hijos,
        actualizado_en=m.actualizado_en, actualizado_por=m.actualizado_por,
    )
