"""
Vistas delgadas de Carnetización (Reglas B4, B7, O44 - E3).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.storage.validacion_archivo import MAX_BYTES_IMAGEN, TIPOS_IMAGEN, clave_segura, validar_archivo
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission
from apps.carnetizacion.application.use_cases.consultar_qr import (
    consultar_ficha_qr_uc,
    guardar_privacidad_por_cedula_uc,
    obtener_privacidad_por_cedula_uc,
)
from apps.carnetizacion.application.use_cases.generar_pdf_carnet import generar_pdf_carnet
from apps.carnetizacion.application.use_cases.gestionar_campos import (
    crear_campo_personalizado_uc,
    eliminar_campo_personalizado_uc,
    listar_campos_credencial_uc,
)
from apps.carnetizacion.application.use_cases.gestionar_biblioteca import (
    eliminar_elemento_biblioteca_uc,
    listar_elementos_biblioteca_uc,
    subir_elemento_biblioteca_uc,
)
from apps.carnetizacion.application.use_cases.gestionar_plantillas import (
    activar_plantilla,
    activar_plantilla_motor,
    actualizar_borrador_plantilla,
    crear_plantilla_borrador,
    listar_plantillas,
    listar_plantillas_motor,
    listar_tipos_credencial,
    listar_versiones_plantilla,
    obtener_plantilla_activa,
    obtener_plantilla_detalle,
    publicar_plantilla,
)
from apps.carnetizacion.application.use_cases.listar_carnets import emitir_carnet, listar_carnets
from apps.carnetizacion.application.use_cases.revocar_carnet import revocar_carnet
from apps.carnetizacion.application.use_cases.validar_carnet import (
    validar_carnet_por_hash,
    validar_carnet_por_id,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
    RepoCarnetizacionORM,
)
from apps.carnetizacion.presentation.serializers.carnetizacion_serializers import (
    ActualizarPlantillaBorradorInputSerializer,
    CampoCredencialSerializer,
    CarnetSerializer,
    CrearCampoPersonalizadoInputSerializer,
    CrearPlantillaBorradorInputSerializer,
    ElementoBibliotecaSerializer,
    EmitirCarnetInputSerializer,
    FichaQrSerializer,
    PreferenciasPrivacidadInputSerializer,
    PlantillaCarnetSerializer,
    PlantillaMotorDetalleSerializer,
    PublicarPlantillaInputSerializer,
    SubirElementoBibliotecaInputSerializer,
    TipoCredencialSerializer,
    ValidacionCarnetSerializer,
)


class CarnetsListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Listar carnets emitidos', responses={200: CarnetSerializer(many=True)})
    def get(self, request):
        cedula = request.query_params.get('cedula')
        repo = RepoCarnetizacionORM()
        dtos = listar_carnets(repo, empleado_cedula=cedula)
        return ok(CarnetSerializer(dtos, many=True).data)

    @extend_schema(tags=['Carnetización'], summary='Emitir nuevo carnet institucional', request=EmitirCarnetInputSerializer, responses={200: CarnetSerializer})
    def post(self, request):
        serializer = EmitirCarnetInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoCarnetizacionORM()
        dto = repo.emitir_carnet(
            empleado_cedula=serializer.validated_data['empleado_cedula'],
            motivo_id=serializer.validated_data['motivo_id'],
            observaciones=serializer.validated_data.get('observaciones'),
            plantilla_id=serializer.validated_data.get('plantilla_id'),
        )
        return ok(CarnetSerializer(dto).data)


class CarnetPdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(
        tags=['Carnetización'],
        summary='Descargar carnet emitido en formato PDF',
        responses={(200, 'application/pdf'): OpenApiTypes.BINARY},
    )
    def get(self, request, carnet_id: int):
        repo = RepoCarnetizacionORM()
        pdf_bytes = generar_pdf_carnet(repo, carnet_id=carnet_id)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="carnet_{carnet_id}.pdf"'
        return response


class RevocarCarnetView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.revocar')]

    @extend_schema(tags=['Carnetización'], summary='Revocar o invalidar carnet emitido', responses={200: CarnetSerializer})
    def post(self, request, carnet_id: int):
        repo = RepoCarnetizacionORM()
        dto = revocar_carnet(repo, carnet_id=carnet_id)
        return ok(CarnetSerializer(dto).data, 'Carnet revocado exitosamente.')


class ValidarCarnetHashView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(tags=['Carnetización'], summary='Validar autenticidad de carnet por hash SHA-256', responses={200: ValidacionCarnetSerializer})
    def get(self, request, security_hash: str):
        repo = RepoCarnetizacionORM()
        resultado = validar_carnet_por_hash(repo, security_hash=security_hash)
        return ok(ValidacionCarnetSerializer(resultado).data)


class ValidarCarnetIdView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Consultar estado y validez de carnet por identificador', responses={200: ValidacionCarnetSerializer})
    def get(self, request, carnet_id: int):
        repo = RepoCarnetizacionORM()
        resultado = validar_carnet_por_id(repo, carnet_id=carnet_id)
        return ok(ValidacionCarnetSerializer(resultado).data)


class EstadisticasCarnetsView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Métricas y estadísticas de carnetización')
    def get(self, request):
        repo = RepoCarnetizacionORM()
        data = repo.obtener_estadisticas_carnets()
        data['ultimos_emitidos'] = CarnetSerializer(data.get('ultimos_emitidos', []), many=True).data
        return ok(data)


# ==============================================================================
# MOTOR DE PLANTILLAS Y CATÁLOGO DE CREDENCIALES (O44 - E3)
# ==============================================================================

class TiposCredencialListView(APIView):
    """Catálogo de tipos de credencial (trabajador, pasivo, etc.) — O44 - E3."""
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Listar tipos de credencial (catálogo)', responses={200: TipoCredencialSerializer(many=True)})
    def get(self, request):
        repo = RepoCarnetizacionORM()
        grupo = (request.query_params.get('grupo') or '').strip() or None
        tipos = listar_tipos_credencial(repo, solo_activos=True, grupo=grupo)
        return ok(TipoCredencialSerializer(tipos, many=True).data)


class PlantillaMotorListView(APIView):
    """
    Motor de plantillas por capas en mm, dos caras, tamaños libres (O44 - E3).
    Permiso propio: 'carnetizacion.disenar'.
    """
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Listar plantillas del motor por capas', responses={200: PlantillaMotorDetalleSerializer(many=True)})
    def get(self, request):
        codigo_tipo = request.query_params.get('tipo')
        estado = request.query_params.get('estado')
        solo_activas = request.query_params.get('activas', '').lower() in ('1', 'true')
        repo = RepoCarnetizacionORM()
        plantillas = listar_plantillas_motor(
            repo,
            codigo_tipo=codigo_tipo,
            estado=estado,
            solo_activas=solo_activas,
        )
        return ok(PlantillaMotorDetalleSerializer(plantillas, many=True).data)

    @extend_schema(tags=['Carnetización'], summary='Crear borrador de plantilla de carnet', request=CrearPlantillaBorradorInputSerializer, responses={201: PlantillaMotorDetalleSerializer})
    def post(self, request):
        serializer = CrearPlantillaBorradorInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        repo = RepoCarnetizacionORM()
        plantilla = crear_plantilla_borrador(
            repo,
            nombre=serializer.validated_data['nombre'],
            codigo_tipo=serializer.validated_data['codigo_tipo'],
            definicion=serializer.validated_data['definicion'],
            ancho_mm=serializer.validated_data.get('ancho_mm', 54.0),
            alto_mm=serializer.validated_data.get('alto_mm', 85.6),
            orientacion=serializer.validated_data.get('orientacion', 'vertical'),
            regla_criterio=serializer.validated_data.get('regla_criterio', 'todos'),
            regla_valor=serializer.validated_data.get('regla_valor', '*'),
            descripcion=serializer.validated_data.get('descripcion', ''),
            creado_por=(
                str(request.user.id)
                if request.user and request.user.is_authenticated and getattr(request.user, 'id', None) is not None
                else None
            ),
        )
        return ok(PlantillaMotorDetalleSerializer(plantilla).data, 'Borrador de plantilla creado.', status=201)


class PlantillaMotorDetalleView(APIView):
    """Obtener o actualizar definición de una plantilla por capas (O44 - E3)."""
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Obtener detalle de plantilla por capas', responses={200: PlantillaMotorDetalleSerializer})
    def get(self, request, plantilla_id: str):
        repo = RepoCarnetizacionORM()
        if str(plantilla_id).lower() == 'default':
            # El diseñador abre sin ?plantilla= y usa "default": devuelve la
            # plantilla activa del tipo indicado en lugar de intentar un UUID.
            plantilla = obtener_plantilla_activa(
                repo,
                codigo_tipo=request.query_params.get('tipo', 'trabajador'),
                regla_criterio=request.query_params.get('criterio', 'todos'),
                regla_valor=request.query_params.get('valor', '*'),
            )
        else:
            plantilla = obtener_plantilla_detalle(repo, plantilla_id=plantilla_id)
        return ok(PlantillaMotorDetalleSerializer(plantilla).data)

    @extend_schema(tags=['Carnetización'], summary='Actualizar borrador de plantilla', request=ActualizarPlantillaBorradorInputSerializer, responses={200: PlantillaMotorDetalleSerializer})
    def put(self, request, plantilla_id: str):
        serializer = ActualizarPlantillaBorradorInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        repo = RepoCarnetizacionORM()
        plantilla = actualizar_borrador_plantilla(
            repo,
            plantilla_id=plantilla_id,
            nombre=serializer.validated_data.get('nombre'),
            definicion=serializer.validated_data.get('definicion'),
            ancho_mm=serializer.validated_data.get('ancho_mm'),
            alto_mm=serializer.validated_data.get('alto_mm'),
            orientacion=serializer.validated_data.get('orientacion'),
            regla_criterio=serializer.validated_data.get('regla_criterio'),
            regla_valor=serializer.validated_data.get('regla_valor'),
            descripcion=serializer.validated_data.get('descripcion'),
        )
        return ok(PlantillaMotorDetalleSerializer(plantilla).data, 'Borrador actualizado exitosamente.')


class PlantillaMotorPublicarView(APIView):
    """Publicar plantilla: genera nueva versión inmutable y opcionalmente la activa (O44 - E3)."""
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Publicar versión de plantilla', request=PublicarPlantillaInputSerializer, responses={200: PlantillaMotorDetalleSerializer})
    def post(self, request, plantilla_id: str):
        serializer = PublicarPlantillaInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        repo = RepoCarnetizacionORM()
        plantilla = publicar_plantilla(
            repo,
            plantilla_id=plantilla_id,
            activar=serializer.validated_data.get('activar', True),
            publicado_por=str(request.user.id) if request.user and request.user.is_authenticated else None,
        )
        return ok(PlantillaMotorDetalleSerializer(plantilla).data, f'Plantilla publicada como versión {plantilla.version}.')


class PlantillaMotorActivarView(APIView):
    """
    Activar o reactivar versión publicada (O44 - E3).
    Garantiza la regla canónica: solo una activa por tipo de credencial y regla.
    """
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Activar o reactivar versión de plantilla', responses={200: PlantillaMotorDetalleSerializer})
    def post(self, request, plantilla_id: str):
        repo = RepoCarnetizacionORM()
        plantilla = activar_plantilla_motor(repo, plantilla_id=plantilla_id)
        return ok(PlantillaMotorDetalleSerializer(plantilla).data, f'Plantilla v{plantilla.version} activada.')


class PlantillaMotorVersionesView(APIView):
    """Historial completo de versiones de una plantilla raíz (O44 - E3)."""
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Historial de versiones de plantilla', responses={200: PlantillaMotorDetalleSerializer(many=True)})
    def get(self, request, plantilla_id: str):
        repo = RepoCarnetizacionORM()
        versiones = listar_versiones_plantilla(repo, plantilla_raiz_id=plantilla_id)
        return ok(PlantillaMotorDetalleSerializer(versiones, many=True).data)


class PlantillaMotorActivaView(APIView):
    """Obtener plantilla activa para un tipo de credencial y regla (para vista previa y renderizado)."""
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Obtener plantilla activa por tipo y regla')
    def get(self, request):
        codigo_tipo = request.query_params.get('tipo', 'trabajador')
        regla_criterio = request.query_params.get('criterio', 'todos')
        regla_valor = request.query_params.get('valor', '*')
        repo = RepoCarnetizacionORM()
        plantilla = obtener_plantilla_activa(
            repo,
            codigo_tipo=codigo_tipo,
            regla_criterio=regla_criterio,
            regla_valor=regla_valor,
        )
        return ok(PlantillaMotorDetalleSerializer(plantilla).data)


class ElementoBibliotecaListView(APIView):
    """
    Biblioteca compartida de logos, firmas e imágenes institucionales (O44 - E4).
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission('carnetizacion.ver')()]
        return [IsAuthenticated(), HasPermission('carnetizacion.disenar')()]

    @extend_schema(tags=['Carnetización'], summary='Listar recursos de la biblioteca')
    def get(self, request):
        categoria = request.query_params.get('categoria')
        repo = RepoCarnetizacionORM()
        elementos = listar_elementos_biblioteca_uc(repo, categoria=categoria)
        return ok(ElementoBibliotecaSerializer(elementos, many=True).data)

    @extend_schema(tags=['Carnetización'], summary='Subir recurso a la biblioteca', request=SubirElementoBibliotecaInputSerializer)
    def post(self, request):
        serializer = SubirElementoBibliotecaInputSerializer(data=request.data)
        if not serializer.is_valid():
            return fail(serializer.errors, 'Datos inválidos', 400)

        archivo = request.FILES.get('archivo')
        if not archivo:
            return fail({'archivo': ['Debe adjuntar un archivo gráfico.']}, 'Archivo requerido', 400)

        contenido = archivo.read()
        repo = RepoCarnetizacionORM()
        guardado = subir_elemento_biblioteca_uc(
            repo,
            nombre=serializer.validated_data['nombre'],
            categoria=serializer.validated_data['categoria'],
            contenido=contenido,
            nombre_archivo=archivo.name,
            creado_por=(
                str(request.user.id)
                if request.user and request.user.is_authenticated and getattr(request.user, 'id', None) is not None
                else None
            ),
            descripcion=serializer.validated_data.get('descripcion', ''),
        )
        return ok(ElementoBibliotecaSerializer(guardado).data, 'Recurso guardado en la biblioteca institucional.', 201)


