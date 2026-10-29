from apps.notificaciones.domain.entities.notificacion import Notificacion
from apps.notificaciones.infrastructure.mappers.mapper_notificaciones import notificacion_a_entidad
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel


def _por_id(cedula: str, notificacion_id: str):
    """Filtra SIEMPRE por destinatario (Zero-IDOR). Un id mal formado equivale a inexistente."""
    qs = NotificacionModel.objects.filter(destinatario_cedula=cedula)
    try:
        return qs.filter(pk=notificacion_id)
    except (ValueError, TypeError):
        return qs.none()


class RepoNotificacionesORM:
    def crear_muchas(self, notificaciones: list[Notificacion]) -> int:
        if not notificaciones:
            return 0
        con_clave = [n for n in notificaciones if n.clave_unica]
        existentes = set()
        if con_clave:
            existentes = set(NotificacionModel.objects.filter(
                destinatario_cedula__in=[n.destinatario_cedula for n in con_clave],
                clave_unica__in={n.clave_unica for n in con_clave},
            ).values_list('destinatario_cedula', 'clave_unica'))
        nuevas = [
            NotificacionModel(
                destinatario_cedula=n.destinatario_cedula, tipo=n.tipo, titulo=n.titulo, mensaje=n.mensaje,
                enlace=n.enlace, ref_tipo=n.ref_tipo, ref_id=n.ref_id, clave_unica=n.clave_unica or None,
            )
            for n in notificaciones
            if (n.destinatario_cedula, n.clave_unica) not in existentes
        ]
        # ignore_conflicts cubre la carrera entre dos transacciones concurrentes con la misma clave.
        NotificacionModel.objects.bulk_create(nuevas, ignore_conflicts=True)
        return len(nuevas)

    def listar(self, cedula, solo_no_leidas, limite, desplazamiento):
        qs = NotificacionModel.objects.filter(destinatario_cedula=cedula)
        if solo_no_leidas:
            qs = qs.filter(leida=False)
        total = qs.count()
        return [notificacion_a_entidad(m) for m in qs.order_by('-created_at', '-id')[desplazamiento:desplazamiento + limite]], total

    def contar_no_leidas(self, cedula: str) -> int:
        return NotificacionModel.objects.filter(destinatario_cedula=cedula, leida=False).count()

    def marcar_leida(self, cedula, notificacion_id, ahora) -> bool:
        qs = _por_id(cedula, notificacion_id)
        if not qs.exists():
            return False
        qs.filter(leida=False).update(leida=True, fecha_lectura=ahora)
        return True

    def marcar_todas_leidas(self, cedula, ahora) -> int:
        return NotificacionModel.objects.filter(destinatario_cedula=cedula, leida=False).update(
            leida=True, fecha_lectura=ahora,
        )
