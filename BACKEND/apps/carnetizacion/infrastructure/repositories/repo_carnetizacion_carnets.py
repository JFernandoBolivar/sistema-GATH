"""Repositorio de carnetizaciÃ³n: carnets."""
from typing import Any
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from core.domain.catalogos import (
    ESTATUS_ACTIVO,
)
from core.domain.exceptions import NotFoundError, ValidationError
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.services.vigencia_carnet import (
    TIPO_VIGENCIA_PASIVO,
    TIPO_VIGENCIA_TRABAJADOR,
)
from apps.carnetizacion.infrastructure.codigo_qr import codigo_qr_unico
from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    carnet_a_entidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    MotivosEmisionModel,
    PlantillaCarnetModel,
)

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


from .repo_carnetizacion_comun import (
    _es_pasivo,
    vencimiento_segun_parametros,
)


class RepoCarnetsEmitidosMixin:
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

    def obtener_carnet_vigente(self, empleado_cedula: str) -> Carnet | None:
        fila = (
            CarnetEmitidoModel.objects.select_related('employee', 'motivo')
            .filter(employee__cedulaidentidad=empleado_cedula, activo=True)
            .order_by('-fecha_emision')
            .first()
        )
        return carnet_a_entidad(fila) if fila else None

    def motivo_id_para_reemision(self, motivo_reemision: str) -> int | None:
        from apps.carnetizacion.domain.services.motivo_reemision import (
            NOMBRE_CATALOGO_POR_MOTIVO,
        )

        nombre = NOMBRE_CATALOGO_POR_MOTIVO.get((motivo_reemision or '').strip().upper())
        if not nombre:
            return None
        fila = MotivosEmisionModel.objects.filter(nombre__iexact=nombre).first()
        return fila.pk if fila else None

    def emitir_carnet(
        self,
        empleado_cedula: str,
        motivo_id: int,
        observaciones: str | None = None,
        plantilla_id: str | int | None = None,
    ) -> Carnet:
        # L2-18: bloquear al empleado para que dos emisiones simultáneas no dejen
        # dos carnets activos, y validar el motivo antes de tocar nada.
        empleado = (
            EmployeeModel.objects.select_for_update()
            .filter(cedulaidentidad=empleado_cedula)
            .first()
        )
        if not empleado:
            raise NotFoundError(f"Empleado con cédula {empleado_cedula} no encontrado")
        if not MotivosEmisionModel.objects.filter(pk=motivo_id).exists():
            raise ValidationError(
                'El motivo de emisión seleccionado no existe.', campo='motivo_id',
            )

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
        activos = {
            cedula: fecha
            for cedula, fecha in (
                CarnetEmitidoModel.objects
                .filter(employee__cedulaidentidad__in=cedulas, activo=True)
                .values_list('employee__cedulaidentidad', 'fecha_emision')
            )
        }

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
            fecha_emision_activa = activos.get(e.cedulaidentidad)
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
                'carnet_activo_emitido_en': (
                    fecha_emision_activa.isoformat()
                    if tiene_carnet and fecha_emision_activa else None
                ),
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





