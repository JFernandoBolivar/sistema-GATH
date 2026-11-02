"""Mappers ORM <-> entidades de fe de vida."""
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida, ProrrogaProceso
from apps.fe_de_vida.domain.entities.solicitud import DecisionFeDeVida, SolicitudFeDeVida
from apps.fe_de_vida.domain.value_objects.estados import (
    EstadoProceso,
    EstadoSolicitud,
    OrigenEvidencia,
    RolRevision,
    TipoDecision,
    ViaAprobacion,
)


def proceso_a_entidad(m) -> ProcesoFeDeVida:
    return ProcesoFeDeVida(
        id=str(m.pk), nombre=m.nombre, fecha_apertura=m.fecha_apertura, fecha_cierre=m.fecha_cierre,
        estado=EstadoProceso(m.estado), creado_por=m.creado_por, abierto_por=m.abierto_por,
        cerrado_por=m.cerrado_por, fecha_cierre_real=m.fecha_cierre_real,
        tipos_nomina=tuple(m.tipos_nomina or ()), dias_recordatorio=tuple(m.dias_recordatorio or ()),
    )


def prorroga_a_entidad(m) -> ProrrogaProceso:
    return ProrrogaProceso(
        id=str(m.pk), proceso_id=str(m.proceso_id), nueva_fecha_limite=m.nueva_fecha_limite, motivo=m.motivo,
        concedida_por=m.concedida_por, cedula=m.cedula, fecha=m.created_at,
    )


def decision_a_entidad(m) -> DecisionFeDeVida:
    return DecisionFeDeVida(
        tipo=TipoDecision(m.tipo), rol=RolRevision(m.rol), actor_cedula=m.actor_cedula, envio=m.envio,
        fecha=m.fecha, motivo=m.motivo,
    )


def solicitud_a_entidad(m) -> SolicitudFeDeVida:
    return SolicitudFeDeVida(
        id=str(m.pk), proceso_id=str(m.proceso_id), cedula=m.cedula, estado=EstadoSolicitud(m.estado),
        version=m.version, envios=m.envios,
        origen_evidencia=OrigenEvidencia(m.origen_evidencia) if m.origen_evidencia else None,
        evidencia_clave=m.evidencia_clave, evidencia_sha256=m.evidencia_sha256, evidencia_mime=m.evidencia_mime,
        evidencia_tamano=m.evidencia_tamano, metadatos_captura=dict(m.metadatos_captura or {}),
        evidencias_previas=tuple(m.evidencias_previas or ()),
        via_aprobacion=ViaAprobacion(m.via_aprobacion) if m.via_aprobacion else None,
        decisiones=tuple(decision_a_entidad(d) for d in m.decisiones.all().order_by('fecha', 'created_at')),
        fecha_envio=m.fecha_envio, fecha_validacion=m.fecha_validacion, requiere_nueva_foto=m.requiere_nueva_foto,
    )


def campos_solicitud(s: SolicitudFeDeVida) -> dict:
    return {
        'estado': s.estado.value, 'envios': s.envios,
        'origen_evidencia': s.origen_evidencia.value if s.origen_evidencia else '',
        'evidencia_clave': s.evidencia_clave, 'evidencia_sha256': s.evidencia_sha256,
        'evidencia_mime': s.evidencia_mime, 'evidencia_tamano': s.evidencia_tamano,
        'metadatos_captura': s.metadatos_captura, 'evidencias_previas': list(s.evidencias_previas),
        'via_aprobacion': s.via_aprobacion.value if s.via_aprobacion else '',
        'fecha_envio': s.fecha_envio, 'fecha_validacion': s.fecha_validacion,
        'requiere_nueva_foto': s.requiere_nueva_foto,
    }
