"""Repositorio de carnetizaciÃ³n: tipos plantillas."""
from typing import Any

from django.db import transaction
from django.db.models import Max, Q

from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet
from apps.carnetizacion.domain.services.plantilla_defecto import (
    NOMBRE_PLANTILLA_LEGACY,
    plantilla_defecto_heredada,
    plantilla_defecto_pasivo,
    plantilla_defecto_trabajador,
)
from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    plantilla_motor_a_entidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    PlantillaCarnetModel,
    TipoCredencialModel,
)
from core.domain.exceptions import NotFoundError, ValidationError

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.


class RepoPlantillasMixin:



    def _asegurar_plantilla_legacy(self) -> None:
        """Crea la maqueta heredada v1 si no existe (nunca duplica ni la activa)."""
        if PlantillaCarnetModel.objects.filter(estado='LEGACY').exists():
            return
        tipo = TipoCredencialModel.objects.filter(codigo='trabajador').first()
        if not tipo:
            return
        definicion = plantilla_defecto_heredada()
        legacy = PlantillaCarnetModel.objects.create(
            nombre=NOMBRE_PLANTILLA_LEGACY,
            tipo_credencial=tipo,
            ancho_mm=definicion['dimensiones']['ancho_mm'],
            alto_mm=definicion['dimensiones']['alto_mm'],
            orientacion=definicion['orientacion'],
            regla_criterio='legacy',
            regla_valor='*',
            estado='LEGACY',
            activa=False,
            version=1,
            definicion=definicion,
            descripcion=(
                'Maqueta heredada de CarnetTemplate: respaldo de los carnets emitidos antes '
                'del versionado. No se usa para emitir carnets nuevos.'
            ),
        )
        legacy.plantilla_raiz = legacy
        legacy.save(update_fields=['plantilla_raiz'])

    def _asegurar_plantilla_semilla(self) -> None:
        """Garantiza al menos una plantilla publicada y activa para trabajador y pasivo."""
        self._asegurar_catalogos_semilla()
        self._asegurar_plantilla_legacy()
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

    def listar_plantillas_paginado(
        self,
        codigo_tipo: str | None = None,
        estado: str | None = None,
        solo_activas: bool = False,
        busqueda: str = '',
        offset: int = 0,
        limite: int = 12,
    ) -> tuple[list[PlantillaCarnet], int]:
        self._asegurar_plantilla_semilla()
        qs = PlantillaCarnetModel.objects.select_related('tipo_credencial').all().order_by('-activa', '-version', '-created_at')
        if codigo_tipo:
            qs = qs.filter(tipo_credencial_id=codigo_tipo)
        if estado:
            qs = qs.filter(estado=estado)
        if solo_activas:
            qs = qs.filter(activa=True)
        if busqueda:
            qs = qs.filter(nombre__icontains=busqueda)
        total = qs.count()
        return [plantilla_motor_a_entidad(p) for p in qs[offset:offset + limite]], total

    def obtener_plantilla(self, plantilla_id: str | int) -> PlantillaCarnet | None:
        self._asegurar_plantilla_semilla()
        obj = PlantillaCarnetModel.objects.select_related('tipo_credencial').filter(pk=plantilla_id).first()
        return plantilla_motor_a_entidad(obj) if obj else None

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
        if obj.estado == 'LEGACY':
            raise ValidationError(
                'La plantilla heredada (LEGACY) es el respaldo de los carnets antiguos: '
                'no se publica ni se activa. Duplíquela para crear un diseño nuevo.'
            )

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
            # Un borrador sigue siendo editable: activarlo pondría en producción un diseño que
            # puede cambiar después de emitidos los carnets. Primero se publica.
            if obj.estado != 'publicada':
                raise ValidationError(
                    'Solo se pueden activar plantillas publicadas. Publique el borrador primero.'
                )
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
        if obj.estado == 'LEGACY':
            raise ValidationError(
                'La plantilla heredada (LEGACY) no se puede eliminar: es el respaldo de los '
                'carnets emitidos antes del versionado.'
            )
        if obj.activa:
            raise ValidationError(
                "No se puede eliminar la plantilla activa. Actívela otra versión o archívela primero."
            )
        # La raíz apunta a sí misma; sus versiones cuelgan de ella con borrado en cascada: borrar
        # la raíz se llevaba todas las versiones, incluida la activa.
        otras_versiones = (
            PlantillaCarnetModel.objects.filter(plantilla_raiz_id=obj.pk).exclude(pk=obj.pk).count()
        )
        if otras_versiones:
            raise ValidationError(
                f"La plantilla tiene {otras_versiones} versión(es) derivada(s): eliminarla las "
                "borraría también. Elimine primero las versiones que no use."
            )
        # Los carnets emitidos sin copia del diseño se reimprimen leyendo esta fila.
        emitidos = CarnetEmitidoModel.objects.filter(plantilla_id=str(obj.pk)).count()
        if emitidos:
            raise ValidationError(
                f"Hay {emitidos} carnet(s) emitido(s) con esta plantilla; no se puede eliminar "
                "porque se usa para reimprimirlos."
            )
        obj.delete()

