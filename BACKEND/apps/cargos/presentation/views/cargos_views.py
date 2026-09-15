"""
Vistas delgadas de Cargos (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.cargos.application.dtos.cargos_dtos import CrearCargoDTO, CrearCargoEspecialDTO
from apps.cargos.application.use_cases.asignar_cargo import asignar_cargo, desasignar_cargo
from apps.cargos.application.use_cases.asignar_cargo_especial import asignar_cargo_especial
from apps.cargos.application.use_cases.cambiar_cargo import cambiar_cargo
from apps.cargos.application.use_cases.crear_cargo import crear_cargo
from apps.cargos.application.use_cases.gestionar_estatus_puesto import gestionar_estatus_puesto
from apps.cargos.application.use_cases.listar_cargos import listar_cargos
from apps.cargos.application.use_cases.listar_denominaciones import (
    listar_denominaciones,
    listar_denominaciones_especificas,
)
from apps.cargos.application.use_cases.gestionar_denominaciones import (
    actualizar_denominacion,
    actualizar_denominacion_especifica,
    crear_denominacion,
    crear_denominacion_especifica,
    eliminar_denominacion,
    eliminar_denominacion_especifica,
)
from apps.cargos.application.use_cases.prestamo_cargo import (
    crear_prestamo,
    finalizar_prestamo,
    listar_prestamos,
)
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.cargos.presentation.serializers.cargos_serializers import (
    AsignarCargoInputSerializer,
    CambiarCargoInputSerializer,
    CargoAsignacionSerializer,
    CrearCargoInputSerializer,
    CrearCargoEspecialInputSerializer,
    CrearPrestamoInputSerializer,
    DenominacionSerializer,
    DenominacionWriteSerializer,
    GestionarEstatusPuestoInputSerializer,
    PrestamoCargoSerializer,
)


class DenominacionesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.ver')]

    @extend_schema(tags=['Cargos'], summary='Listar denominaciones de cargos', responses={200: DenominacionSerializer(many=True)})
    def get(self, request):
        repo = RepoCargosORM()
        dtos = listar_denominaciones(repo)
        return ok(DenominacionSerializer(dtos, many=True).data)


class DenominacionCreateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.crear')]

    @extend_schema(tags=['Cargos'], summary='Crear denominación de cargo', request=DenominacionWriteSerializer, responses={201: DenominacionSerializer})
    def post(self, request):
        s = DenominacionWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_denominacion(RepoCargosORM(), s.validated_data['nombre'], s.validated_data.get('orden', 30))
        return ok(DenominacionSerializer(entidad).data, 'Denominación creada.', status=201)


class DenominacionUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.editar')]

    @extend_schema(tags=['Cargos'], summary='Actualizar denominación de cargo', request=DenominacionWriteSerializer, responses={200: DenominacionSerializer})
    def put(self, request, denominacion_id: int):
        s = DenominacionWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_denominacion(RepoCargosORM(), denominacion_id, s.validated_data['nombre'], s.validated_data.get('orden', 30))
        return ok(DenominacionSerializer(entidad).data, 'Denominación actualizada.')


class DenominacionDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.crear')]

    @extend_schema(tags=['Cargos'], summary='Eliminar denominación de cargo', responses={200: None})
    def delete(self, request, denominacion_id: int):
        eliminar_denominacion(RepoCargosORM(), denominacion_id)
        return ok(message='Denominación eliminada.')


class DenominacionEspecificaCreateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.crear')]

    @extend_schema(tags=['Cargos'], summary='Crear denominación específica', request=DenominacionWriteSerializer, responses={201: DenominacionSerializer})
    def post(self, request):
        s = DenominacionWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_denominacion_especifica(RepoCargosORM(), s.validated_data['nombre'], s.validated_data.get('orden', 30))
        return ok(DenominacionSerializer(entidad).data, 'Denominación específica creada.', status=201)


class DenominacionEspecificaUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.editar')]

    @extend_schema(tags=['Cargos'], summary='Actualizar denominación específica', request=DenominacionWriteSerializer, responses={200: DenominacionSerializer})
    def put(self, request, denominacion_id: int):
        s = DenominacionWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_denominacion_especifica(RepoCargosORM(), denominacion_id, s.validated_data['nombre'], s.validated_data.get('orden', 30))
        return ok(DenominacionSerializer(entidad).data, 'Denominación específica actualizada.')


class DenominacionEspecificaDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.crear')]

    @extend_schema(tags=['Cargos'], summary='Eliminar denominación específica', responses={200: None})
    def delete(self, request, denominacion_id: int):
        eliminar_denominacion_especifica(RepoCargosORM(), denominacion_id)
        return ok(message='Denominación específica eliminada.')


class DenominacionesEspecificasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.ver')]

    @extend_schema(tags=['Cargos'], summary='Listar denominaciones específicas', responses={200: DenominacionSerializer(many=True)})
    def get(self, request):
        repo = RepoCargosORM()
        dtos = listar_denominaciones_especificas(repo)
        return ok(DenominacionSerializer(dtos, many=True).data)


class CargosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.ver')]

    @extend_schema(tags=['Cargos'], summary='Listar puestos de trabajo con filtros', responses={200: CargoAsignacionSerializer(many=True)})
    def get(self, request):
        tipo_nomina = request.query_params.get('tipo_nomina_id')
        dependencia = request.query_params.get('dependencia_id')
        solo_vacantes = request.query_params.get('solo_vacantes', '').lower() in ('true', '1')

        tn_id = int(tipo_nomina) if tipo_nomina and str(tipo_nomina).isdigit() else None
        dep_id = int(dependencia) if dependencia and str(dependencia).isdigit() else None

        repo = RepoCargosORM()
        dtos = listar_cargos(
            repo,
            tipo_nomina_id=tn_id,
            dependencia_id=dep_id,
            solo_vacantes=solo_vacantes,
        )
        return ok(CargoAsignacionSerializer(dtos, many=True).data)


class CargosVacantesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.ver')]

    @extend_schema(tags=['Cargos'], summary='Listar únicamente puestos de trabajo vacantes', responses={200: CargoAsignacionSerializer(many=True)})
    def get(self, request):
        tipo_nomina = request.query_params.get('tipo_nomina_id')
        dependencia = request.query_params.get('dependencia_id')
        tn_id = int(tipo_nomina) if tipo_nomina and str(tipo_nomina).isdigit() else None
        dep_id = int(dependencia) if dependencia and str(dependencia).isdigit() else None

        repo = RepoCargosORM()
        dtos = listar_cargos(
            repo,
            tipo_nomina_id=tn_id,
            dependencia_id=dep_id,
            solo_vacantes=True,
        )
        return ok(CargoAsignacionSerializer(dtos, many=True).data)


class AsignarCargoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.asignar')]

    @extend_schema(tags=['Cargos'], summary='Asignar puesto de trabajo a un empleado', request=AsignarCargoInputSerializer, responses={200: CargoAsignacionSerializer})
    def post(self, request, cargo_id: int):
        serializer = AsignarCargoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cedula = serializer.validated_data['cedula']
        motivo_id = serializer.validated_data.get('motivo_id')

        repo = RepoCargosORM()
        dto = asignar_cargo(
            repo, cargo_id=cargo_id, cedula=cedula, motivo_id=motivo_id, usuario_id=request.user.pk,
        )
        return ok(CargoAsignacionSerializer(dto).data)


class DesasignarCargoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('cargos.asignar')]

    @extend_schema(tags=['Cargos'], summary='Desasignar puesto de trabajo (liberar vacante)', responses={200: CargoAsignacionSerializer})
    def post(self, request, cargo_id: int):
        repo = RepoCargosORM()
        dto = desasignar_cargo(repo, cargo_id=cargo_id, usuario_id=request.user.pk)
        return ok(CargoAsignacionSerializer(dto).data)


class CrearCargoView(APIView):
    """
    Crea un código de posición vacante (sin empleado asignado), réplica
    funcional de la pantalla "Crear Nuevo Código" del legado
    (`CodigoCatalogForm`). Usa el esquema de código NORMAL, distinto del
    prefijo especial de `AsignarCargoEspecialView`.
    """
    permission_classes = [IsAuthenticated, HasPermission('cargos.crear')]

    @extend_schema(
        tags=['Cargos'],
        summary='Crear un código de posición vacante',
        request=CrearCargoInputSerializer,
        responses={201: CargoAsignacionSerializer},
    )
    def post(self, request):
        serializer = CrearCargoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoCargosORM()
        dto = crear_cargo(repo, CrearCargoDTO(**serializer.validated_data))
        return ok(CargoAsignacionSerializer(dto).data, 'Código de posición creado correctamente.', status=201)


class AsignarCargoEspecialView(APIView):
    """
    Asignación de cargo especial con código autogenerable (gap #3 de la
    migración funcional de personal/activo; código gestionado por
    `apps.cargos.domain.services.generacion_codigo`, gap #5).

    ⚠️ A diferencia del legado (`assign_employee_special`), NO registra el
    historial de movimiento (`EmployeeMovementHistory`): ese subsistema
    pertenece a `apps.movimientos`, que todavía no existe, y `apps.cargos`
    no puede importar los modelos de `RAC` bajo `GATH.settings` (verificado:
    `RuntimeError`, `RAC` no está en `INSTALLED_APPS`). Ver el repositorio
    para el detalle completo del gap documentado.
    """
    permission_classes = [IsAuthenticated, HasPermission('cargos.asignar')]

    @extend_schema(
        tags=['Cargos'],
        summary='Asignar cargo especial (código autogenerable) a un empleado',
        request=CrearCargoEspecialInputSerializer,
        responses={200: CargoAsignacionSerializer},
    )
    def post(self, request):
        serializer = CrearCargoEspecialInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoCargosORM()
        dto = asignar_cargo_especial(
            repo, CrearCargoEspecialDTO(**serializer.validated_data), usuario_id=request.user.pk,
        )
        return ok(CargoAsignacionSerializer(dto).data, 'Empleado asignado y código especial generado correctamente.', status=201)


class CambiarCargoView(APIView):
    """
    POST /api/v1/cargos/<cargo_actual_id>/cambiar/ — Fase 2.5 del plan de
    reparación. Traslado de un empleado a un cargo vacante, con validación
    de vacante y registro de historial (`apps.movimientos`).
    """
    permission_classes = [IsAuthenticated, HasPermission('movimientos.registrar_traslado')]

    @extend_schema(tags=['Cargos'], summary='Trasladar empleado a otro cargo vacante', request=CambiarCargoInputSerializer, responses={200: CargoAsignacionSerializer})
    def post(self, request, cargo_actual_id: int):
        serializer = CambiarCargoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoCargosORM()
        dto = cambiar_cargo(
            repo,
            cargo_actual_id=cargo_actual_id,
            cargo_nuevo_id=serializer.validated_data['cargo_nuevo_id'],
            motivo_id=serializer.validated_data['motivo_id'],
            usuario_id=request.user.pk,
        )
        return ok(CargoAsignacionSerializer(dto).data, 'Traslado realizado correctamente.')


class GestionarEstatusPuestoView(APIView):
    """
    POST /api/v1/cargos/<cargo_id>/estatus/ — Fase 2.5 del plan de
    reparación. Bloqueo/suspensión/reactivación de un cargo, con registro de
    historial (`apps.movimientos`).
    """
    permission_classes = [IsAuthenticated, HasPermission('cargos.editar')]

    @extend_schema(tags=['Cargos'], summary='Gestionar estatus de un cargo (bloqueo/suspensión/reactivación)', request=GestionarEstatusPuestoInputSerializer, responses={200: CargoAsignacionSerializer})
    def post(self, request, cargo_id: int):
        serializer = GestionarEstatusPuestoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoCargosORM()
        dto = gestionar_estatus_puesto(
            repo,
            cargo_id=cargo_id,
            estatus_id=serializer.validated_data['estatus_id'],
            motivo_id=serializer.validated_data['motivo_id'],
            usuario_id=request.user.pk,
        )
        return ok(CargoAsignacionSerializer(dto).data, 'Estatus del cargo actualizado correctamente.')


class PrestamoCargoListCreateView(APIView):
    """
    GET/POST /api/v1/cargos/prestamos/ — Fase 2.5 del plan de reparación.
    Subsistema de préstamo de cargo / encargaduría.
    """
    def get_permissions(self):
        codigo = 'cargos.ver' if self.request.method == 'GET' else 'cargos.prestar'
        return [IsAuthenticated(), HasPermission(codigo)()]

    @extend_schema(tags=['Cargos'], summary='Listar préstamos de cargo (encargadurías)', responses={200: PrestamoCargoSerializer(many=True)})
    def get(self, request):
        solo_activos = request.query_params.get('solo_activos', '').lower() in ('true', '1')
        repo = RepoCargosORM()
        dtos = listar_prestamos(repo, solo_activos=solo_activos)
        return ok(PrestamoCargoSerializer(dtos, many=True).data)

    @extend_schema(tags=['Cargos'], summary='Registrar un préstamo de cargo (encargaduría)', request=CrearPrestamoInputSerializer, responses={201: PrestamoCargoSerializer})
    def post(self, request):
        serializer = CrearPrestamoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoCargosORM()
        dto = crear_prestamo(
            repo,
            cedula_encargado=datos['cedula_encargado'],
            cargo_id=datos['cargo_id'],
            motivo_id=datos['motivo_id'],
            fecha_inicio=datos['fecha_inicio'],
            fecha_fin=datos['fecha_fin'],
            usuario_id=request.user.pk,
        )
        return ok(PrestamoCargoSerializer(dto).data, 'Préstamo de cargo registrado correctamente.', status=201)


class PrestamoCargoFinalizarView(APIView):
    """POST /api/v1/cargos/prestamos/<prestamo_id>/finalizar/ — Fase 2.5 del plan de reparación."""
    permission_classes = [IsAuthenticated, HasPermission('cargos.revertir_prestamo')]

    @extend_schema(tags=['Cargos'], summary='Finalizar un préstamo de cargo (encargaduría)', responses={200: PrestamoCargoSerializer})
    def post(self, request, prestamo_id: int):
        repo = RepoCargosORM()
        dto = finalizar_prestamo(repo, prestamo_id=prestamo_id)
        return ok(PrestamoCargoSerializer(dto).data, 'Préstamo de cargo finalizado correctamente.')
