"""Repositorio ORM de solicitudes de fe de vida (una por pasivo y proceso)."""
from django.db import IntegrityError, transaction
from django.db.models import F

from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.infrastructure.mappers.mapper_fe_de_vida import campos_solicitud, solicitud_a_entidad
from apps.fe_de_vida.infrastructure.models.solicitud_models import DecisionFeDeVidaModel, SolicitudFeDeVidaModel
from core.domain.exceptions import ConflictError, NotFoundError


def _base():
    return SolicitudFeDeVidaModel.objects.prefetch_related('decisiones')


class RepoSolicitudesFeDeVidaORM:
    def crear(self, solicitud: SolicitudFeDeVida) -> SolicitudFeDeVida:
        try:
            with transaction.atomic():
                m = SolicitudFeDeVidaModel.objects.create(
                    proceso_id=solicitud.proceso_id, cedula=solicitud.cedula, **campos_solicitud(solicitud),
                )
        except IntegrityError:
            raise ConflictError("Ya existe una solicitud de fe de vida de esta persona en el proceso.") from None
        return solicitud_a_entidad(m)

    def obtener(self, solicitud_id: str, bloquear: bool = False) -> SolicitudFeDeVida | None:
        try:
            if bloquear:  # el lock no admite prefetch: se toma primero y se relee con las decisiones
                SolicitudFeDeVidaModel.objects.select_for_update().filter(pk=solicitud_id).first()
            m = _base().filter(pk=solicitud_id).first()
        except (ValueError, TypeError):
            return None
        return solicitud_a_entidad(m) if m else None

    def obtener_de(self, proceso_id: str, cedula: str, bloquear: bool = False) -> SolicitudFeDeVida | None:
        try:
            m = _base().filter(proceso_id=proceso_id, cedula=cedula).first()
        except (ValueError, TypeError):
            return None
        return self.obtener(str(m.pk), bloquear) if m and bloquear else (solicitud_a_entidad(m) if m else None)

    def guardar(self, solicitud: SolicitudFeDeVida, version_esperada: int) -> SolicitudFeDeVida:
        actualizadas = SolicitudFeDeVidaModel.objects.filter(pk=solicitud.id, version=version_esperada).update(
            version=F('version') + 1, **campos_solicitud(solicitud),
        )
        if not actualizadas:
            if not SolicitudFeDeVidaModel.objects.filter(pk=solicitud.id).exists():
                raise NotFoundError("La solicitud de fe de vida no existe.")
            raise ConflictError("La solicitud cambió mientras la revisaba: recargue e intente de nuevo.")
        ya_guardadas = DecisionFeDeVidaModel.objects.filter(solicitud_id=solicitud.id).count()
        DecisionFeDeVidaModel.objects.bulk_create([
            DecisionFeDeVidaModel(
                solicitud_id=solicitud.id, tipo=d.tipo.value, rol=d.rol.value, actor_cedula=d.actor_cedula,
                envio=d.envio, motivo=d.motivo, fecha=d.fecha,
            )
            for d in solicitud.decisiones[ya_guardadas:]
        ])
        return self.obtener(solicitud.id)

    def listar_de_cedula(self, cedula: str) -> list[SolicitudFeDeVida]:
        return [solicitud_a_entidad(m) for m in _base().filter(cedula=cedula).order_by('-proceso__fecha_apertura')]

    def listar_de_proceso(self, proceso_id: str, estados: tuple[str, ...] | None = None) -> list[SolicitudFeDeVida]:
        qs = _base().filter(proceso_id=proceso_id)
        if estados:
            qs = qs.filter(estado__in=estados)
        return [solicitud_a_entidad(m) for m in qs]

    def listar(self, proceso_id, estado, cedula, limite: int, desplazamiento: int):
        qs = _base().all()
        if proceso_id:
            qs = qs.filter(proceso_id=proceso_id)
        if estado:
            qs = qs.filter(estado=estado)
        if cedula:
            qs = qs.filter(cedula=cedula)
        total = qs.count()
        return [solicitud_a_entidad(m) for m in qs[desplazamiento:desplazamiento + limite]], total
