from django.db.models import Count, Max, Q, Value
from django.db.models.functions import Coalesce

from apps.notificaciones.domain.entities.notificacion import Notificacion
from apps.notificaciones.domain.ports.repo_notificaciones import EstadoBandeja, FiltroNotificaciones
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
                enlace=n.enlace, ref_tipo=n.ref_tipo, ref_id=n.ref_id, clave_unica=n.clave_unica or None, modulo=n.modulo, grupo=n.grupo,
            )
            for n in notificaciones
            if (n.destinatario_cedula, n.clave_unica) not in existentes
        ]
        # ignore_conflicts cubre la carrera entre dos transacciones concurrentes con la misma clave.
        NotificacionModel.objects.bulk_create(nuevas, ignore_conflicts=True)
        return len(nuevas)

    def listar(self, cedula, filtro: FiltroNotificaciones, limite, desplazamiento):
        qs = NotificacionModel.objects.filter(destinatario_cedula=cedula)
        if filtro.modulo:
            qs = qs.filter(modulo=filtro.modulo)
        if filtro.leida is not None:
            qs = qs.filter(leida=filtro.leida)
        if filtro.tipo:
            qs = qs.filter(tipo=filtro.tipo)
        if filtro.q:
            qs = qs.filter(Q(titulo__icontains=filtro.q) | Q(mensaje__icontains=filtro.q))
        if filtro.desde:
            qs = qs.filter(created_at__date__gte=filtro.desde)
        if filtro.hasta:
            qs = qs.filter(created_at__date__lte=filtro.hasta)
        total = qs.count()
        return [notificacion_a_entidad(m) for m in qs.order_by('-created_at', '-id')[desplazamiento:desplazamiento + limite]], total

    def contar_no_leidas(self, cedula: str, modulo: str | None = None) -> int:
        qs = NotificacionModel.objects.filter(destinatario_cedula=cedula, leida=False)
        if modulo:
            qs = qs.filter(modulo=modulo)
        return qs.count()

    def estado(self, cedula: str) -> EstadoBandeja:
        agg = NotificacionModel.objects.filter(destinatario_cedula=cedula).aggregate(
            total=Count('pk'), no_leidas=Count('pk', filter=Q(leida=False)),
            creada=Max('created_at'), lectura=Max('fecha_lectura'), atendida=Max('fecha_atendida'),
        )
        marcas = [m for m in (agg['creada'], agg['lectura'], agg['atendida']) if m is not None]
        return EstadoBandeja(no_leidas=agg['no_leidas'], total=agg['total'], ultima_actualizacion=max(marcas) if marcas else None)

    def marcar_leida(self, cedula, notificacion_id, ahora) -> bool:
        qs = _por_id(cedula, notificacion_id)
        if not qs.exists():
            return False
        qs.filter(leida=False).update(leida=True, fecha_lectura=ahora)
        return True

    def resolver_avisos(self, ref_tipo, ref_id, tipo, por_cedula, por_nombre, ahora) -> list[str]:
        pendientes = NotificacionModel.objects.filter(ref_tipo=ref_tipo, ref_id=ref_id, atendida=False)
        if tipo:
            pendientes = pendientes.filter(tipo=tipo)
        else:
            # Sin tipo, solo los avisos enviados a varias cuentas (bandeja compartida). Un aviso
            # personal del mismo caso (p. ej. «su solicitud fue recibida» al trabajador) no debe
            # quedar «atendido por» el analista que actuó.
            pendientes = pendientes.exclude(grupo='')
        filas = list(pendientes.values_list('pk', 'destinatario_cedula'))
        if not filas:
            return []
        NotificacionModel.objects.filter(pk__in=[pk for pk, _ in filas], atendida=False).update(
            atendida=True, atendida_por_cedula=por_cedula, atendida_por_nombre=por_nombre, fecha_atendida=ahora,
            leida=True, fecha_lectura=Coalesce('fecha_lectura', Value(ahora)),
        )
        return [c for _, c in filas]

    def marcar_todas_leidas(self, cedula, modulo: str | None, ahora) -> int:
        qs = NotificacionModel.objects.filter(destinatario_cedula=cedula, leida=False)
        if modulo:
            qs = qs.filter(modulo=modulo)
        return qs.update(leida=True, fecha_lectura=ahora)