class ElementoBibliotecaDetailView(APIView):
    """Detalle y eliminación de recurso de biblioteca (O44 - E4)."""
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Eliminar recurso de biblioteca')
    def delete(self, request, elemento_id: str):
        repo = RepoCarnetizacionORM()
        eliminar_elemento_biblioteca_uc(repo, elemento_id=elemento_id)
        return ok(None, 'Recurso eliminado de la biblioteca.')


class ElementoBibliotecaArchivoView(APIView):
    """Descarga/visualización autenticada de recurso de biblioteca (O44 - E4)."""
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Descargar/ver archivo de biblioteca')
    def get(self, request, elemento_id: str):
        repo = RepoCarnetizacionORM()
        data, mime_type, filename = repo.obtener_archivo_biblioteca(elemento_id)
        response = HttpResponse(data, content_type=mime_type)
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        response['Cache-Control'] = 'private, max-age=86400'
        return response


# ==============================================================================
# REGISTRO DE CAMPOS AUTORIZADOS Y PERSONALIZADOS (O44 - E5)
# ==============================================================================

class CampoCredencialListView(APIView):
    """
    Lista de campos autorizados del expediente y campos personalizados (O44 - E5).
    """
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Listar campos autorizados y personalizados')
    def get(self, request):
        tipo = request.query_params.get('tipo', 'trabajador')
        repo = RepoCarnetizacionORM()
        campos = listar_campos_credencial_uc(repo, tipo_credencial=tipo)
        return ok(CampoCredencialSerializer(campos, many=True).data)


