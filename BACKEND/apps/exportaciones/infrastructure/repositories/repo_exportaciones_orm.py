"""Repositorio ORM de los trabajos de exportación."""
from datetime import datetime

from apps.exportaciones.domain.entities.trabajo_exportacion import (
    ESTADOS_ACTIVOS,
    EstadoExportacion,
    TrabajoExportacion,
)
from apps.exportaciones.infrastructure.models.trabajo_exportacion_model import (
    TrabajoExportacionModel,
)


def _a_entidad(fila: TrabajoExportacionModel) -> TrabajoExportacion:
    return TrabajoExportacion(
        id=str(fila.id),
        solicitante_id=fila.solicitante_id,
        solicitante_cedula=fila.solicitante_cedula,
        tipo=fila.tipo,
        formato=fila.formato,
        estado=EstadoExportacion(fila.estado),
        progreso=fila.progreso,
        parametros=fila.parametros or {},
        creado_en=fila.created_at,
        expira_en=fila.expira_en,
        nombre_archivo=fila.nombre_archivo,
        clave_archivo=fila.clave_archivo,
        tamano_bytes=fila.tamano_bytes,
        metadatos=fila.metadatos or {},
        error=fila.error,
        task_id=fila.task_id,
        finalizado_en=fila.finalizado_en,
    )


class RepoExportacionesORM:
    def crear(self, trabajo: TrabajoExportacion) -> TrabajoExportacion:
        fila = TrabajoExportacionModel.objects.create(
            id=trabajo.id,
            solicitante_id=trabajo.solicitante_id,
            solicitante_cedula=trabajo.solicitante_cedula,
            tipo=trabajo.tipo,
            formato=trabajo.formato,
            estado=trabajo.estado.value,
            progreso=trabajo.progreso,
            parametros=trabajo.parametros,
            expira_en=trabajo.expira_en,
        )
        return _a_entidad(fila)

    def obtener(self, trabajo_id: str) -> TrabajoExportacion | None:
        try:
            fila = TrabajoExportacionModel.objects.filter(pk=trabajo_id).first()
        except (ValueError, TypeError):
            return None
        return _a_entidad(fila) if fila else None

    def contar_activos_de(self, solicitante_id: int | None) -> int:
        return TrabajoExportacionModel.objects.filter(
            solicitante_id=solicitante_id,
            estado__in=[e.value for e in ESTADOS_ACTIVOS],
        ).count()

    def guardar_task_id(self, trabajo_id: str, task_id: str) -> None:
        TrabajoExportacionModel.objects.filter(pk=trabajo_id).update(task_id=task_id)

    def marcar_en_proceso(self, trabajo_id: str, ahora: datetime) -> bool:
        actualizados = TrabajoExportacionModel.objects.filter(
            pk=trabajo_id,
            estado__in=[e.value for e in ESTADOS_ACTIVOS],
        ).update(estado=EstadoExportacion.EN_PROCESO.value, error='')
        return actualizados > 0

    def actualizar_progreso(self, trabajo_id: str, progreso: int) -> None:
        TrabajoExportacionModel.objects.filter(
            pk=trabajo_id, estado=EstadoExportacion.EN_PROCESO.value,
        ).update(progreso=max(0, min(int(progreso), 100)))

    def marcar_listo(
        self, trabajo_id: str, *, clave_archivo: str, nombre_archivo: str,
        tamano_bytes: int, metadatos: dict, ahora: datetime,
    ) -> None:
        TrabajoExportacionModel.objects.filter(pk=trabajo_id).update(
            estado=EstadoExportacion.LISTO.value,
            progreso=100,
            clave_archivo=clave_archivo,
            nombre_archivo=nombre_archivo,
            tamano_bytes=tamano_bytes,
            metadatos=metadatos,
            finalizado_en=ahora,
            error='',
        )

    def marcar_error(self, trabajo_id: str, mensaje: str, ahora: datetime) -> None:
        TrabajoExportacionModel.objects.filter(pk=trabajo_id).update(
            estado=EstadoExportacion.ERROR.value,
            error=mensaje[:300],
            finalizado_en=ahora,
        )

    def listar_vencidos(self, ahora: datetime, limite: int) -> list[TrabajoExportacion]:
        filas = TrabajoExportacionModel.objects.filter(
            estado=EstadoExportacion.LISTO.value, expira_en__lte=ahora,
        ).order_by('expira_en')[:limite]
        return [_a_entidad(f) for f in filas]

    def marcar_expirado(self, trabajo_id: str) -> None:
        TrabajoExportacionModel.objects.filter(pk=trabajo_id).update(
            estado=EstadoExportacion.EXPIRADO.value, clave_archivo='',
        )

    def eliminar_antiguos(self, antes_de: datetime) -> int:
        borradas, _ = TrabajoExportacionModel.objects.filter(
            estado__in=[EstadoExportacion.ERROR.value, EstadoExportacion.EXPIRADO.value],
            created_at__lt=antes_de,
        ).delete()
        return borradas

    def marcar_atascados(self, creados_antes_de: datetime, ahora: datetime) -> int:
        return TrabajoExportacionModel.objects.filter(
            estado__in=[e.value for e in ESTADOS_ACTIVOS],
            created_at__lt=creados_antes_de,
        ).update(
            estado=EstadoExportacion.ERROR.value,
            error='La exportación excedió el tiempo máximo y fue cancelada.',
            finalizado_en=ahora,
        )
