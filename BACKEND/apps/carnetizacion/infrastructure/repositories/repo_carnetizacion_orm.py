"""
Repositorio ORM de Carnetización (Reglas B4, B7).
"""
import hashlib
from django.conf import settings
from django.db.models import Count
from django.utils import timezone

from core.domain.exceptions import NotFoundError
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet
from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    carnet_a_entidad,
    plantilla_a_entidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    CarnetTemplateModel,
)
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import DatosCarnetPdf, generar_carnet_pdf

# Import entre módulos en infrastructure (apps.cargos): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos` — el PDF
# del carnet necesita el cargo/departamento actual del empleado, que vive en
# `apps.cargos` (Fase 2.3 del plan de reparación).
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel


class RepoCarnetizacionORM:
    def listar_carnets(self, empleado_cedula: str | None = None) -> list[Carnet]:
        qs = CarnetEmitidoModel.objects.select_related('employee', 'motivo').all().order_by('-fecha_emision')
        if empleado_cedula:
            qs = qs.filter(employee__cedulaidentidad=empleado_cedula)
        return [carnet_a_entidad(c) for c in qs]

    def obtener_por_hash(self, security_hash: str) -> Carnet | None:
        fila = (
            CarnetEmitidoModel.objects.select_related('employee', 'motivo')
            .filter(security_hash=security_hash)
            .first()
        )
        return carnet_a_entidad(fila) if fila else None

    def obtener_por_id(self, carnet_id: int) -> Carnet | None:
        fila = (
            CarnetEmitidoModel.objects.select_related('employee', 'motivo')
            .filter(pk=carnet_id)
            .first()
        )
        return carnet_a_entidad(fila) if fila else None

    def emitir_carnet(
        self, empleado_cedula: str, motivo_id: int, observaciones: str | None = None
    ) -> Carnet:
        now = timezone.now()
        raw = f"{empleado_cedula}|{motivo_id}|{now.isoformat()}|{settings.SECRET_KEY}"
        sec_hash = hashlib.sha256(raw.encode('utf-8')).hexdigest()

        obj = CarnetEmitidoModel.objects.create(
            employee_id=empleado_cedula,
            motivo_id=motivo_id,
            security_hash=sec_hash,
            observaciones=observaciones,
            activo=True,
        )
        return self.obtener_por_id(obj.pk)

    def listar_plantillas(self) -> list[PlantillaCarnet]:
        qs = CarnetTemplateModel.objects.all().order_by('-activo', '-creado')
        return [plantilla_a_entidad(p) for p in qs]

    def activar_plantilla(self, plantilla_id: int) -> PlantillaCarnet:
        obj = CarnetTemplateModel.objects.filter(pk=plantilla_id).first()
        if not obj:
            raise NotFoundError(f"Plantilla con id {plantilla_id} no encontrada")
        CarnetTemplateModel.objects.exclude(pk=plantilla_id).update(activo=False)
        obj.activo = True
        obj.save(update_fields=['activo'])
        return plantilla_a_entidad(obj)

    def crear_plantilla(self, nombre: str, imagen: object, activar: bool = False) -> PlantillaCarnet:
        if activar:
            CarnetTemplateModel.objects.all().update(activo=False)
        obj = CarnetTemplateModel.objects.create(nombre=nombre, imagen=imagen, activo=activar)
        return plantilla_a_entidad(obj)

    def generar_pdf(self, carnet_id: int) -> bytes:
        fila = (
            CarnetEmitidoModel.objects.select_related('employee', 'motivo')
            .filter(pk=carnet_id)
            .first()
        )
        if not fila:
            raise NotFoundError(f"Carnet con id {carnet_id} no encontrado")

        empleado = fila.employee
        asignacion = (
            AsigTrabajoModel.objects.select_related('denominacioncargoid', 'DireccionGeneral')
            .filter(employee=empleado)
            .order_by('-fecha_actualizacion')
            .first()
        )
        cargo = str(asignacion.denominacioncargoid) if asignacion and asignacion.denominacioncargoid else ''
        departamento = (
            asignacion.DireccionGeneral.direccion_general
            if asignacion and asignacion.DireccionGeneral else ''
        )

        foto_bytes = None
        if empleado and empleado.profile:
            try:
                foto_bytes = SeaweedFSStorage().descargar(empleado.profile) or None
            except Exception:
                foto_bytes = None

        plantilla = CarnetTemplateModel.objects.filter(activo=True).first()
        plantilla_path = None
        if plantilla and plantilla.imagen:
            try:
                plantilla_path = plantilla.imagen.path
            except Exception:
                plantilla_path = None

        datos = DatosCarnetPdf(
            nombre_completo=f"{empleado.nombres} {empleado.apellidos}".strip() if empleado else '',
            cedula=str(fila.employee_id),
            cargo=cargo,
            departamento=departamento,
            security_hash=fila.security_hash,
            plantilla_path=plantilla_path,
            foto_bytes=foto_bytes,
        )
        return generar_carnet_pdf(datos)

    def revocar_carnet(self, carnet_id: int) -> Carnet:
        obj = CarnetEmitidoModel.objects.filter(pk=carnet_id).first()
        if not obj:
            raise NotFoundError(f"Carnet con id {carnet_id} no encontrado")
        obj.activo = False
        obj.save(update_fields=['activo'])
        return self.obtener_por_id(carnet_id)

    def obtener_estadisticas_carnets(self) -> dict:
        """Métricas de carnets (paridad con `carnetizacion/estadisticas`)."""
        hoy = timezone.now().date()
        qs = CarnetEmitidoModel.objects.all()
        por_motivo = [
            {'motivo_id': m['motivo_id'], 'motivo': str(m['motivo__nombre'] if m['motivo_id'] else 'Sin motivo'), 'total': m['total']}
            for m in qs.values('motivo_id', 'motivo__nombre').annotate(total=Count('id')).order_by('-total')
        ]
        return {
            'total': qs.count(),
            'activos': qs.filter(activo=True).count(),
            'revocados': qs.filter(activo=False).count(),
            'emitidos_hoy': qs.filter(fecha_emision__date=hoy).count(),
            'emitidos_mes': qs.filter(fecha_emision__year=hoy.year, fecha_emision__month=hoy.month).count(),
            'por_motivo': por_motivo,
        }