class CampoPersonalizadoCreateView(APIView):
    """
    Creación de campos personalizados para credenciales (O44 - E5).
    """
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Registrar campo personalizado', request=CrearCampoPersonalizadoInputSerializer)
    def post(self, request):
        serializer = CrearCampoPersonalizadoInputSerializer(data=request.data)
        if not serializer.is_valid():
            return fail(serializer.errors, 'Datos del campo inválidos', 400)

        repo = RepoCarnetizacionORM()
        creado = crear_campo_personalizado_uc(
            repo,
            codigo=serializer.validated_data['codigo'],
            etiqueta=serializer.validated_data['etiqueta'],
            grupo=serializer.validated_data.get('grupo', 'personalizado'),
            tipo_credencial=serializer.validated_data.get('tipo_credencial', 'todos'),
            sensible=serializer.validated_data.get('sensible', False),
            descripcion=serializer.validated_data.get('descripcion', ''),
            valor_ejemplo=serializer.validated_data.get('valor_ejemplo', ''),
        )
        return ok(CampoCredencialSerializer(creado).data, 'Campo personalizado registrado.', 201)


class CampoPersonalizadoDetailView(APIView):
    """
    Eliminación de campo personalizado (O44 - E5).
    """
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Eliminar campo personalizado')
    def delete(self, request, codigo: str):
        repo = RepoCarnetizacionORM()
        eliminar_campo_personalizado_uc(repo, codigo=codigo)
        return ok(None, f"Campo personalizado '{codigo}' eliminado.")


