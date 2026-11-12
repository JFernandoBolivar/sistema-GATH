"""
Adaptador del puerto `ResolutorRolActor` (B16).

La bitácora de auditoría necesita el nombre visible del rol del actor al
registrar. `core` declara el contrato y esta app (dueña de las cuentas y los
roles) aporta la implementación, que se registra en `AppConfig.ready()`.

Cualquier fallo se ignora: un problema al resolver el rol nunca debe tumbar la
acción auditada; se registra igual, sin rol.
"""
import logging

from core.domain.ports import ResolutorRolActor

logger = logging.getLogger('audit_backend')


class ResolutorRolActorORM(ResolutorRolActor):
    """Lee `USER_rol.nombre_visible` (o `nombre_rol`) de la cuenta del actor."""

    def rol_visible_de(self, *, actor_id: int | None, actor_cedula: str = '') -> str:
        try:
            from apps.identidad.infrastructure.models.cuenta_models import CuentaModel

            consulta = CuentaModel.objects.select_related('rol')
            fila = consulta.filter(pk=actor_id).first() if actor_id is not None else None
            if fila is None and actor_cedula:
                fila = consulta.filter(cedula_id=str(actor_cedula)).first()
            if fila is None or fila.rol is None:
                return ''
            return (fila.rol.nombre_visible or fila.rol.nombre_rol or '').strip()
        except Exception:  # noqa: BLE001 - la auditoría registra igual, sin rol
            logger.warning('auditoría: no se pudo resolver el rol del actor', exc_info=True)
            return ''
