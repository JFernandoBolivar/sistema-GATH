"""Repositorio ORM de procesos y prórrogas de fe de vida."""
from datetime import datetime

from django.db.models import Q

from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida, ProrrogaProceso
from apps.fe_de_vida.infrastructure.mappers.mapper_fe_de_vida import proceso_a_entidad, prorroga_a_entidad
from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel, ProrrogaProcesoModel
from core.domain.exceptions import ConflictError, NotFoundError


def _campos(p: ProcesoFeDeVida) -> dict:
    return {
        'nombre': p.nombre, 'fecha_apertura': p.fecha_apertura, 'fecha_cierre': p.fecha_cierre,
        'estado': p.estado.value, 'creado_por': p.creado_por, 'abierto_por': p.abierto_por,
        'cerrado_por': p.cerrado_por, 'fecha_cierre_real': p.fecha_cierre_real,
        'tipos_nomina': list(p.tipos_nomina), 'dias_recordatorio': list(p.dias_recordatorio),
    }


class RepoProcesosORM:
    def crear(self, proceso: ProcesoFeDeVida) -> ProcesoFeDeVida:
        return proceso_a_entidad(ProcesoFeDeVidaModel.objects.create(**_campos(proceso)))

    def obtener(self, proceso_id: str, bloquear: bool = False) -> ProcesoFeDeVida | None:
        qs = ProcesoFeDeVidaModel.objects.select_for_update() if bloquear else ProcesoFeDeVidaModel.objects
        try:
            m = qs.filter(pk=proceso_id).first()
        except (ValueError, TypeError):
            return None
        return proceso_a_entidad(m) if m else None

    def guardar(self, proceso: ProcesoFeDeVida) -> ProcesoFeDeVida:
        actualizadas = ProcesoFeDeVidaModel.objects.filter(pk=proceso.id).update(**_campos(proceso))
        if not actualizadas:
            raise NotFoundError("El proceso de fe de vida no existe.")
        return self.obtener(proceso.id)

    def listar(self, estado: str | None = None) -> list[ProcesoFeDeVida]:
        qs = ProcesoFeDeVidaModel.objects.all()
        if estado:
            qs = qs.filter(estado=estado)
        return [proceso_a_entidad(m) for m in qs]

    def listar_abiertos_vencidos(self, ahora: datetime) -> list[ProcesoFeDeVida]:
        qs = ProcesoFeDeVidaModel.objects.filter(estado=ProcesoFeDeVidaModel.Estado.ABIERTO, fecha_cierre__lt=ahora)
        return [proceso_a_entidad(m) for m in qs]

    def listar_con_prorroga_vigente(self, cedula: str, ahora: datetime) -> list[ProcesoFeDeVida]:
        vigentes = ProrrogaProcesoModel.objects.filter(
            Q(cedula='') | Q(cedula=cedula), nueva_fecha_limite__gte=ahora,
        ).values('proceso_id')
        qs = ProcesoFeDeVidaModel.objects.filter(pk__in=vigentes).exclude(estado=ProcesoFeDeVidaModel.Estado.BORRADOR)
        return [proceso_a_entidad(m) for m in qs]

    def agregar_prorroga(self, prorroga: ProrrogaProceso) -> ProrrogaProceso:
        if not ProcesoFeDeVidaModel.objects.filter(pk=prorroga.proceso_id).exists():
            raise ConflictError("El proceso de la prórroga no existe.")
        return prorroga_a_entidad(ProrrogaProcesoModel.objects.create(
            proceso_id=prorroga.proceso_id, cedula=prorroga.cedula, nueva_fecha_limite=prorroga.nueva_fecha_limite,
            motivo=prorroga.motivo, concedida_por=prorroga.concedida_por,
        ))

    def listar_prorrogas(self, proceso_id: str) -> list[ProrrogaProceso]:
        return [prorroga_a_entidad(m) for m in ProrrogaProcesoModel.objects.filter(proceso_id=proceso_id)]
