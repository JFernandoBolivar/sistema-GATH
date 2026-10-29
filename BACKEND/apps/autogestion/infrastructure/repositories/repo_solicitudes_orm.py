"""
Repositorio ORM de solicitudes de actualización, prórrogas y reserva de secciones (D-09).
"""
from datetime import datetime

from django.db import IntegrityError, transaction

from apps.autogestion.domain.entities.solicitud_actualizacion import ProrrogaVentana, SolicitudActualizacion
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from apps.autogestion.infrastructure.mappers.mapper_solicitudes import (
    campos_de_solicitud,
    prorroga_a_entidad,
    solicitud_a_entidad,
)
from apps.autogestion.infrastructure.models.actualizacion_models import (
    ProrrogaVentanaModel,
    SeccionAbiertaModel,
    SolicitudActualizacionModel,
)
from core.domain.exceptions import ConflictError


class RepoSolicitudesORM:
    def crear(self, solicitud: SolicitudActualizacion) -> SolicitudActualizacion:
        try:
            with transaction.atomic():  # savepoint: un choque no envenena la transacción de la petición
                modelo = SolicitudActualizacionModel.objects.create(cedula=solicitud.cedula, **campos_de_solicitud(solicitud))
                SeccionAbiertaModel.objects.bulk_create([
                    SeccionAbiertaModel(solicitud=modelo, cedula=solicitud.cedula, seccion=s)
                    for s in solicitud.secciones_solicitadas
                ])
        except IntegrityError:
            raise ConflictError(
                "Ya existe una solicitud abierta para alguna de esas secciones. Espere su resolución."
            ) from None
        return solicitud_a_entidad(modelo)

    def obtener(self, solicitud_id: str, bloquear: bool = False) -> SolicitudActualizacion | None:
        qs = SolicitudActualizacionModel.objects
        if bloquear:
            qs = qs.select_for_update()
        try:
            fila = qs.filter(pk=solicitud_id).first()
        except (ValueError, TypeError):
            return None  # uuid mal formado
        return solicitud_a_entidad(fila) if fila else None

    def guardar(self, solicitud: SolicitudActualizacion, version_esperada: int) -> SolicitudActualizacion:
        actualizadas = SolicitudActualizacionModel.objects.filter(
            pk=solicitud.id, version=version_esperada,
        ).update(version=version_esperada + 1, **campos_de_solicitud(solicitud))
        if not actualizadas:
            raise ConflictError("La solicitud fue modificada por otra persona. Recargue e intente de nuevo.")
        return solicitud_a_entidad(SolicitudActualizacionModel.objects.get(pk=solicitud.id))

    def liberar_secciones(self, solicitud_id: str, secciones: tuple[str, ...] | None = None) -> None:
        qs = SeccionAbiertaModel.objects.filter(solicitud_id=solicitud_id)
        if secciones is not None:
            qs = qs.filter(seccion__in=secciones)
        qs.delete()

    def listar_de_cedula(self, cedula: str) -> list[SolicitudActualizacion]:
        return [solicitud_a_entidad(m) for m in SolicitudActualizacionModel.objects.filter(cedula=cedula)]

    def listar(self, estado, cedula, limite, desplazamiento):
        qs = SolicitudActualizacionModel.objects.all()
        if estado:
            qs = qs.filter(estado=estado)
        if cedula:
            qs = qs.filter(cedula=cedula)
        total = qs.count()
        return [solicitud_a_entidad(m) for m in qs[desplazamiento:desplazamiento + limite]], total

    def listar_habilitadas_vencidas(self, ahora: datetime) -> list[SolicitudActualizacion]:
        qs = SolicitudActualizacionModel.objects.filter(
            estado=EstadoSolicitud.HABILITADA.value, ventana_fin__lt=ahora,
        )
        return [solicitud_a_entidad(m) for m in qs]

    def listar_habilitadas_por_vencer(self, ahora: datetime, hasta: datetime) -> list[SolicitudActualizacion]:
        qs = SolicitudActualizacionModel.objects.filter(
            estado=EstadoSolicitud.HABILITADA.value, ventana_fin__gte=ahora, ventana_fin__lte=hasta,
        )
        return [solicitud_a_entidad(m) for m in qs]

    def agregar_prorroga(self, prorroga: ProrrogaVentana) -> ProrrogaVentana:
        m = ProrrogaVentanaModel.objects.create(
            solicitud_id=prorroga.solicitud_id, fecha_fin_anterior=prorroga.fecha_fin_anterior,
            fecha_fin_nueva=prorroga.fecha_fin_nueva, motivo=prorroga.motivo, prorrogada_por=prorroga.prorrogada_por,
        )
        return prorroga_a_entidad(m)

    def listar_prorrogas(self, solicitud_id: str) -> list[ProrrogaVentana]:
        return [prorroga_a_entidad(m) for m in ProrrogaVentanaModel.objects.filter(solicitud_id=solicitud_id)]

