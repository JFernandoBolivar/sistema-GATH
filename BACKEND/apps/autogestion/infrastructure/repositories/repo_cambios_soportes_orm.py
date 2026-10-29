"""
Repositorios ORM de cambios propuestos (compartidos con la fe de vida) y soportes documentales.
"""
from apps.autogestion.domain.entities.solicitud_actualizacion import CambioPropuesto, SoporteDocumental
from apps.autogestion.infrastructure.mappers.mapper_solicitudes import cambio_a_entidad, soporte_a_entidad
from apps.autogestion.infrastructure.models.actualizacion_models import (
    CambioPropuestoModel,
    SoporteDocumentalModel,
)


def _campos_cambio(c: CambioPropuesto) -> dict:
    return {
        'origen_tipo': c.origen_tipo, 'origen_id': c.origen_id, 'seccion': c.seccion, 'accion': c.accion,
        'entidad_destino': c.entidad_destino, 'entidad_id': c.entidad_id, 'campo': c.campo,
        'valor_anterior': c.valor_anterior, 'valor_propuesto': c.valor_propuesto,
    }


class RepoCambiosPropuestosORM:
    def reemplazar(self, origen_tipo, origen_id, cambios, conservar_secciones=()):
        CambioPropuestoModel.objects.filter(origen_tipo=origen_tipo, origen_id=origen_id).exclude(
            seccion__in=conservar_secciones,
        ).delete()
        CambioPropuestoModel.objects.bulk_create([CambioPropuestoModel(**_campos_cambio(c)) for c in cambios])

    def listar(self, origen_tipo, origen_id) -> list[CambioPropuesto]:
        qs = CambioPropuestoModel.objects.filter(origen_tipo=origen_tipo, origen_id=origen_id)
        return [cambio_a_entidad(m) for m in qs]

    def guardar_decisiones(self, cambios: list[CambioPropuesto]) -> None:
        for c in cambios:
            CambioPropuestoModel.objects.filter(pk=c.id).update(
                decision=c.decision.value, motivo_decision=c.motivo_decision,
                decidido_por=c.decidido_por, fecha_decision=c.fecha_decision,
            )

    def eliminar_de_seccion(self, origen_tipo, origen_id, seccion) -> None:
        CambioPropuestoModel.objects.filter(origen_tipo=origen_tipo, origen_id=origen_id, seccion=seccion).delete()

    def guardar(self, cambio: CambioPropuesto) -> CambioPropuesto:
        m, _ = CambioPropuestoModel.objects.update_or_create(
            origen_tipo=cambio.origen_tipo, origen_id=cambio.origen_id, entidad_destino=cambio.entidad_destino,
            entidad_id=cambio.entidad_id, campo=cambio.campo, defaults=_campos_cambio(cambio),
        )
        return cambio_a_entidad(m)


class RepoSoportesORM:
    def agregar(self, soporte: SoporteDocumental) -> SoporteDocumental:
        m = SoporteDocumentalModel.objects.create(
            origen_tipo=soporte.origen_tipo, origen_id=soporte.origen_id, seccion=soporte.seccion, tipo=soporte.tipo,
            clave_s3=soporte.clave_s3, mime_real=soporte.mime_real, tamano_bytes=soporte.tamano_bytes,
            sha256=soporte.sha256, nombre_original=soporte.nombre_original, subido_por=soporte.subido_por,
        )
        return soporte_a_entidad(m)

    def obtener(self, soporte_id: str) -> SoporteDocumental | None:
        try:
            m = SoporteDocumentalModel.objects.filter(pk=soporte_id).first()
        except (ValueError, TypeError):
            return None
        return soporte_a_entidad(m) if m else None

    def listar(self, origen_tipo, origen_id) -> list[SoporteDocumental]:
        qs = SoporteDocumentalModel.objects.filter(origen_tipo=origen_tipo, origen_id=origen_id)
        return [soporte_a_entidad(m) for m in qs]

    def eliminar(self, soporte_id: str) -> None:
        SoporteDocumentalModel.objects.filter(pk=soporte_id).delete()
