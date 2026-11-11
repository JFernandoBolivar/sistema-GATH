"""
Repositorio ORM de Carnetización (Reglas B4, B7, O44 - E3).
"""
import os
import logging
import hashlib
import base64
from io import BytesIO
from typing import Any
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils import timezone
from pdf2image import convert_from_bytes

from core.domain.catalogos import (
    ESTATUS_ACTIVO,
    TIPO_PERSONAL_PASIVO,
)
from core.domain.configuracion import (
    CLAVE_CARNETIZACION_VENCIMIENTO_MESES,
    CLAVE_CARNETIZACION_VIGENCIA_EXTERNO_DIAS,
    CLAVE_CARNETIZACION_VIGENCIA_PASIVO_MESES,
    CLAVE_CARNETIZACION_VIGENCIA_TRABAJADOR_MESES,
)
from core.domain.exceptions import NotFoundError, ValidationError
from core.infrastructure.providers import obtener_lector_configuracion
from core.domain.validacion_personas import formatear_telefono
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from apps.carnetizacion.domain.entities.campo_credencial import (
    CAMPOS_AUTORIZADOS_EXPEDIENTE,
    CampoCredencial,
)
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.entities.elemento_biblioteca import ElementoBiblioteca
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet
from apps.carnetizacion.domain.entities.tipo_credencial import TipoCredencial
from apps.carnetizacion.domain.entities.privacidad import (
    FichaQr,
    PRIVACIDAD_POR_DEFECTO,
    validar_preferencias_privacidad,
)
from apps.carnetizacion.domain.entities.verificacion_integracion import (
    VerificacionCarnet,
    normalizar_documento,
)
from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_pasivo,
    plantilla_defecto_trabajador,
)
from apps.carnetizacion.domain.services.vigencia_carnet import (
    TIPO_VIGENCIA_EXTERNO,
    TIPO_VIGENCIA_PASIVO,
    TIPO_VIGENCIA_TRABAJADOR,
    VIGENCIA_RESPALDO_MESES,
    calcular_vencimiento,
)
from apps.carnetizacion.domain.services.validador_multimedia import validar_archivo_biblioteca
from apps.carnetizacion.infrastructure.codigo_qr import codigo_qr_unico
from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    campo_personalizado_a_entidad,
    carnet_a_entidad,
    elemento_biblioteca_a_entidad,
    plantilla_a_entidad,
    plantilla_motor_a_entidad,
    tipo_credencial_a_entidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    CarnetTemplateModel,
    ElementoBibliotecaModel,
    MotivosEmisionModel,
    PlantillaCarnetModel,
    TipoCredencialModel,
    CampoPersonalizadoModel,
    PreferenciaPrivacidadCarnetModel,
    BitacoraAccesoQrModel,
)
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import DatosCarnetPdf, generar_carnet_pdf

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.models.expediente_models import (
    ContactoEmergenciaModel,
    DatosViviendaModel,
    PerfilSaludModel,
)

logger = logging.getLogger('gath.carnetizacion')


_CLAVE_VIGENCIA_POR_TIPO = {
    TIPO_VIGENCIA_TRABAJADOR: CLAVE_CARNETIZACION_VIGENCIA_TRABAJADOR_MESES,
    TIPO_VIGENCIA_PASIVO: CLAVE_CARNETIZACION_VIGENCIA_PASIVO_MESES,
    TIPO_VIGENCIA_EXTERNO: CLAVE_CARNETIZACION_VIGENCIA_EXTERNO_DIAS,
}


def _entero_configurado(clave: str, defecto: int) -> int:
    lector = obtener_lector_configuracion()
    if lector is None:
        return defecto
    try:
        return int(lector.obtener_entero(clave))
    except Exception:
        logger.warning("No se pudo leer el parámetro %s; se usa %s.", clave, defecto, exc_info=True)
        return defecto


def vencimiento_segun_parametros(emision: Any, tipo: str) -> Any:
    """Emisión + vigencia vigente del tipo (o el respaldo global si falta o vale 0)."""
    return calcular_vencimiento(
        emision,
        tipo=tipo,
        valor_tipo=_entero_configurado(_CLAVE_VIGENCIA_POR_TIPO[tipo], 0),
        respaldo_meses=_entero_configurado(
            CLAVE_CARNETIZACION_VENCIMIENTO_MESES, VIGENCIA_RESPALDO_MESES
        ),
    )


def _es_pasivo(empleado: Any) -> bool:
    return (
        AsigTrabajoModel.objects.filter(
            employee=empleado,
            Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
        ).exists()
        or EmployeeEgresadoModel.objects.filter(employee=empleado).exists()
    )


def vencimiento_de_carnet(carnet: Any) -> Any:
    """Fecha guardada al emitir; en carnets anteriores (NULL) se calcula con el parámetro vigente."""
    if carnet.fecha_vencimiento:
        return carnet.fecha_vencimiento
    if not carnet.fecha_emision:
        return None
    tipo = TIPO_VIGENCIA_PASIVO if _es_pasivo(carnet.employee) else TIPO_VIGENCIA_TRABAJADOR
    return vencimiento_segun_parametros(carnet.fecha_emision, tipo)