# ==============================================================================
# VISTAS LEGACY RETROCOMPATIBLES
# ==============================================================================

class PlantillasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Listar plantillas de carnet (legacy)', responses={200: PlantillaCarnetSerializer(many=True)})
    def get(self, request):
        repo = RepoCarnetizacionORM()
        dtos = listar_plantillas(repo)
        return ok(PlantillaCarnetSerializer(dtos, many=True).data)


class PlantillaImagenView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(
        tags=['Carnetización'],
        summary='Obtener imagen de fondo de plantilla',
        responses={(200, 'image/png'): OpenApiTypes.BINARY},
    )
    def get(self, request, plantilla_id: int):
        repo = RepoCarnetizacionORM()
        ruta = repo.ruta_imagen_plantilla(plantilla_id)
        ext = ruta.rsplit('.', 1)[-1].lower() if '.' in ruta else 'png'
        content_type = 'image/jpeg' if ext in ('jpg', 'jpeg') else 'image/png'
        with open(ruta, 'rb') as f:
            return HttpResponse(f.read(), content_type=content_type)


class ActivarPlantillaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Activar plantilla de carnet', responses={200: PlantillaCarnetSerializer})
    def post(self, request, plantilla_id: int):
        repo = RepoCarnetizacionORM()
        dto = activar_plantilla(repo, plantilla_id=plantilla_id)
        return ok(PlantillaCarnetSerializer(dto).data)


class PlantillaCreateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.disenar')]

    @extend_schema(tags=['Carnetización'], summary='Subir imagen de plantilla de carnet')
    def post(self, request):
        from rest_framework import serializers as _sr
        class _S(_sr.Serializer):
            nombre = _sr.CharField(min_length=2, max_length=100, trim_whitespace=True)
            imagen = _sr.ImageField()
            activar = _sr.BooleanField(required=False, default=False)
        s = _S(data=request.data)
        s.is_valid(raise_exception=True)
        repo = RepoCarnetizacionORM()
        plantilla = repo.crear_plantilla(
            nombre=s.validated_data['nombre'],
            imagen=s.validated_data['imagen'],
            activar=s.validated_data.get('activar', False),
        )
        return ok(PlantillaCarnetSerializer(plantilla).data, 'Plantilla subida.', status=201)


class CarnetBuscarPersonalView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Buscar personal para emisión de carnet')
    def get(self, request):
        query = (request.query_params.get('q', '') or '').strip()[:50]
        repo = RepoCarnetizacionORM()
        resultados = repo.buscar_personal(query)
        return ok(resultados)


class MotivosEmisionListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Listar motivos de emisión de carnet')
    def get(self, request):
        from apps.carnetizacion.infrastructure.models.carnetizacion_models import MotivosEmisionModel
        motivos = MotivosEmisionModel.objects.all().order_by('nombre')
        return ok([{"id": m.id, "nombre": m.nombre} for m in motivos])


class CarnetActualizarVistaPreviaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Actualizar vista previa HTML del carnet')
    def post(self, request, cedula: str):
        nombre = request.data.get('nombre')
        repo = RepoCarnetizacionORM()
        html = repo.generar_vista_previa(cedula=cedula, nombre_override=nombre)
        return ok({"vista_previa": html})


class CarnetSubirFotoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.emitir')]

    @extend_schema(tags=['Carnetización'], summary='Subir foto de carnet y actualizar vista previa')
    def post(self, request, cedula: str):
        archivo = request.FILES.get('foto') or request.FILES.get('file')
        if not archivo:
            return fail('No se envió ninguna foto', status=400)

        repo = RepoCarnetizacionORM()
        if not repo.empleado_existe(cedula):
            return fail(f"Empleado con cédula {cedula} no encontrado", status=404)

        contenido, tipo, ext = validar_archivo(archivo, TIPOS_IMAGEN, MAX_BYTES_IMAGEN)
        clave = clave_segura('perfiles', ext)
        SeaweedFSStorage().subir(clave, contenido, tipo.mime)
        repo.registrar_foto_perfil(cedula, clave)

        nombre = request.data.get('nombre')
        html = repo.generar_vista_previa(cedula=cedula, nombre_override=nombre, foto_bytes=contenido)
        return ok({"vista_previa": html, "filename": archivo.name, "message": "Foto subida exitosamente"})


