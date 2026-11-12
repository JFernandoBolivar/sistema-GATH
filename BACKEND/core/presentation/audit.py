"""
Módulo de auditoría dual (B2.8, D-04, Contrato C-5).

Destino 1 — Base de Datos: inserta en `auditoria_log` (append-only).
Destino 2 — Archivo TXT: `logs/backend/audit_backend.txt` con rotación diaria,
compresión gzip y retención de 90 días, configurado en el dict `LOGGING` de
`GATH/settings.py` (B1.12). El logger 'audit_backend' emite la línea
estructurada con formato fijo de §I.4.7; el formatter añade el timestamp.
"""
import logging

from core.infrastructure.auditoria_contexto import obtener_origen
from core.infrastructure.models.auditoria import AuditoriaLog
from core.infrastructure.providers import obtener_resolutor_rol_actor
from core.presentation.ip_cliente import ip_del_cliente

logger = logging.getLogger('audit_backend')


def origen_de_peticion(request) -> dict:
    """IP, user-agent y dispositivo de la petición, listos para `registrar_auditoria(**...)`."""
    from core.domain.auditoria import dispositivo_de_user_agent

    user_agent = (request.META.get('HTTP_USER_AGENT') or '')[:255]
    return {
        'ip_origen': ip_del_cliente(request),
        'user_agent': user_agent,
        'dispositivo': dispositivo_de_user_agent(user_agent),
    }


def registrar_auditoria(
    *,
    trace_id: str,
    actor_id: int | None,
    accion: str,
    modulo: str,
    resultado: str = AuditoriaLog.Resultado.SUCCESS,
    actor_cedula: str = '',
    actor_rol: str = '',
    recurso_tipo: str = '',
    recurso_id: str = '',
    ip_origen: str | None = None,
    user_agent: str = '',
    dispositivo: str = '',
    estado_previo: dict | None = None,
    estado_nuevo: dict | None = None,
) -> AuditoriaLog:
    """Implementación concreta del puerto `AuditLogger` (`core/domain/ports.py`)."""
    # El middleware deja el origen de la petición en el ContextVar; solo se usa
    # para completar lo que el llamador no haya pasado (nunca lo sobrescribe).
    origen = obtener_origen()
    if not ip_origen:
        ip_origen = origen.get('ip_origen')
    if not user_agent:
        user_agent = origen.get('user_agent', '')
    if not dispositivo:
        dispositivo = origen.get('dispositivo', '')

    if not actor_rol and (actor_id is not None or actor_cedula):
        # Se resuelve ANTES de crear la fila: `actor_rol` entra en el hash de la
        # cadena, así que no se puede completar después. El lector lo aporta
        # `apps.identidad` al kernel (B16); sin lector se registra sin rol.
        lector = obtener_resolutor_rol_actor()
        if lector is not None:
            maximo = AuditoriaLog._meta.get_field('actor_rol').max_length or 50
            actor_rol = lector.rol_visible_de(
                actor_id=actor_id, actor_cedula=actor_cedula
            )[:maximo]
    registro = AuditoriaLog.objects.create(
        trace_id=trace_id,
        actor_id=actor_id,
        actor_cedula=actor_cedula,
        actor_rol=actor_rol,
        modulo=modulo,
        accion=accion,
        recurso_tipo=recurso_tipo,
        recurso_id=recurso_id,
        ip_origen=ip_origen,
        user_agent=(user_agent or '')[:255],
        dispositivo=dispositivo,
        estado_previo=estado_previo,
        estado_nuevo=estado_nuevo,
        resultado=resultado,
    )

    logger.info(
        '[TRACE:%s] [ACTOR:%s|%s] [IP:%s] [UA:%s] [ACTION:%s.%s] [TARGET:%s#%s] [STATUS:%s]',
        trace_id, actor_cedula or actor_id, actor_rol, ip_origen or '-', (user_agent or '-')[:120],
        modulo, accion, recurso_tipo, recurso_id, resultado,
    )
    return registro
