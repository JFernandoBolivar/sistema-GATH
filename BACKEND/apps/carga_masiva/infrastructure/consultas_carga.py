"""
Adaptador ORM de las consultas de carga masiva (S5-01).

Reúne el acceso a datos que antes estaba en `presentation/views.py`: la carga
visible, el historial, el resumen con conteos por estado y las filas del
detalle. Las consultas son las mismas, en el mismo orden, para que las
respuestas de la API no cambien.
"""
from django.http import Http404
from django.shortcuts import get_object_or_404

from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel, CargaMasivaModel

MAX_FILAS_DETALLE = 500
MAX_CARGAS_HISTORIAL = 50


class CreadorCargaORM:
    """Implementa el puerto `CreadorCarga` (alta de la carga y marca de error)."""

    def crear(
        self, *, archivo_nombre: str, tamano_bytes: int, tipos: list[str], modo: str,
        poblacion: str, solicitada_por_cedula: str,
    ):
        return CargaMasivaModel.objects.create(
            archivo_nombre=archivo_nombre, tamano_bytes=tamano_bytes, tipos=tipos,
            modo=modo, poblacion=poblacion, solicitada_por_cedula=solicitada_por_cedula,
        )

    def marcar_error(self, carga) -> None:
        carga.estado = CargaMasivaModel.Estado.ERROR
        carga.save(update_fields=['estado'])


class ConsultorCargasORM:
    """Implementa el puerto `ConsultorCargas`."""

    def obtener_visible(self, carga_id: str, cedula: str, puede_aprobar: bool):
        cargas = CargaMasivaModel.objects.all()
        if not puede_aprobar:
            cargas = cargas.filter(solicitada_por_cedula=cedula)
        return get_object_or_404(cargas, pk=carga_id)

    def listar(
        self, cedula: str, puede_aprobar: bool, poblaciones: list[str],
        poblacion: str | None = None, estado: str | None = None,
    ) -> list:
        cargas = CargaMasivaModel.objects.all()
        if not puede_aprobar:
            cargas = cargas.filter(
                solicitada_por_cedula=cedula,
                poblacion__in=poblaciones,
            )
        if poblacion:
            cargas = cargas.filter(poblacion=poblacion)
        if estado:
            cargas = cargas.filter(estado=estado)
        return list(cargas[:MAX_CARGAS_HISTORIAL])

    def resumen(self, carga) -> dict:
        return {
            'id': str(carga.id), 'archivo': carga.archivo_nombre, 'estado': carga.estado,
            'poblacion': carga.poblacion,
            'tipos': carga.tipos, 'filas_total': carga.filas_total,
            'filas_validas': carga.filas_validas,
            'filas_error': carga.filas_error, 'filas_confirmacion': carga.filas_confirmacion,
            'filas_confirmadas': carga.filas_confirmadas,
            'creada_en': carga.created_at,
            # FIX-CARGA3: conteos de altas, actualizaciones y posibles duplicados
            # que el usuario ve antes de aplicar.
            'filas_nuevo': carga.filas.filter(estado=CargaMasivaFilaModel.Estado.NUEVO).count(),
            'filas_actualizar': carga.filas.filter(
                estado=CargaMasivaFilaModel.Estado.ACTUALIZAR,
            ).count(),
            'filas_posible_duplicado': carga.filas.filter(
                estado=CargaMasivaFilaModel.Estado.POSIBLE_DUPLICADO,
            ).count(),
        }

    def filas(
        self, carga, estado: str | None = None, solo_confirmacion: bool = False,
    ) -> list[dict]:
        filas = carga.filas.all()
        if estado:
            filas = filas.filter(estado=estado)
        if solo_confirmacion:
            filas = filas.filter(estado='REQUIERE_CONFIRMACION')
        return [
            {
                'id': str(f.id), 'tipo': f.tipo, 'numero_fila': f.numero_fila,
                'estado': f.estado,
                'detalle': f.detalle, 'datos': f.datos, 'aplicada': f.aplicada,
                'confirmada': f.confirmada, 'confirmada_por_cedula': f.confirmada_por_cedula,
                'confirmada_en': f.confirmada_en, 'movimiento': f.movimiento or None,
                'error_aplicacion': f.error_aplicacion,
            }
            for f in filas[:MAX_FILAS_DETALLE]
        ]
