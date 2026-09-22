"""
Repositorio ORM de Carnetización (Reglas B4, B7).
"""
import hashlib
import base64
import hashlib
from io import BytesIO
from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from pdf2image import convert_from_bytes

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
    MotivosEmisionModel,
)
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import DatosCarnetPdf, generar_carnet_pdf

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


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
        empleado = EmployeeModel.objects.filter(cedulaidentidad=empleado_cedula).first()
        if not empleado:
            raise NotFoundError(f"Empleado con cédula {empleado_cedula} no encontrado")

        # Desactivar cualquier carnet activo previo del trabajador
        CarnetEmitidoModel.objects.filter(employee=empleado, activo=True).update(activo=False)

        now = timezone.now()
        raw = f"{empleado_cedula}|{motivo_id}|{now.isoformat()}|{settings.SECRET_KEY}"
        sec_hash = hashlib.sha256(raw.encode('utf-8')).hexdigest()

        obj = CarnetEmitidoModel.objects.create(
            employee=empleado,
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

    def generar_pdf(self, carnet_id: int, nombre_override: str | None = None) -> bytes:
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

        nombre = nombre_override or (f"{empleado.nombres} {empleado.apellidos}".strip() if empleado else '')

        datos = DatosCarnetPdf(
            nombre_completo=nombre,
            cedula=str(empleado.cedulaidentidad if empleado else fila.employee_id),
            cargo=cargo,
            departamento=departamento,
            security_hash=fila.security_hash,
            plantilla_path=plantilla_path,
            foto_bytes=foto_bytes,
        )
        return generar_carnet_pdf(datos)

    def generar_vista_previa(self, cedula: str, nombre_override: str | None = None, foto_bytes: bytes | None = None) -> str:
        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not empleado:
            raise NotFoundError(f"Empleado con cédula {cedula} no encontrado")

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

        if foto_bytes is None and empleado.profile:
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

        nombre = nombre_override or f"{empleado.nombres} {empleado.apellidos}".strip()

        datos = DatosCarnetPdf(
            nombre_completo=nombre,
            cedula=str(empleado.cedulaidentidad),
            cargo=cargo,
            departamento=departamento,
            security_hash="preview",
            plantilla_path=plantilla_path,
            foto_bytes=foto_bytes,
        )
        pdf_bytes = generar_carnet_pdf(datos)

        images = convert_from_bytes(pdf_bytes, dpi=150, fmt="png")
        if not images:
            return "<div class='alert alert-danger'>Error generando vista previa</div>"

        img_buffer = BytesIO()
        images[0].save(img_buffer, format="PNG")
        img_buffer.seek(0)
        imagen_base64 = base64.b64encode(img_buffer.getvalue()).decode("utf-8")

        return f'''<div style="text-align: center; padding: 10px;">
    <img src="data:image/png;base64,{imagen_base64}"
         style="width: 100%; max-width: 290px; border: 2px solid #003366; border-radius: 5px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);"
         alt="Vista previa del carnet">
</div>'''

    def buscar_personal(self, query: str) -> list[dict]:
        query = query.strip()
        if not query:
            return []

        empleados = EmployeeModel.objects.filter(
            Q(cedulaidentidad__icontains=query) |
            Q(nombres__icontains=query) |
            Q(apellidos__icontains=query)
        ).order_by('apellidos', 'nombres')[:20]

        resultados = []
        for emp in empleados:
            asig = AsigTrabajoModel.objects.select_related('denominacioncargoid', 'DireccionGeneral').filter(employee=emp).order_by('-fecha_actualizacion').first()
            cargo = str(asig.denominacioncargoid) if asig and asig.denominacioncargoid else ''
            departamento = asig.DireccionGeneral.direccion_general if asig and asig.DireccionGeneral else ''
            codigo = asig.codigo if asig and asig.codigo else ''

            tiene_carnet = CarnetEmitidoModel.objects.filter(employee=emp, activo=True).exists()
            total_solicitudes = CarnetEmitidoModel.objects.filter(employee=emp).count()

            resultados.append({
                'id': emp.id,
                'cedula': emp.cedulaidentidad,
                'nombre_completo': f"{emp.nombres} {emp.apellidos}".strip(),
                'cargo': cargo,
                'departamento': departamento,
                'codigo': codigo,
                'correo': emp.correo or '',
                'telefono': emp.telefono_movil or '',
                'tiene_carnet': tiene_carnet,
                'total_solicitudes': total_solicitudes,
            })
        return resultados

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
        ultimos = []
        for s in qs.select_related('employee', 'motivo').order_by('-fecha_emision')[:10]:
            emp = s.employee
            ultimos.append({
                'nombre': f"{emp.nombres} {emp.apellidos}".strip() if emp else "Desconocido",
                'cedula': emp.cedulaidentidad if emp else str(s.employee_id),
                'fecha': s.fecha_emision.strftime('%d/%m/%Y %H:%M') if s.fecha_emision else "",
                'motivo': s.motivo.nombre if s.motivo else "Sin motivo",
                'motivo_id': s.motivo_id,
                'activo': s.activo,
            })
        emitidos_hoy = qs.filter(fecha_emision__date=hoy).count()
        emitidos_mes = qs.filter(fecha_emision__year=hoy.year, fecha_emision__month=hoy.month).count()
        return {
            'total': qs.count(),
            'activos': qs.filter(activo=True).count(),
            'revocados': qs.filter(activo=False).count(),
            'hoy': emitidos_hoy,
            'this_month': emitidos_mes,
            'emitidos_hoy': emitidos_hoy,
            'emitidos_mes': emitidos_mes,
            'por_motivo': por_motivo,
            'ultimos': ultimos,
        }
