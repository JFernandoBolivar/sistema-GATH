"""Implementación ORM del puerto `RepoPuntoCuenta` (Regla D-09)."""
from typing import Any
from django.db.models import Q

from apps.puntocuenta.infrastructure.mappers.mapper_punto_cuenta import a_entidad
from apps.puntocuenta.infrastructure.models.punto_cuenta_model import PuntoCuentaModel


class RepoPuntoCuentaORM:
    def crear(
        self,
        *,
        cargo_id: int,
        cedula: str,
        dependencia_origen_id: int | None,
        dependencia_destino_id: int | None,
        motivo_id: int | None,
        usuario_id: int | None,
        oficina_origen_id: int | None = None,
        oficina_destino_id: int | None = None,
        division_origen_id: int | None = None,
        division_destino_id: int | None = None,
        numero: str | None = None,
        anio: int | None = None,
        secuencia: int | None = None,
        configuracion_version: int | None = None,
        snapshot_formato: dict | None = None,
    ):
        fila = PuntoCuentaModel.objects.create(
            cargo_id=cargo_id,
            empleado_cedula=cedula,
            dependencia_origen_id=dependencia_origen_id,
            dependencia_destino_id=dependencia_destino_id,
            motivo_id=motivo_id,
            usuario_id=usuario_id,
            oficina_origen_id=oficina_origen_id,
            oficina_destino_id=oficina_destino_id,
            division_origen_id=division_origen_id,
            division_destino_id=division_destino_id,
            numero=numero,
            anio=anio,
            secuencia=secuencia,
            configuracion_version=configuracion_version,
            snapshot_formato=snapshot_formato,
        )
        return a_entidad(fila)

    def adjuntar_documento(self, id: Any, clave: str):
        fila = PuntoCuentaModel.objects.get(pk=id)
        fila.documento_pdf_clave = clave
        fila.save(update_fields=['documento_pdf_clave', 'updated_at'])
        return a_entidad(fila)

    def listar(self, filtros: dict | None = None):
        qs = PuntoCuentaModel.objects.all().order_by('-fecha')
        if not filtros:
            return [a_entidad(f) for f in qs]

        cedula = (filtros.get('cedula') or '').strip()
        if cedula:
            qs = qs.filter(empleado_cedula__icontains=cedula)

        oficina_id = filtros.get('oficina_id')
        if oficina_id:
            try:
                oficina_int = int(oficina_id)
                qs = qs.filter(Q(oficina_origen_id=oficina_int) | Q(oficina_destino_id=oficina_int))
            except (ValueError, TypeError):
                pass

        fecha_desde = filtros.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)

        fecha_hasta = filtros.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)

        return [a_entidad(f) for f in qs]

    def obtener_por_id(self, id: Any):
        fila = PuntoCuentaModel.objects.filter(pk=id).first()
        return a_entidad(fila) if fila else None
