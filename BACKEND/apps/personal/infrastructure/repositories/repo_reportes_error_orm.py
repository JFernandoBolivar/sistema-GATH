"""
Repositorio ORM para Reportes de Error en Datos Laborales (D-09 / B21).
"""
from uuid import UUID

from django.db.models import Q

from apps.personal.domain.entities.reporte_error import (
    DatoLaboralReportado,
    EstadoReporteError,
    ReporteErrorDatoLaboral,
)
from apps.personal.infrastructure.models.reporte_error_models import ReporteErrorDatoLaboralModel


def _a_entidad(m: ReporteErrorDatoLaboralModel) -> ReporteErrorDatoLaboral:
    return ReporteErrorDatoLaboral(
        id=m.id,
        trabajador_cedula=m.trabajador_cedula,
        trabajador_nombre=m.trabajador_nombre,
        dato=DatoLaboralReportado(m.dato),
        descripcion=m.descripcion,
        estado=EstadoReporteError(m.estado),
        creado_el=m.created_at,
        actualizado_el=m.updated_at,
        atendido_por_id=m.atendido_por_id,
        atendido_por_cedula=m.atendido_por_cedula,
        atendido_por_nombre=m.atendido_por_nombre,
        atendido_el=m.atendido_el,
        observacion_atencion=m.observacion_atencion,
    )


class RepoReportesErrorLaboralORM:
    def guardar(self, reporte: ReporteErrorDatoLaboral) -> ReporteErrorDatoLaboral:
        obj, _ = ReporteErrorDatoLaboralModel.objects.update_or_create(
            id=reporte.id,
            defaults={
                'trabajador_cedula': reporte.trabajador_cedula,
                'trabajador_nombre': reporte.trabajador_nombre,
                'dato': reporte.dato.value,
                'descripcion': reporte.descripcion,
                'estado': reporte.estado.value,
                'atendido_por_id': reporte.atendido_por_id,
                'atendido_por_cedula': reporte.atendido_por_cedula,
                'atendido_por_nombre': reporte.atendido_por_nombre,
                'atendido_el': reporte.atendido_el,
                'observacion_atencion': reporte.observacion_atencion,
            },
        )
        return _a_entidad(obj)

    def obtener_por_id(self, reporte_id: UUID) -> ReporteErrorDatoLaboral | None:
        try:
            m = ReporteErrorDatoLaboralModel.objects.get(id=reporte_id)
            return _a_entidad(m)
        except ReporteErrorDatoLaboralModel.DoesNotExist:
            return None

    def listar(
        self,
        *,
        trabajador_cedula: str | None = None,
        estado: str | None = None,
        dato: str | None = None,
        texto_busqueda: str | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> tuple[list[ReporteErrorDatoLaboral], int]:
        qs = ReporteErrorDatoLaboralModel.objects.all()

        if trabajador_cedula:
            qs = qs.filter(trabajador_cedula=trabajador_cedula.strip())

        if estado:
            qs = qs.filter(estado=estado.strip().upper())

        if dato:
            qs = qs.filter(dato=dato.strip().lower())

        if texto_busqueda:
            texto = texto_busqueda.strip()
            qs = qs.filter(
                Q(trabajador_cedula__icontains=texto)
                | Q(trabajador_nombre__icontains=texto)
                | Q(descripcion__icontains=texto)
            )

        total = qs.count()
        registros = qs[desplazamiento : desplazamiento + limite]
        return [_a_entidad(m) for m in registros], total
