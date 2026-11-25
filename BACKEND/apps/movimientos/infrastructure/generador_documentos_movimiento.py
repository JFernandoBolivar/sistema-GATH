"""Adaptador de Movimientos al servicio externo de documentos (N1).

La importación de `ServicioDocumentosExternos` es diferida para no acoplar el
arranque de Django al orden de carga de otro worker. Dominio/aplicación solo
conocen el puerto propio.
"""

from apps.documentos.infrastructure.models.documentos_models import DocumentoGeneradoModel
from apps.movimientos.domain.ports.generador_documentos_movimiento import (
    CLAVE_MOVIMIENTO_ID,
    DocumentoGeneradoMovimiento,
    PlantillaDocumentoMovimiento,
)


class GeneradorDocumentosMovimientoExternos:
    def __init__(self, servicio=None):
        self._servicio = servicio

    def _obtener_servicio(self):
        if self._servicio is None:
            from apps.documentos.infrastructure.servicio_externo import ServicioDocumentosExternos

            self._servicio = ServicioDocumentosExternos()
        return self._servicio

    @staticmethod
    def _a_plantilla(plantilla) -> PlantillaDocumentoMovimiento:
        return PlantillaDocumentoMovimiento(
            id=str(plantilla.id),
            codigo=str(getattr(plantilla, 'codigo', '') or ''),
            nombre=str(getattr(plantilla, 'nombre', '') or ''),
        )

    @staticmethod
    def _a_documento(documento) -> DocumentoGeneradoMovimiento:
        version = getattr(documento, 'version', None)
        version_numero = getattr(documento, 'version_numero', None)
        if version_numero is None:
            version_numero = getattr(version, 'numero', 0)
        return DocumentoGeneradoMovimiento(
            id=str(documento.id),
            plantilla_id=str(documento.plantilla_id),
            sujeto_tipo=str(documento.sujeto_tipo),
            sujeto_id=str(documento.sujeto_id),
            datos_snapshot=dict(documento.datos_snapshot or {}),
            pdf_sha256=str(documento.pdf_sha256),
            version_numero=int(version_numero or 0),
        )

    def plantillas_activas(self, proceso: str) -> list[PlantillaDocumentoMovimiento]:
        return [self._a_plantilla(p) for p in self._obtener_servicio().plantillas_activas(proceso)]

    def _existente(
        self,
        *,
        plantilla_id: str,
        datos: dict,
        sujeto_tipo: str,
        sujeto_id: str,
        trabajador_cedula: str,
    ):
        movimiento_id = datos.get(CLAVE_MOVIMIENTO_ID)
        if movimiento_id is None:
            return None
        return (
            DocumentoGeneradoModel.objects.filter(
                sujeto_tipo=sujeto_tipo,
                sujeto_id=str(sujeto_id),
                trabajador_cedula=trabajador_cedula,
                plantilla_id=str(plantilla_id),
                datos_snapshot__movimiento_id=movimiento_id,
            )
            .select_related('version')
            .first()
        )

    def generar_plantilla(
        self,
        plantilla_id: str,
        *,
        sujeto_tipo: str,
        sujeto_id: str,
        datos: dict,
        actor_id: int | None,
        valores_propios: dict | None = None,
        trabajador_cedula: str = '',
        estricto: bool = True,
    ) -> DocumentoGeneradoMovimiento:
        # Idempotencia persistente: un reintento no vuelve a generar la misma
        # plantilla para el mismo movimiento. El bloqueo del movimiento lo toma
        # el orquestador post-commit.
        existente = self._existente(
            plantilla_id=plantilla_id,
            datos=datos,
            sujeto_tipo=sujeto_tipo,
            sujeto_id=sujeto_id,
            trabajador_cedula=trabajador_cedula,
        )
        if existente is not None:
            return self._a_documento(existente)

        documento = self._obtener_servicio().generar_plantilla(
            str(plantilla_id),
            sujeto_tipo=sujeto_tipo,
            sujeto_id=sujeto_id,
            datos=datos,
            actor_id=actor_id,
            valores_propios=valores_propios,
            trabajador_cedula=trabajador_cedula,
            estricto=estricto,
        )
        return self._a_documento(documento)