class RepoCarnetizacionORM:
    def __init__(self, almacen: Any = None):
        self._almacen = almacen or SeaweedFSStorage()

    # --- Tipos de Credencial (Catálogo) ---
    def _asegurar_catalogos_semilla(self) -> None:
        """Siembra los tipos de credencial base (trabajadores y pasivos) si la tabla está vacía."""
        if not TipoCredencialModel.objects.exists():
            TipoCredencialModel.objects.bulk_create([
                TipoCredencialModel(
                    codigo='trabajador',
                    nombre='Trabajador Activo',
                    descripcion='Credencial oficial para personal activo institucional',
                    ancho_mm=54.00,
                    alto_mm=85.60,
                    orientacion='vertical',
                    activo=True,
                    orden=1,
                ),
                TipoCredencialModel(
                    codigo='pasivo',
                    nombre='Pasivo / Jubilado / Pensionado',
                    descripcion='Credencial oficial para personal jubilado, pensionado o sobreviviente',
                    ancho_mm=54.00,
                    alto_mm=85.60,
                    orientacion='vertical',
                    activo=True,
                    orden=2,
                ),
            ])

    def listar_tipos_credencial(
        self, solo_activos: bool = True, grupo: str | None = None
    ) -> list[TipoCredencial]:
        self._asegurar_catalogos_semilla()
        qs = TipoCredencialModel.objects.all().order_by('orden', 'nombre')
        if solo_activos:
            qs = qs.filter(activo=True)
        if grupo:
            qs = qs.filter(grupo=grupo)
        return [tipo_credencial_a_entidad(t) for t in qs]

    def obtener_tipo_credencial(self, codigo: str) -> TipoCredencial | None:
        self._asegurar_catalogos_semilla()
        obj = TipoCredencialModel.objects.filter(codigo=codigo).first()
        return tipo_credencial_a_entidad(obj) if obj else None

    # --- Plantillas de Carnet (Motor por capas) ---
    def _asegurar_plantilla_semilla(self) -> None:
        """Garantiza al menos una plantilla publicada y activa para trabajador y pasivo."""
        self._asegurar_catalogos_semilla()
        tipo_trabajador = TipoCredencialModel.objects.filter(codigo='trabajador').first()
        if tipo_trabajador and not PlantillaCarnetModel.objects.filter(tipo_credencial_id='trabajador', activa=True).exists():
            def_trabajador = plantilla_defecto_trabajador()
            p = PlantillaCarnetModel.objects.create(
                nombre='Plantilla Institucional Activos',
                tipo_credencial=tipo_trabajador,
                ancho_mm=def_trabajador['dimensiones']['ancho_mm'],
                alto_mm=def_trabajador['dimensiones']['alto_mm'],
                orientacion=def_trabajador['orientacion'],
                regla_criterio='nomina',
                regla_valor='*',
                estado='publicada',
                activa=True,
                version=1,
                definicion=def_trabajador,
                descripcion='Plantilla oficial institucional para personal activo con franja de color según tipo de nómina.',
            )
            p.plantilla_raiz = p
            p.save(update_fields=['plantilla_raiz'])

        tipo_pasivo = TipoCredencialModel.objects.filter(codigo='pasivo').first()
        if tipo_pasivo and not PlantillaCarnetModel.objects.filter(tipo_credencial_id='pasivo', activa=True).exists():
            def_pasivo = plantilla_defecto_pasivo()
            p_pas = PlantillaCarnetModel.objects.create(
                nombre='Plantilla Institucional Pasivos',
                tipo_credencial=tipo_pasivo,
                ancho_mm=def_pasivo['dimensiones']['ancho_mm'],
                alto_mm=def_pasivo['dimensiones']['alto_mm'],
                orientacion=def_pasivo['orientacion'],
                regla_criterio='unico',
                regla_valor='*',
                estado='publicada',
                activa=True,
                version=1,
                definicion=def_pasivo,
                descripcion='Plantilla oficial institucional para personal jubilado y pensionado con franjas verdes y anverso/reverso.',
            )
            p_pas.plantilla_raiz = p_pas
            p_pas.save(update_fields=['plantilla_raiz'])

    def listar_plantillas(
        self,
        codigo_tipo: str | None = None,
        estado: str | None = None,
        solo_activas: bool = False,
    ) -> list[PlantillaCarnet]:
        self._asegurar_plantilla_semilla()
        qs = PlantillaCarnetModel.objects.select_related('tipo_credencial').all().order_by('-activa', '-version', '-created_at')
        if codigo_tipo:
            qs = qs.filter(tipo_credencial_id=codigo_tipo)
        if estado:
            qs = qs.filter(estado=estado)
        if solo_activas:
            qs = qs.filter(activa=True)
        return [plantilla_motor_a_entidad(p) for p in qs]

    def obtener_plantilla(self, plantilla_id: str | int) -> PlantillaCarnet | None:
        self._asegurar_plantilla_semilla()
        obj = PlantillaCarnetModel.objects.select_related('tipo_credencial').filter(pk=plantilla_id).first()
        if obj:
            return plantilla_motor_a_entidad(obj)
        # Fallback a tabla legacy por id numérico
        if isinstance(plantilla_id, int) or (isinstance(plantilla_id, str) and plantilla_id.isdigit()):
            legacy = CarnetTemplateModel.objects.filter(pk=int(plantilla_id)).first()
            if legacy:
                return plantilla_a_entidad(legacy)
        return None

    def obtener_plantilla_activa(
        self,
        codigo_tipo: str = "trabajador",
        regla_criterio: str = "todos",
        regla_valor: str = "*",
    ) -> PlantillaCarnet | None:
        self._asegurar_plantilla_semilla()
        # 1. Búsqueda por regla específica
        obj = (
            PlantillaCarnetModel.objects.select_related('tipo_credencial')
            .filter(tipo_credencial_id=codigo_tipo, regla_criterio=regla_criterio, regla_valor=regla_valor, activa=True)
            .first()
        )
        if obj:
            return plantilla_motor_a_entidad(obj)
        # 2. Fallback a la activa genérica del tipo
        obj_default = (
            PlantillaCarnetModel.objects.select_related('tipo_credencial')
            .filter(tipo_credencial_id=codigo_tipo, activa=True)
            .order_by('-created_at')
            .first()
        )
        if obj_default:
            return plantilla_motor_a_entidad(obj_default)
        return None

    def crear_plantilla_borrador(
        self,
        nombre: str,
        codigo_tipo: str,
        definicion: dict[str, Any],
        ancho_mm: float = 54.0,
        alto_mm: float = 85.6,
        orientacion: str = "vertical",
        regla_criterio: str = "todos",
        regla_valor: str = "*",
        descripcion: str = "",
        creado_por: str | None = None,
        plantilla_raiz_id: str | None = None,
    ) -> PlantillaCarnet:
        self._asegurar_catalogos_semilla()
        tipo = TipoCredencialModel.objects.filter(codigo=codigo_tipo).first()
        if not tipo:
            raise NotFoundError(f"Tipo de credencial '{codigo_tipo}' no encontrado")

        raiz = None
        version = 1
        if plantilla_raiz_id:
            raiz = PlantillaCarnetModel.objects.filter(pk=plantilla_raiz_id).first()
            if raiz:
                raiz_objetivo = raiz.plantilla_raiz or raiz
                max_v = PlantillaCarnetModel.objects.filter(
                    Q(pk=raiz_objetivo.pk) | Q(plantilla_raiz=raiz_objetivo)
                ).aggregate(Max('version'))['version__max'] or 1
                version = max_v + 1
                raiz = raiz_objetivo

        creado_por_val = None
        if creado_por is not None and str(creado_por).strip() not in ('', 'None'):
            try:
                creado_por_val = int(creado_por)
            except (ValueError, TypeError):
                creado_por_val = None

        obj = PlantillaCarnetModel.objects.create(
            nombre=nombre,
            tipo_credencial=tipo,
            ancho_mm=ancho_mm,
            alto_mm=alto_mm,
            orientacion=orientacion,
            regla_criterio=regla_criterio,
            regla_valor=regla_valor,
            estado='borrador',
            activa=False,
            version=version,
            definicion=definicion,
            descripcion=descripcion,
            creado_por_id=creado_por_val,
            plantilla_raiz=raiz,
        )
        if not raiz:
            obj.plantilla_raiz = obj
            obj.save(update_fields=['plantilla_raiz'])
        return plantilla_motor_a_entidad(obj)

    def actualizar_borrador(
        self,
        plantilla_id: str | int,
        nombre: str | None = None,
        definicion: dict[str, Any] | None = None,
        ancho_mm: float | None = None,
        alto_mm: float | None = None,
        orientacion: str | None = None,
        regla_criterio: str | None = None,
        regla_valor: str | None = None,
        descripcion: str | None = None,
    ) -> PlantillaCarnet:
        obj = PlantillaCarnetModel.objects.filter(pk=plantilla_id).first()
        if not obj:
            raise NotFoundError(f"Plantilla con id {plantilla_id} no encontrada")
        if obj.estado != 'borrador':
            raise ValidationError("Solo se pueden editar plantillas en estado borrador. Cree una nueva versión.")

        campos = []
        if nombre is not None:
            obj.nombre = nombre
            campos.append('nombre')
        if definicion is not None:
            obj.definicion = definicion
            campos.append('definicion')
        if ancho_mm is not None:
            obj.ancho_mm = ancho_mm
            campos.append('ancho_mm')
        if alto_mm is not None:
            obj.alto_mm = alto_mm
            campos.append('alto_mm')
        if orientacion is not None:
            obj.orientacion = orientacion
            campos.append('orientacion')
        if regla_criterio is not None:
            obj.regla_criterio = regla_criterio
            campos.append('regla_criterio')
        if regla_valor is not None:
            obj.regla_valor = regla_valor
            campos.append('regla_valor')
        if descripcion is not None:
            obj.descripcion = descripcion
            campos.append('descripcion')

        if campos:
            obj.save(update_fields=campos + ['updated_at'])
        return plantilla_motor_a_entidad(obj)

    def publicar_plantilla(
        self,
        plantilla_id: str | int,
        activar: bool = True,
        publicado_por: str | None = None,
    ) -> PlantillaCarnet:
        obj = PlantillaCarnetModel.objects.filter(pk=plantilla_id).first()
        if not obj:
            raise NotFoundError(f"Plantilla con id {plantilla_id} no encontrada")

        with transaction.atomic():
            if obj.estado == 'borrador':
                obj.estado = 'publicada'
                if activar:
                    PlantillaCarnetModel.objects.filter(
                        tipo_credencial=obj.tipo_credencial,
                        regla_criterio=obj.regla_criterio,
                        regla_valor=obj.regla_valor,
                        activa=True,
                    ).update(activa=False)
                    obj.activa = True
                obj.save(update_fields=['estado', 'activa', 'updated_at'])
                return plantilla_motor_a_entidad(obj)

            # Si ya está publicada, publicar genera una nueva versión inmutable
            raiz = obj.plantilla_raiz or obj
            max_ver = PlantillaCarnetModel.objects.filter(
                Q(plantilla_raiz=raiz) | Q(pk=raiz.pk)
            ).aggregate(m=Max('version'))['m'] or obj.version

            if activar:
                PlantillaCarnetModel.objects.filter(
                    tipo_credencial=obj.tipo_credencial,
                    regla_criterio=obj.regla_criterio,
                    regla_valor=obj.regla_valor,
                    activa=True,
                ).update(activa=False)

            nueva_version = PlantillaCarnetModel.objects.create(
                nombre=obj.nombre,
                tipo_credencial=obj.tipo_credencial,
                ancho_mm=obj.ancho_mm,
                alto_mm=obj.alto_mm,
                orientacion=obj.orientacion,
                regla_criterio=obj.regla_criterio,
                regla_valor=obj.regla_valor,
                estado='publicada',
                activa=activar,
                version=max_ver + 1,
                plantilla_raiz=raiz,
                definicion=obj.definicion,
                descripcion=obj.descripcion,
                creado_por_id=publicado_por,
            )
            return plantilla_motor_a_entidad(nueva_version)

    def activar_plantilla(self, plantilla_id: str | int) -> PlantillaCarnet:
        """Activa o reactiva una versión de plantilla (motor o legacy)."""
        obj = PlantillaCarnetModel.objects.filter(pk=plantilla_id).first()
        if obj:
            with transaction.atomic():
                # Enforza la regla canónica: una activa por tipo y regla
                PlantillaCarnetModel.objects.filter(
                    tipo_credencial=obj.tipo_credencial,
                    regla_criterio=obj.regla_criterio,
                    regla_valor=obj.regla_valor,
                    activa=True,
                ).exclude(pk=obj.pk).update(activa=False)
                obj.activa = True
                obj.save(update_fields=['activa', 'updated_at'])
            return plantilla_motor_a_entidad(obj)

        # Fallback a tabla legacy
        if isinstance(plantilla_id, int) or (isinstance(plantilla_id, str) and plantilla_id.isdigit()):
            legacy = CarnetTemplateModel.objects.filter(pk=int(plantilla_id)).first()
            if not legacy:
                raise NotFoundError(f"Plantilla con id {plantilla_id} no encontrada")
            CarnetTemplateModel.objects.exclude(pk=legacy.pk).update(activo=False)
            legacy.activo = True
            legacy.save(update_fields=['activo'])
            return plantilla_a_entidad(legacy)

        raise NotFoundError(f"Plantilla con id {plantilla_id} no encontrada")

    def listar_versiones_plantilla(self, plantilla_raiz_id: str | int) -> list[PlantillaCarnet]:
        qs = PlantillaCarnetModel.objects.filter(
            Q(plantilla_raiz_id=plantilla_raiz_id) | Q(pk=plantilla_raiz_id)
        ).order_by('version')
        return [plantilla_motor_a_entidad(p) for p in qs]

    def eliminar_plantilla(self, plantilla_id: str | int) -> None:
        obj = PlantillaCarnetModel.objects.filter(pk=plantilla_id).first()
        if obj is None:
            raise NotFoundError(f"Plantilla con id {plantilla_id} no encontrada")
        if obj.activa:
            raise ValidationError(
                "No se puede eliminar la plantilla activa. Actívela otra versión o archívela primero."
            )
        obj.delete()

    def crear_plantilla(self, nombre: str, imagen: object, activar: bool = False) -> PlantillaCarnet:
        """Soporte legacy para subida de imagen física."""
        if activar:
            CarnetTemplateModel.objects.all().update(activo=False)
        obj = CarnetTemplateModel.objects.create(nombre=nombre, imagen=imagen, activo=activar)
        return plantilla_a_entidad(obj)

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

    # --- Carnets Emitidos ---
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
        self,
        empleado_cedula: str,
        motivo_id: int,
        observaciones: str | None = None,
        plantilla_id: str | int | None = None,
    ) -> Carnet:
        empleado = EmployeeModel.objects.filter(cedulaidentidad=empleado_cedula).first()
        if not empleado:
            raise NotFoundError(f"Empleado con cédula {empleado_cedula} no encontrado")

        sec_hash = codigo_qr_unico()
        emision = timezone.now()
        tipo_vigencia = TIPO_VIGENCIA_PASIVO if _es_pasivo(empleado) else TIPO_VIGENCIA_TRABAJADOR
        vence = vencimiento_segun_parametros(emision, tipo_vigencia)

        # Determinar versión de plantilla para conservación inmutable (O44 - E3)
        plantilla_obj = None
        if plantilla_id:
            plantilla_obj = PlantillaCarnetModel.objects.filter(pk=plantilla_id).first()
        if not plantilla_obj:
            es_pasivo = _es_pasivo(empleado)
            tipo_plantilla = 'pasivo' if es_pasivo else 'trabajador'
            plantilla_obj = (
                PlantillaCarnetModel.objects.filter(
                    tipo_credencial_id=tipo_plantilla, activa=True,
                )
                .order_by('-version')
                .first()
            )

        p_id = str(plantilla_obj.id) if plantilla_obj else None
        p_version = plantilla_obj.version if plantilla_obj else 1
        p_snapshot = plantilla_obj.definicion if plantilla_obj else None

        # Atómico: si el alta falla, el trabajador no pierde su carnet activo previo.
        with transaction.atomic():
            CarnetEmitidoModel.objects.filter(employee=empleado, activo=True).update(activo=False)
            obj = CarnetEmitidoModel.objects.create(
                employee=empleado,
                motivo_id=motivo_id,
                security_hash=sec_hash,
                observaciones=observaciones,
                activo=True,
                plantilla_id=p_id,
                plantilla_version=p_version,
                plantilla_snapshot=p_snapshot,
                fecha_vencimiento=vence,
            )
        return self.obtener_por_id(obj.pk)

    def empleado_existe(self, cedula: str) -> bool:
        return EmployeeModel.objects.filter(cedulaidentidad=cedula).exists()

    def listar_motivos_emision(self) -> list[dict[str, Any]]:
        """Motivos de emisión ordenados por nombre, en el formato del formulario."""
        return [
            {'id': motivo.id, 'nombre': motivo.nombre}
            for motivo in MotivosEmisionModel.objects.all().order_by('nombre')
        ]

    def buscar_personal(self, query: str = "") -> list[dict[str, Any]]:
        qs = list(
            EmployeeModel.objects.filter(
                Q(cedulaidentidad__icontains=query) |
                Q(nombres__icontains=query) |
                Q(apellidos__icontains=query)
            ).select_related('sexoid', 'nacionalidad')[:20]
        )
        cedulas = [e.cedulaidentidad for e in qs]

        # Asignación vigente (o la más reciente) de cada titular, en una sola consulta.
        asignaciones_activas: dict[str, Any] = {}
        asignaciones_recientes: dict[str, Any] = {}
        for asig in (
            AsigTrabajoModel.objects
            .filter(employee_id__in=cedulas)
            .select_related(
                'denominacioncargoid', 'denominacioncargoespecificoid',
                'Dependencia', 'DireccionGeneral', 'DireccionLinea', 'Coordinacion',
                'tiponominaid', 'estatusid',
            )
            .order_by('-pk')
        ):
            asignaciones_recientes.setdefault(asig.employee_id, asig)
            if asig.estatusid and (asig.estatusid.estatus or '').upper() == ESTATUS_ACTIVO:
                asignaciones_activas.setdefault(asig.employee_id, asig)

        totales = dict(
            CarnetEmitidoModel.objects
            .filter(employee__cedulaidentidad__in=cedulas)
            .values_list('employee__cedulaidentidad')
            .annotate(total=Count('pk'))
        )
        activos = set(
            CarnetEmitidoModel.objects
            .filter(employee__cedulaidentidad__in=cedulas, activo=True)
            .values_list('employee__cedulaidentidad', flat=True)
        )

        filas = []
        for e in qs:
            asig = asignaciones_activas.get(e.cedulaidentidad) or asignaciones_recientes.get(e.cedulaidentidad)
            cargo = ''
            departamento = ''
            codigo = ''
            if asig:
                cargo = (
                    (asig.denominacioncargoespecificoid.cargo if asig.denominacioncargoespecificoid_id else '')
                    or (asig.denominacioncargoid.cargo if asig.denominacioncargoid_id else '')
                    or ''
                )
                departamento = (
                    (asig.DireccionGeneral.direccion_general if asig.DireccionGeneral_id else '')
                    or (asig.DireccionLinea.direccion_linea if asig.DireccionLinea_id else '')
                    or (asig.Coordinacion.coordinacion if asig.Coordinacion_id else '')
                    or (asig.Dependencia.dependencia if asig.Dependencia_id else '')
                    or ''
                )
                codigo = asig.codigo or ''

            tiene_carnet = e.cedulaidentidad in activos
            filas.append({
                'id': e.pk,
                'cedula': str(e.cedulaidentidad),
                'nombre_completo': f"{e.nombres} {e.apellidos}".strip(),
                'cargo': cargo or 'No especificado',
                'departamento': departamento or 'CONATEL',
                'codigo': codigo,
                'correo': (e.correo or '').strip(),
                'telefono': (e.telefono_movil or e.telefono_habitacion or '').strip(),
                'tipo_personal': str(getattr(e, 'tipo_trabajador', '') or 'Activo'),
                'total_solicitudes': totales.get(e.cedulaidentidad, 0),
                'tiene_carnet': tiene_carnet,
                'tiene_carnet_activo': tiene_carnet,
            })
        return filas

    def registrar_foto_perfil(self, cedula: str, clave: str) -> None:
        fila = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if fila is None:
            raise NotFoundError(f"Empleado con cédula {cedula} no encontrado")
        fila.profile = clave
        fila.save(update_fields=['profile'])

    def revocar_carnet(self, carnet_id: int) -> Carnet:
        carnet = CarnetEmitidoModel.objects.select_related('employee', 'motivo').filter(pk=carnet_id).first()
        if not carnet:
            raise NotFoundError(f"Carnet con id {carnet_id} no encontrado")
        carnet.activo = False
        carnet.save(update_fields=['activo'])
        return carnet_a_entidad(carnet)

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
                logger.warning("No se pudo leer la foto del empleado para el carnet.", exc_info=True)
                foto_bytes = None

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
        cargo = str(asignacion.denominacioncargoid) if asignacion and asignacion.denominacioncargoid else ''
        departamento = (
            asignacion.DireccionGeneral.direccion_general
            if asignacion and asignacion.DireccionGeneral else ''
        )

        if foto_bytes is None and empleado.profile:
            try:
                foto_bytes = SeaweedFSStorage().descargar(empleado.profile) or None
            except Exception:
                logger.warning("No se pudo leer la foto del empleado para el carnet.", exc_info=True)

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
        )
        pdf_bytes = generar_carnet_pdf(datos, definicion=definicion)
        images = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, fmt='png')
        if not images:
            raise ValidationError("No se pudo rasterizar la vista previa del carnet")

        buffer = BytesIO()
        images[0].save(buffer, format='PNG')
        encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{encoded}"

    def obtener_estadisticas_carnets(self) -> dict[str, Any]:
        total_emitidos = CarnetEmitidoModel.objects.count()
        total_activos = CarnetEmitidoModel.objects.filter(activo=True).count()
        total_revocados = CarnetEmitidoModel.objects.filter(activo=False).count()
        por_motivo = (
            CarnetEmitidoModel.objects.values('motivo__nombre')
            .annotate(total=Count('id'))
            .order_by('-total')
        )
        ultimos = (
            CarnetEmitidoModel.objects.select_related('employee', 'motivo')
            .order_by('-fecha_emision')[:10]
        )
        return {
            'total_emitidos': total_emitidos,
            'total_activos': total_activos,
            'total_revocados': total_revocados,
            'por_motivo': [{'motivo': item['motivo__nombre'], 'total': item['total']} for item in por_motivo],
            'ultimos_emitidos': [carnet_a_entidad(c) for c in ultimos],
        }

    # --- Biblioteca de Medios (O44 - E4) ---
    def listar_elementos_biblioteca(self, categoria: str | None = None) -> list[ElementoBiblioteca]:
        qs = ElementoBibliotecaModel.objects.all()
        if categoria:
            qs = qs.filter(categoria=categoria)
        return [elemento_biblioteca_a_entidad(e) for e in qs]

    def obtener_elemento_biblioteca(self, elemento_id: str | int) -> ElementoBiblioteca:
        obj = ElementoBibliotecaModel.objects.filter(pk=elemento_id).first()
        if not obj:
            raise NotFoundError(f"Elemento de biblioteca con id {elemento_id} no encontrado")
        return elemento_biblioteca_a_entidad(obj)

    def guardar_elemento_biblioteca(
        self,
        nombre: str,
        categoria: str,
        contenido: bytes,
        nombre_archivo: str,
        creado_por: str | None = None,
        descripcion: str = "",
    ) -> ElementoBiblioteca:
        mime_type, tamano = validar_archivo_biblioteca(
            contenido=contenido,
            nombre_archivo=nombre_archivo,
            categoria=categoria,
        )

        ancho_px, alto_px = None, None
        if mime_type == 'image/png' and len(contenido) >= 24:
            try:
                ancho_px = int.from_bytes(contenido[16:20], 'big')
                alto_px = int.from_bytes(contenido[20:24], 'big')
            except Exception:
                logger.warning(
                    'No se pudieron leer las dimensiones del PNG de biblioteca %s.',
                    nombre_archivo, exc_info=True,
                )
        elif mime_type in ('image/jpeg', 'image/webp'):
            try:
                from PIL import Image
                with Image.open(BytesIO(contenido)) as img:
                    ancho_px, alto_px = img.size
            except Exception:
                logger.warning(
                    'No se pudieron leer las dimensiones de la imagen de biblioteca %s.',
                    nombre_archivo, exc_info=True,
                )

        clave = f"carnet_biblioteca/{hashlib.sha256(contenido).hexdigest()[:16]}_{nombre_archivo}"
        self._almacen.subir(clave, contenido, mime_type)

        obj = ElementoBibliotecaModel.objects.create(
            nombre=nombre,
            categoria=categoria,
            archivo_clave=clave,
            nombre_archivo=nombre_archivo,
            tamano_bytes=tamano,
            mime_type=mime_type,
            ancho_px=ancho_px,
            alto_px=alto_px,
            descripcion=descripcion,
            creado_por_id=creado_por,
        )
        return elemento_biblioteca_a_entidad(obj)

    def eliminar_elemento_biblioteca(self, elemento_id: str | int) -> bool:
        obj = ElementoBibliotecaModel.objects.filter(pk=elemento_id).first()
        if not obj:
            raise NotFoundError(f"Elemento de biblioteca con id {elemento_id} no encontrado")
        if obj.archivo_clave:
            try:
                self._almacen.eliminar(obj.archivo_clave)
            except Exception as e:
                logger.warning("No se pudo borrar el archivo del storage para biblioteca %s: %s", elemento_id, e)
        obj.delete()
        return True

    def obtener_archivo_biblioteca(self, elemento_id: str | int) -> tuple[bytes, str, str]:
        obj = ElementoBibliotecaModel.objects.filter(pk=elemento_id).first()
        if not obj:
            raise NotFoundError(f"Elemento de biblioteca con id {elemento_id} no encontrado")
        try:
            data = self._almacen.descargar(obj.archivo_clave)
        except Exception as e:
            raise NotFoundError(f"No fue posible leer el archivo de biblioteca: {e}")
        return data, obj.mime_type, obj.nombre_archivo or "archivo"

    # --- Registro de Campos Autorizados y Personalizados (O44 - E5) ---
    def listar_campos_credencial(self, tipo_credencial: str = "trabajador") -> list[CampoCredencial]:
        """Obtiene la lista de campos autorizados del expediente y personalizados para el tipo dado."""
        nativos = [
            c for c in CAMPOS_AUTORIZADOS_EXPEDIENTE
            if c.tipo_credencial in ("todos", tipo_credencial)
        ]
        personalizados_qs = CampoPersonalizadoModel.objects.filter(
            Q(tipo_credencial="todos") | Q(tipo_credencial=tipo_credencial)
        )
        personalizados = [campo_personalizado_a_entidad(p) for p in personalizados_qs]
        return nativos + personalizados

    def crear_campo_personalizado(
        self,
        codigo: str,
        etiqueta: str,
        grupo: str = "personalizado",
        tipo_credencial: str = "todos",
        sensible: bool = False,
        descripcion: str = "",
        valor_ejemplo: str = "",
    ) -> CampoCredencial:
        """Registra un nuevo campo personalizado para credenciales."""
        if CampoPersonalizadoModel.objects.filter(codigo=codigo).exists():
            raise ValidationError(f"Ya existe un campo con el código '{codigo}'")

        obj = CampoPersonalizadoModel.objects.create(
            codigo=codigo,
            etiqueta=etiqueta,
            grupo=grupo,
            tipo_credencial=tipo_credencial,
            sensible=sensible,
            descripcion=descripcion,
            valor_ejemplo=valor_ejemplo,
        )
        return campo_personalizado_a_entidad(obj)

    def eliminar_campo_personalizado(self, codigo: str) -> bool:
        """Elimina un campo personalizado registrado."""
        obj = CampoPersonalizadoModel.objects.filter(codigo=codigo).first()
        if not obj:
            raise NotFoundError(f"Campo personalizado '{codigo}' no encontrado")
        obj.delete()
        return True

    # --- QR y Privacidad por Dato (O44 - E9) ---
    def _ficha_credencial_externa(
        self,
        externa: Any,
        security_hash: str,
        usuario_sesion: Any | None,
        ip: str,
        user_agent: str,
        accion: str,
    ) -> FichaQr:
        from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
            CredencialExternaModel,
        )

        ahora = timezone.now()
        estado = externa.estado
        if estado == CredencialExternaModel.Estado.ACTIVA and externa.vigencia_hasta < ahora:
            externa.estado = CredencialExternaModel.Estado.VENCIDA
            externa.save(update_fields=['estado', 'updated_at'])
            estado = CredencialExternaModel.Estado.VENCIDA

        if estado != CredencialExternaModel.Estado.ACTIVA:
            BitacoraAccesoQrModel.objects.create(
                security_hash=security_hash,
                accion='ESCANEO_NO_VALIDO',
                ip=ip,
                user_agent=user_agent,
            )
            estado_ui = (
                'VENCIDO'
                if estado == CredencialExternaModel.Estado.VENCIDA
                else 'ANULADO'
            )
            return FichaQr(
                es_valido=False,
                estado=estado_ui,
                mensaje='Esta credencial ya no está vigente.',
                security_hash=security_hash,
                fecha_vencimiento=externa.vigencia_hasta.strftime('%d/%m/%Y %H:%M'),
            )

        BitacoraAccesoQrModel.objects.create(
            security_hash=security_hash,
            accion=accion,
            ip=ip,
            user_agent=user_agent,
        )
        datos = {
            'nombre': externa.nombre,
            'cargo': externa.empresa or externa.contrato or externa.tipo_credencial.nombre,
            'ubicacion': externa.persona_visitada or externa.motivo,
            'tipo_credencial': externa.tipo_credencial.nombre,
            'empresa': externa.empresa,
            'motivo': externa.motivo,
            'vigencia_hasta': externa.vigencia_hasta.strftime('%d/%m/%Y %H:%M'),
        }
        return FichaQr(
            es_valido=True,
            estado='VIGENTE',
            mensaje='Credencial auténtica y vigente.',
            security_hash=security_hash,
            datos=datos,
            nivel_acceso='PUBLICO',
            fecha_vencimiento=externa.vigencia_hasta.strftime('%d/%m/%Y %H:%M'),
        )

    def consultar_ficha_qr(
        self,
        security_hash: str,
        usuario_sesion: Any | None = None,
        ip: str = "",
        user_agent: str = "",
        accion: str = "ESCANEO",
    ) -> FichaQr:
        carnet = (
            CarnetEmitidoModel.objects.select_related('employee', 'motivo')
            .filter(security_hash=security_hash)
            .first()
        )
        if not carnet:
            from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
                CredencialExternaModel,
            )

            externa = (
                CredencialExternaModel.objects.select_related('tipo_credencial')
                .filter(security_hash=security_hash)
                .first()
            )
            if externa:
                return self._ficha_credencial_externa(
                    externa, security_hash, usuario_sesion, ip, user_agent, accion
                )
            return FichaQr(
                es_valido=False,
                estado='NO_REGISTRADO',
                mensaje='Carnet no encontrado en el sistema.',
                security_hash=security_hash,
            )

        usuario_id = getattr(usuario_sesion, 'id', None) if (usuario_sesion and getattr(usuario_sesion, 'is_authenticated', False)) else None

        if not carnet.activo:
            BitacoraAccesoQrModel.objects.create(
                security_hash=security_hash,
                carnet_id=carnet.id,
                accion='ESCANEO_ANULADO',
                usuario_id=usuario_id,
                ip=ip,
                user_agent=user_agent,
            )
            return FichaQr(
                es_valido=False,
                estado='ANULADO',
                mensaje='Este carnet fue anulado. Si lo encontró, entréguelo a la institución.',
                datos=None,
                security_hash=security_hash,
            )

        # Vencimiento: fecha guardada al emitir (o calculada si el carnet es anterior).
        fecha_venc_dt = vencimiento_de_carnet(carnet)
        fecha_venc_str = fecha_venc_dt.strftime('%d/%m/%Y') if fecha_venc_dt else None
        if fecha_venc_dt and timezone.now() > fecha_venc_dt:
            BitacoraAccesoQrModel.objects.create(
                security_hash=security_hash,
                carnet_id=carnet.id,
                accion='ESCANEO_VENCIDO',
                usuario_id=usuario_id,
                ip=ip,
                user_agent=user_agent,
            )
            return FichaQr(
                es_valido=False,
                estado='VENCIDO',
                mensaje='Este carnet ha vencido. Si lo encontró, entréguelo a la institución.',
                datos=None,
                security_hash=security_hash,
                fecha_vencimiento=fecha_venc_str,
            )

        # Nivel de acceso según sesión y permisos
        es_autenticado = bool(usuario_sesion and getattr(usuario_sesion, 'is_authenticated', False))
        es_admin = False
        if es_autenticado:
            if getattr(usuario_sesion, 'is_superuser', False) or getattr(usuario_sesion, 'is_staff', False):
                es_admin = True
            elif hasattr(usuario_sesion, 'tiene_permiso') and (
                usuario_sesion.tiene_permiso('carnetizacion.gestionar') or usuario_sesion.tiene_permiso('personal.gestionar')
            ):
                es_admin = True
            elif hasattr(usuario_sesion, 'has_perm') and (
                usuario_sesion.has_perm('carnetizacion.gestionar') or usuario_sesion.has_perm('personal.gestionar')
            ):
                es_admin = True
            elif getattr(usuario_sesion, 'rol_id', None) == 'ADMINISTRADOR':
                es_admin = True

        if es_admin:
            nivel_acceso = 'ADMINISTRADOR'
        elif es_autenticado:
            nivel_acceso = 'CON_SESION'
        else:
            nivel_acceso = 'PUBLICO'

        # Preferencias de privacidad del trabajador
        pref_model = PreferenciaPrivacidadCarnetModel.objects.filter(employee_id=carnet.employee_id).first()
        preferencias = (
            validar_preferencias_privacidad(pref_model.preferencias)
            if (pref_model and pref_model.preferencias)
            else dict(PRIVACIDAD_POR_DEFECTO)
        )

        empleado = carnet.employee

        asig = (
            AsigTrabajoModel.objects.select_related('denominacioncargoid', 'DireccionGeneral')
            .filter(employee=empleado)
            .order_by('-fecha_actualizacion')
            .first()
        )
        cargo_str = str(asig.denominacioncargoid) if asig and asig.denominacioncargoid else 'Funcionario'
        codigo_cargo = getattr(asig.denominacioncargoid, 'codigo', '') if asig and asig.denominacioncargoid else ''
        ubicacion_str = asig.DireccionGeneral.direccion_general if asig and asig.DireccionGeneral else 'Oficina de Gestión Humana'

        contactos_qs = ContactoEmergenciaModel.objects.select_related('relacion').filter(empleado=empleado)[:3]
        contactos_lista = [
            {
                'nombre': c.nombre,
                'parentesco': str(c.relacion) if c.relacion else 'Contacto',
                'telefono': c.telefono,
            }
            for c in contactos_qs
        ]

        salud_datos = {'alergias': [], 'patologias': [], 'discapacidades': [], 'grupo_sanguineo': ''}
        ps = PerfilSaludModel.objects.select_related('grupo_sanguineo').prefetch_related(
            'alergias', 'patologiaCronica', 'discapacidad'
        ).filter(empleado=empleado).first()
        if ps:
            salud_datos['grupo_sanguineo'] = str(ps.grupo_sanguineo) if ps.grupo_sanguineo else ''
            salud_datos['alergias'] = [str(a) for a in ps.alergias.all()]
            salud_datos['patologias'] = [str(p) for p in ps.patologiaCronica.all()]
            salud_datos['discapacidades'] = [str(d) for d in ps.discapacidad.all()]

        def dato_permitido(clave: str) -> bool:
            if nivel_acceso == 'ADMINISTRADOR':
                return True
            nivel_dato = preferencias.get(clave, PRIVACIDAD_POR_DEFECTO.get(clave, 'SOLO_PERSONAL'))
            if nivel_dato == 'PUBLICO':
                return True
            if nivel_dato == 'CON_SESION' and nivel_acceso in ('CON_SESION', 'ADMINISTRADOR'):
                return True
            return False

        datos_filtrados: dict[str, Any] = {}

        if dato_permitido('nombre'):
            datos_filtrados['nombre'] = f"{empleado.nombres} {empleado.apellidos}".strip()
        else:
            datos_filtrados['nombre'] = f"{empleado.nombres[:1]}. {empleado.apellidos}".strip()

        if dato_permitido('foto'):
            datos_filtrados['foto_url'] = empleado.profile or ''

        if dato_permitido('cargo'):
            datos_filtrados['cargo'] = cargo_str
            if nivel_acceso in ('CON_SESION', 'ADMINISTRADOR') and codigo_cargo:
                datos_filtrados['codigo_cargo'] = codigo_cargo

        if dato_permitido('ubicacion'):
            datos_filtrados['ubicacion'] = ubicacion_str

        if dato_permitido('cedula'):
            datos_filtrados['cedula'] = empleado.cedulaidentidad
        else:
            datos_filtrados['cedula'] = None

        if dato_permitido('fecha_nacimiento'):
            datos_filtrados['fecha_nacimiento'] = empleado.fecha_nacimiento.strftime('%d/%m/%Y') if empleado.fecha_nacimiento else None
        else:
            datos_filtrados['fecha_nacimiento'] = None

        if dato_permitido('contactos_emergencia'):
            datos_filtrados['contactos_emergencia'] = contactos_lista
        else:
            datos_filtrados['contactos_emergencia'] = []

        salud_disp = dato_permitido('salud')
        if nivel_acceso in ('CON_SESION', 'ADMINISTRADOR'):
            datos_filtrados['salud'] = salud_datos
            salud_disp = True
        elif accion == 'APERTURA_MEDICA' and salud_disp:
            datos_filtrados['salud'] = salud_datos
        else:
            datos_filtrados['salud'] = None

        if nivel_acceso == 'ADMINISTRADOR':
            dv = DatosViviendaModel.objects.filter(empleado=empleado).first()
            datos_filtrados['direccion_vivienda'] = str(dv.direccion_completa or dv.calle_avenida or '') if dv else ''
            datos_filtrados['expediente_completo_autorizado'] = True

        if accion == 'APERTURA_MEDICA':
            accion_log = 'APERTURA_MEDICA'
        elif nivel_acceso == 'ADMINISTRADOR':
            accion_log = 'CONSULTA_ADMIN'
        elif nivel_acceso == 'CON_SESION':
            accion_log = 'ESCANEO_AUTENTICADO'
        else:
            accion_log = 'ESCANEO_PUBLICO'

        BitacoraAccesoQrModel.objects.create(
            security_hash=security_hash,
            carnet_id=carnet.id,
            accion=accion_log,
            usuario_id=usuario_id,
            ip=ip,
            user_agent=user_agent,
        )

        return FichaQr(
            es_valido=True,
            estado='VIGENTE',
            mensaje='Carnet vigente y verificado.',
            security_hash=security_hash,
            nivel_acceso=nivel_acceso,
            datos=datos_filtrados,
            salud_disponible=salud_disp,
            fecha_emision=carnet.fecha_emision.strftime('%d/%m/%Y') if carnet.fecha_emision else None,
            fecha_vencimiento=fecha_venc_str,
        )

    def verificar_carnet_integracion(self, security_hash: str) -> VerificacionCarnet:
        """Verificación para sistemas integrados: cédula siempre (canal autenticado), nunca salud ni foto."""
        from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
            CredencialExternaModel,
        )

        carnet = (
            CarnetEmitidoModel.objects.select_related('employee', 'employee__nacionalidad')
            .filter(security_hash=security_hash)
            .first()
        )
        if carnet is None:
            externa = (
                CredencialExternaModel.objects.select_related('tipo_credencial')
                .filter(security_hash=security_hash)
                .first()
            )
            if externa is None:
                return VerificacionCarnet(
                    valido=False, estado='NO_REGISTRADO', mensaje='Carnet no encontrado en el sistema.'
                )
            vence = externa.vigencia_hasta
            if externa.estado == CredencialExternaModel.Estado.ACTIVA and vence < timezone.now():
                return VerificacionCarnet(
                    valido=False,
                    estado='VENCIDO',
                    mensaje='Credencial vencida.',
                    fecha_vencimiento=vence.date().isoformat(),
                )
            if externa.estado != CredencialExternaModel.Estado.ACTIVA:
                estado = 'VENCIDO' if externa.estado == CredencialExternaModel.Estado.VENCIDA else 'ANULADO'
                return VerificacionCarnet(valido=False, estado=estado, mensaje='Credencial no vigente.')
            cedula_externa, nacionalidad_externa = normalizar_documento(externa.documento)
            return VerificacionCarnet(
                valido=True,
                estado='VIGENTE',
                cedula=cedula_externa,
                nacionalidad=nacionalidad_externa,
                documento=externa.documento,
                nombre=externa.nombre,
                tipo_credencial=str(externa.tipo_credencial_id),
                fecha_emision=externa.vigencia_desde.date().isoformat(),
                fecha_vencimiento=vence.date().isoformat(),
            )

        if not carnet.activo:
            return VerificacionCarnet(valido=False, estado='ANULADO', mensaje='Carnet anulado.')

        fecha_venc = vencimiento_de_carnet(carnet)
        if fecha_venc and timezone.now() > fecha_venc:
            return VerificacionCarnet(
                valido=False,
                estado='VENCIDO',
                mensaje='Carnet vencido.',
                fecha_vencimiento=fecha_venc.date().isoformat(),
            )

        empleado = carnet.employee
        asig = (
            AsigTrabajoModel.objects.select_related('estatusid')
            .filter(employee=empleado)
            .order_by('-pk')
            .first()
        )
        estatus = ((asig.estatusid.estatus or '').upper() if asig and asig.estatusid else '') or None
        es_pasivo = estatus != ESTATUS_ACTIVO and EmployeeEgresadoModel.objects.filter(employee=empleado).exists()
        return VerificacionCarnet(
            valido=True,
            estado='VIGENTE',
            cedula=empleado.cedulaidentidad,
            nacionalidad=(getattr(empleado.nacionalidad, 'codigo', None) or None) if empleado.nacionalidad_id else None,
            nombre=f"{empleado.nombres} {empleado.apellidos}".strip(),
            tipo_credencial='pasivo' if es_pasivo else 'trabajador',
            estado_laboral='PASIVO' if es_pasivo else estatus,
            fecha_emision=carnet.fecha_emision.date().isoformat() if carnet.fecha_emision else None,
            fecha_vencimiento=fecha_venc.date().isoformat() if fecha_venc else None,
        )

    def obtener_preferencia_privacidad(self, employee_id: int) -> dict[str, str]:
        obj =PreferenciaPrivacidadCarnetModel.objects.filter(employee_id=employee_id).first()
        if obj and obj.preferencias:
            return validar_preferencias_privacidad(obj.preferencias)
        return dict(PRIVACIDAD_POR_DEFECTO)

    def guardar_preferencia_privacidad(
        self,
        employee_id: int,
        preferencias: dict[str, str],
    ) -> dict[str, str]:
        validadas = validar_preferencias_privacidad(preferencias)
        PreferenciaPrivacidadCarnetModel.objects.update_or_create(
            employee_id=employee_id,
            defaults={'preferencias': validadas},
        )
        return validadas

    def obtener_privacidad_por_cedula(self, cedula: str) -> dict[str, str]:
        emp = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not emp:
            raise NotFoundError(f"Empleado con cédula '{cedula}' no encontrado")
        return self.obtener_preferencia_privacidad(emp.id)

    def guardar_privacidad_por_cedula(
        self,
        cedula: str,
        preferencias: dict[str, str],
    ) -> dict[str, str]:
        emp = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not emp:
            raise NotFoundError(f"Empleado con cédula '{cedula}' no encontrado")
        return self.guardar_preferencia_privacidad(emp.id, preferencias)

    def anular_carnet_por_egreso(
        self,
        employee_id: int,
        motivo: str = "Egreso de la institución",
    ) -> int:
        carnets = CarnetEmitidoModel.objects.filter(employee_id=employee_id, activo=True)
        count = 0
        for c in carnets:
            c.activo = False
            obs = c.observaciones or ""
            c.observaciones = f"{obs} [ANULADO: {motivo}]".strip()
            c.save(update_fields=['activo', 'observaciones'])
            BitacoraAccesoQrModel.objects.create(
                security_hash=c.security_hash,
                carnet_id=c.id,
                accion='ANULADO_POR_EGRESO',
                ip='127.0.0.1',
                user_agent='Sistema (evento egreso)',
            )
            count += 1
        return count