class CarnetGenerarView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.emitir')]

    @extend_schema(
        tags=['Carnetización'],
        summary='Emitir carnet y descargar PDF generado',
        responses={(200, 'application/pdf'): OpenApiTypes.BINARY},
    )
    def post(self, request, cedula: str):
        motivo_id = request.data.get('motivo_id')
        observaciones = request.data.get('observaciones', '')
        plantilla_id = request.data.get('plantilla_id')
        datos_editados = request.data.get('datos_editados', {})
        nombre_override = datos_editados.get('nombre') if isinstance(datos_editados, dict) else None

        repo = RepoCarnetizacionORM()
        carnet = repo.emitir_carnet(
            empleado_cedula=cedula,
            motivo_id=int(motivo_id) if motivo_id else 1,
            observaciones=observaciones,
            plantilla_id=plantilla_id,
        )
        pdf_bytes = repo.generar_pdf(carnet_id=carnet.id, nombre_override=nombre_override)
        # O46-A: el endpoint debe devolver el PDF binario, no un sobre JSON en base64.
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="carnet_{cedula}.pdf"'
        return response


# ==============================================================================
# QR Y PRIVACIDAD POR DATO (O44 - E9)
# ==============================================================================

def _aplicar_cabeceras_anti_rastreo(response: HttpResponse) -> HttpResponse:
    response['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
    response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response


class FichaQrPublicaView(APIView):
    """
    Consulta pública y segura de la ficha de carnetización a través del código QR (O44 - E9).
    Límites de tasa (throttling), fuera de buscadores (X-Robots-Tag), y privacidad por dato.
    """
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle, UserRateThrottle]

    @extend_schema(tags=['Carnetización'], summary='Consultar ficha de verificación QR del carnet', responses={200: FichaQrSerializer})
    def get(self, request, security_hash: str):
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        ua = request.META.get('HTTP_USER_AGENT', '')
        repo = RepoCarnetizacionORM()
        ficha = consultar_ficha_qr_uc(
            repo,
            security_hash=security_hash,
            usuario_sesion=request.user,
            ip=ip,
            user_agent=ua,
            accion='ESCANEO',
        )
        resp = ok(FichaQrSerializer(ficha).data, ficha.mensaje)
        return _aplicar_cabeceras_anti_rastreo(resp)


class FichaQrMedicaView(APIView):
    """
    Apertura explícita de información médica en emergencias (O44 - E9).
    Registra el acceso en la bitácora de auditoría.
    """
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle, UserRateThrottle]

    @extend_schema(tags=['Carnetización'], summary='Apertura auditada de datos médicos de emergencia', responses={200: FichaQrSerializer})
    def post(self, request, security_hash: str):
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        ua = request.META.get('HTTP_USER_AGENT', '')
        repo = RepoCarnetizacionORM()
        ficha = consultar_ficha_qr_uc(
            repo,
            security_hash=security_hash,
            usuario_sesion=request.user,
            ip=ip,
            user_agent=ua,
            accion='APERTURA_MEDICA',
        )
        resp = ok(FichaQrSerializer(ficha).data, 'Información médica consultada y registrada en bitácora.')
        return _aplicar_cabeceras_anti_rastreo(resp)


class AutogestionPrivacidadCarnetView(APIView):
    """
    Configuración de privacidad por dato en Autogestión (O44 - E9).
    Permite al titular elegir qué datos son Públicos, Con sesión o Solo Personal.
    Invariante: la dirección de vivienda jamás puede configurarse como pública.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Carnetización'], summary='Obtener preferencias de privacidad del carnet')
    def get(self, request):
        cedula = getattr(request.user, 'cedula_id', None)
        if not cedula:
            return fail("El usuario autenticado no tiene un expediente asociado.", status=400)
        repo = RepoCarnetizacionORM()
        prefs = obtener_privacidad_por_cedula_uc(repo, cedula=str(cedula))
        return ok(prefs)

    @extend_schema(tags=['Carnetización'], summary='Actualizar preferencias de privacidad del carnet', request=PreferenciasPrivacidadInputSerializer)
    def put(self, request):
        cedula = getattr(request.user, 'cedula_id', None)
        if not cedula:
            return fail("El usuario autenticado no tiene un expediente asociado.", status=400)
        serializer = PreferenciasPrivacidadInputSerializer(data=request.data)
        if not serializer.is_valid():
            return fail(serializer.errors, "Datos de preferencias inválidos", 400)

        repo = RepoCarnetizacionORM()
        actualizadas = guardar_privacidad_por_cedula_uc(
            repo,
            cedula=str(cedula),
            preferencias=serializer.validated_data['preferencias'],
        )
        return ok(actualizadas, "Preferencias de privacidad guardadas.")
