"""Metadatos documentales del historial, sin acoplar presentación a documentos."""

from django.db.models import Q
from django.urls import reverse

from apps.documentos.infrastructure.models.documentos_models import DocumentoGeneradoModel
from apps.movimientos.domain.value_objects.proceso_movimiento import proceso_de_movimiento


class RepoDocumentosMovimientoORM:
    @staticmethod
    def para_movimientos(movimientos) -> dict[int, list[dict]]:
        """`{movimiento_id: [documentos]}` con una sola consulta para el historial.

        La asociación se guarda en el snapshot (`movimiento_id` y `proceso`), por
        lo que no requiere migraciones ni una FK nueva entre aplicaciones.
        """
        movimientos = list(movimientos)
        if not movimientos:
            return {}

        condiciones = Q()
        for movimiento in movimientos:
            condiciones |= Q(
                datos_snapshot__movimiento_id=movimiento.id,
                trabajador_cedula=movimiento.empleado_cedula,
            )
        documentos = (
            DocumentoGeneradoModel.objects.filter(condiciones, sujeto_tipo='trabajador')
            .select_related('plantilla', 'version')
            .order_by('created_at', 'id')
        )

        salida: dict[int, list[dict]] = {}
        for documento in documentos:
            snapshot = documento.datos_snapshot or {}
            try:
                movimiento_id = int(snapshot['movimiento_id'])
            except (KeyError, TypeError, ValueError):
                continue
            proceso = (
                snapshot.get('proceso')
                or getattr(documento, 'proceso', '')
                or getattr(documento.plantilla, 'proceso', '')
                or proceso_de_movimiento(snapshot.get('tipo_movimiento'))
                or ''
            )
            if not str(proceso).startswith('movimiento:'):
                continue
            nombre = getattr(documento, 'plantilla_nombre', '') or documento.plantilla.nombre
            salida.setdefault(movimiento_id, []).append({
                'id': str(documento.id),
                'nombre': nombre,
                'proceso': str(proceso),
                'version': documento.version.numero,
                'sha': documento.pdf_sha256,
                'fecha': documento.created_at.isoformat(),
                'url': reverse('documentos:generado_archivo', kwargs={'id': documento.id}),
                'detalle_url': reverse('documentos:generado', kwargs={'id': documento.id}),
            })
        return salida
