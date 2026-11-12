"""Repositorio de carnetizaciÃ³n: carnets."""
import hashlib
import base64
import os
from io import BytesIO
from typing import Any
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count
from django.utils import timezone
from pdf2image import convert_from_bytes

from core.domain.catalogos import (
    TIPO_PERSONAL_PASIVO,
)
from core.domain.exceptions import NotFoundError, ValidationError
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from apps.carnetizacion.infrastructure.resolver_origen_campos import valores_campos_personalizados
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    CarnetTemplateModel,
    PlantillaCarnetModel,
)
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import (
    LADO_FOTO_MIN_PX,
    DatosCarnetPdf,
    generar_carnet_pdf,
    reducir_foto_carnet,
)

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


from .repo_carnetizacion_comun import (
    cargo_y_departamento,
    logger,
    vencimiento_de_carnet,
)


class RepoCarnetsPdfMixin:
    def _definicion_plantilla_emitida(self, fila: Any) -> dict[str, Any] | None:
        """Resuelve la definición congelada de un carnet emitido sin snapshot.

        `CarnetEmitidoModel.plantilla_version` guarda el número de versión y
        `plantilla_id` el id (UUID en texto) de la plantilla raíz. Los carnets
        anteriores al snapshot pueden no tenerlo; en ese caso se busca la
        versión exacta y, como respaldo, la última versión de la plantilla.
        """
        try:
            candidatas = []
            if fila.plantilla_version:
                candidatas.append(
                    PlantillaCarnetModel.objects.filter(
                        pk=fila.plantilla_id, version=fila.plantilla_version
                    ).first()
                )
                candidatas.append(
                    PlantillaCarnetModel.objects.filter(
                        plantilla_raiz_id=fila.plantilla_id,
                        version=fila.plantilla_version,
                    ).first()
                )
            candidatas.append(
                PlantillaCarnetModel.objects.filter(pk=fila.plantilla_id).first()
            )
            candidatas.append(
                PlantillaCarnetModel.objects.filter(plantilla_raiz_id=fila.plantilla_id)
                .order_by('-version')
                .first()
            )
        except (ValueError, DjangoValidationError):
            return None
        for plantilla in candidatas:
            if plantilla and plantilla.definicion:
                return plantilla.definicion
        return None

    @staticmethod
    def _foto_carnet(clave: str) -> bytes | None:
        """Foto del titular ya reducida, cacheada 1 h por clave del almacén.

        Cada subida genera una clave nueva (`clave_segura`), así que una foto cambiada
        nunca devuelve datos viejos. Sin caché o sin almacén, degrada a None/sin caché.
        """
        clave_cache = f"carnet:foto:{clave}:{LADO_FOTO_MIN_PX}"
        try:
            guardada = cache.get(clave_cache)
            if guardada:
                return guardada
        except Exception:
            logger.warning("Caché no disponible al leer la foto del carnet.", exc_info=True)
        try:
            original = SeaweedFSStorage().descargar(clave) or None
            if not original:
                return None
            reducida = reducir_foto_carnet(original, LADO_FOTO_MIN_PX)
        except Exception:
            logger.warning("No se pudo leer la foto del empleado para el carnet.", exc_info=True)
            return None
        try:
            cache.set(clave_cache, reducida, 3600)
        except Exception:
            logger.warning("Caché no disponible al guardar la foto del carnet.", exc_info=True)
        return reducida

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
        cargo, departamento = cargo_y_departamento(asignacion)

        foto_bytes = self._foto_carnet(empleado.profile) if empleado and empleado.profile else None

        # Si el carnet emitido tiene su propia plantilla snapshot, se usa esa versión
        # inmutable (O44 - E3, E8). `plantilla_version` es un entero (número de
        # versión), no la entidad: se resuelve contra el motor de plantillas.
        definicion = fila.plantilla_snapshot
        if not definicion and fila.plantilla_id:
            definicion = self._definicion_plantilla_emitida(fila)

        plantilla_path = None
        plantilla = CarnetTemplateModel.objects.filter(activo=True).first()
        if plantilla and plantilla.imagen:
            try:
                plantilla_path = plantilla.imagen.path
            except Exception:
                logger.warning("No se pudo resolver la ruta de la plantilla activa del carnet.", exc_info=True)
                plantilla_path = None

        vence = vencimiento_de_carnet(fila)
        nombre = nombre_override or (f"{empleado.nombres} {empleado.apellidos}".strip() if empleado else '')

        datos = DatosCarnetPdf(
            nombre_completo=nombre,
            cedula=str(empleado.cedulaidentidad if empleado else fila.employee_id),
            cargo=cargo,
            departamento=departamento,
            security_hash=fila.security_hash,
            plantilla_path=plantilla_path,
            foto_bytes=foto_bytes,
            vence=vence.strftime('%d/%m/%Y') if vence else '',
            campos_extra=valores_campos_personalizados(empleado, asignacion),
        )
        return generar_carnet_pdf(datos, definicion=definicion)

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
        cargo, departamento = cargo_y_departamento(asignacion)

        if foto_bytes is None and empleado.profile:
            foto_bytes = self._foto_carnet(empleado.profile)

        # Preferir la plantilla por capas activa (con su versión más reciente).
        # El fondo fijo legado solo se usa si no hay definición por capas.
        es_pasivo = (
            AsigTrabajoModel.objects.filter(
                employee=empleado,
                Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
            ).exists()
            or EmployeeEgresadoModel.objects.filter(employee=empleado).exists()
        )
        tipo_plantilla = 'pasivo' if es_pasivo else 'trabajador'
        plantilla_motor = (
            PlantillaCarnetModel.objects.filter(
                tipo_credencial_id=tipo_plantilla, activa=True,
            )
            .order_by('-version')
            .first()
        )
        definicion = (
            plantilla_motor.definicion
            if plantilla_motor and isinstance(plantilla_motor.definicion, dict) and plantilla_motor.definicion
            else None
        )

        plantilla_path = None
        if definicion is None:
            plantilla = CarnetTemplateModel.objects.filter(activo=True).first()
            if plantilla and plantilla.imagen:
                try:
                    plantilla_path = plantilla.imagen.path
                except Exception:
                    plantilla_path = None

        nombre = nombre_override or f"{empleado.nombres} {empleado.apellidos}".strip()
        sec_hash = hashlib.sha256(f"PREVIEW|{cedula}|{timezone.now().date()}".encode()).hexdigest()

        datos = DatosCarnetPdf(
            nombre_completo=nombre,
            cedula=str(empleado.cedulaidentidad),
            cargo=cargo,
            departamento=departamento,
            security_hash=sec_hash,
            plantilla_path=plantilla_path,
            foto_bytes=foto_bytes,
            campos_extra=valores_campos_personalizados(empleado, asignacion),
        )
        pdf_bytes = generar_carnet_pdf(datos, definicion=definicion)
        images = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, fmt='png', dpi=110)
        if not images:
            raise ValidationError("No se pudo rasterizar la vista previa del carnet")

        buffer = BytesIO()
        images[0].save(buffer, format='PNG')
        encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{encoded}"

    def obtener_estadisticas_carnets(self) -> dict[str, Any]:
        """Cuenta carnets de trabajadores/pasivos (CarnetEmitido) y credenciales externas o temporales.

        Las claves son las que consume el portal (total, activos, emitidos_hoy, emitidos_mes,
        por_motivo y ultimos). «Hoy» y «mes» se calculan en la zona horaria del sistema.
        """
        from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
            CredencialExternaModel,
        )

        ahora = timezone.now()
        local = timezone.localtime(ahora)
        inicio_hoy = local.replace(hour=0, minute=0, second=0, microsecond=0)
        inicio_mes = inicio_hoy.replace(day=1)

        carnets = CarnetEmitidoModel.objects.all()
        externas = CredencialExternaModel.objects.all()
        vigentes_ext = externas.filter(estado='ACTIVA', vigencia_hasta__gte=ahora)

        total = carnets.count() + externas.count()
        activos = carnets.filter(activo=True).count() + vigentes_ext.count()
        emitidos_hoy = (
            carnets.filter(fecha_emision__gte=inicio_hoy).count()
            + externas.filter(created_at__gte=inicio_hoy).count()
        )
        emitidos_mes = (
            carnets.filter(fecha_emision__gte=inicio_mes).count()
            + externas.filter(created_at__gte=inicio_mes).count()
        )

        por_motivo = [
            {'motivo_id': item['motivo_id'], 'motivo': item['motivo__nombre'], 'total': item['total']}
            for item in carnets.values('motivo_id', 'motivo__nombre')
            .annotate(total=Count('id'))
            .order_by('-total')
        ]
        total_ext = externas.count()
        if total_ext:
            por_motivo.append({'motivo_id': 0, 'motivo': 'Credenciales externas y temporales', 'total': total_ext})

        recientes: list[dict[str, Any]] = []
        for c in carnets.select_related('employee', 'motivo').order_by('-fecha_emision')[:10]:
            emp = c.employee
            recientes.append({
                'nombre': f"{emp.nombres} {emp.apellidos}".strip() if emp else '',
                'cedula': str(emp.cedulaidentidad if emp else c.employee_id),
                'fecha': timezone.localtime(c.fecha_emision).strftime('%d/%m/%Y %H:%M'),
                'motivo': c.motivo.nombre if c.motivo else '',
                'activo': c.activo,
                '_orden': c.fecha_emision,
            })
        for x in externas.select_related('tipo_credencial').order_by('-created_at')[:10]:
            recientes.append({
                'nombre': x.nombre,
                'cedula': x.documento,
                'fecha': timezone.localtime(x.created_at).strftime('%d/%m/%Y %H:%M'),
                'motivo': x.tipo_credencial.nombre if x.tipo_credencial else x.motivo,
                'activo': x.estado == 'ACTIVA' and x.vigencia_hasta >= ahora,
                '_orden': x.created_at,
            })
        recientes.sort(key=lambda r: r['_orden'], reverse=True)
        ultimos = [{k: v for k, v in r.items() if k != '_orden'} for r in recientes[:10]]

        return {
            'total': total,
            'activos': activos,
            'revocados': total - activos,
            'emitidos_hoy': emitidos_hoy,
            'emitidos_mes': emitidos_mes,
            'por_motivo': por_motivo,
            'ultimos': ultimos,
        }

    def ruta_imagen_plantilla(self, plantilla_id: int | str) -> str:
        obj = CarnetTemplateModel.objects.filter(pk=plantilla_id).first()
        if obj is None or not obj.imagen:
            raise NotFoundError(f"Plantilla con id {plantilla_id} sin imagen")
        try:
            ruta = obj.imagen.path
        except Exception as exc:
            raise NotFoundError("Imagen de plantilla no disponible") from exc
        if not os.path.isfile(ruta):
            raise NotFoundError("Imagen de plantilla no disponible")
        return ruta
