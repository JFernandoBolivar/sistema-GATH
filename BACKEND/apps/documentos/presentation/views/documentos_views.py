"""
Vistas delgadas de las plantillas de documentos y de los documentos generados (F-1).
Envelope unificado `ok()` y permisos PBAC: `documentos.ver_plantillas` / `documentos.gestionar_plantillas`.
"""
from dataclasses import asdict

from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.views import APIView

from apps.documentos.application.use_cases import gestionar_plantillas as uc
from apps.documentos.domain.entities.documentos import FirmaDocumento, Plantilla, VersionPlantilla
from apps.documentos.application.use_cases import generar_documento as gen
from apps.documentos.domain.services.catalogo_procesos import (
    GRUPO_PUNTO_CUENTA,
    PROCESO_BAJO_DEMANDA,
    etiqueta_proceso,
    obtener_proceso,
    procesos_de_grupo,
    procesos_para_interfaz,
)
from apps.documentos.domain.services.variables_documento import catalogo_para_interfaz
from apps.documentos.domain.value_objects import esquema_documento as esq
from apps.documentos.infrastructure import almacen as almacen_mod
from apps.documentos.infrastructure.pdf.motor import InspectorPdfDocumentos, MotorPdfDocumentos
from apps.documentos.infrastructure.proveedor_trabajador import (
    SUJETO_TRABAJADOR,
    ProveedorDatosTrabajadorORM,
    normalizar_cedula_trabajador,
)
from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoDocumentosORM, RepoPlantillasORM
from core.domain.exceptions import NotFoundError, ValidationError
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission, usuario_tiene_permiso

TAG = ['Documentos']
VER = HasPermission('documentos.ver_plantillas')
GESTIONAR = HasPermission('documentos.gestionar_plantillas')
GENERAR_BAJO_DEMANDA = HasPermission('documentos.generar_bajo_demanda')
PERMISO_VER = 'documentos.ver_plantillas'
PERMISO_GENERAR = 'documentos.generar_bajo_demanda'
PERMISO_VER_MOVIMIENTOS = 'movimientos.ver'


def _actor(request) -> int | None:
    pk = getattr(request.user, 'pk', None)
    return pk if isinstance(pk, int) else None


def _grupo_de(codigo: str) -> str:
    proceso = obtener_proceso(codigo)
    return proceso.grupo if proceso else ''


def _plantilla_dict(p: Plantilla, completa: bool = True) -> dict:
    base = {
        'id': p.id, 'codigo': p.codigo, 'nombre': p.nombre, 'descripcion': p.descripcion, 'modo': p.modo,
        'proceso': p.proceso, 'proceso_etiqueta': etiqueta_proceso(p.proceso), 'grupo': _grupo_de(p.proceso),
        'firmante': p.firmante, 'requiere_firma_clic': p.requiere_firma_clic,
        'activa': p.activa, 'estado': p.estado, 'ultima_version': p.ultima_version,
        'cambios_sin_publicar': p.cambios_sin_publicar, 'tiene_fondo': bool(p.fondo_clave),
        'actualizada_en': p.actualizada_en.isoformat() if p.actualizada_en else None,
    }
    if completa:
        base.update({'definicion': p.definicion, 'campos_propios': p.campos_propios,
                     'fondo_nombre': p.fondo_nombre, 'fondo_paginas': p.fondo_paginas})
    return base


def _version_dict(v: VersionPlantilla) -> dict:
    return {'id': v.id, 'numero': v.numero, 'modo': v.modo, 'metadatos': v.metadatos,
            'definicion_sha256': v.definicion_sha256, 'publicada_por_id': v.publicada_por_id,
            'publicada_en': v.publicada_en.isoformat() if v.publicada_en else None}


def _firma_dict(f: FirmaDocumento) -> dict:
    d = asdict(f)
    d['firmado_en'] = f.firmado_en.isoformat()
    return d


class VariablesView(APIView):
    """GET /api/v1/documentos/variables/ — catálogo de variables y límites del esquema."""
    permission_classes = [IsAuthenticated, VER]

    @extend_schema(tags=TAG, summary='Catálogo de variables que una plantilla puede usar')
    def get(self, request):
        proceso = request.query_params.get('proceso') or None
        if proceso is not None and obtener_proceso(proceso) is None:
            raise ValidationError(f'Proceso de documento desconocido: «{proceso}».', campo='proceso')
        return ok({
            'proceso': proceso,
            'procesos': procesos_para_interfaz(),
            'variables': catalogo_para_interfaz(proceso=proceso),
            'tipos_bloque': list(esq.TIPOS_BLOQUE),
            'tipos_campo_overlay': list(esq.TIPOS_CAMPO_OVERLAY),
            'tipos_campo_propio': ['texto', 'texto_largo', 'fecha', 'si_no', 'opcion'],
            'modos': list(esq.MODOS), 'firmantes': list(esq.FIRMANTES),
            'limites': {'max_bytes_fondo': uc.MAX_BYTES_FONDO, 'max_bytes_logo': uc.MAX_BYTES_LOGO},
        })


def _alertas_punto_cuenta(repo, proceso: str | None, grupo: str | None) -> list[dict]:
    """Procesos del Punto de Cuenta sin plantilla publicada y activa: sin ella no se puede emitir su documento."""
    if grupo not in (None, GRUPO_PUNTO_CUENTA):
        return []
    alertas = []
    for p in procesos_de_grupo(GRUPO_PUNTO_CUENTA):
        if proceso is not None and p.codigo != proceso:
            continue
        if repo.obtener_activa_por_proceso(p.codigo) is None:
            alertas.append({
                'proceso': p.codigo, 'etiqueta': p.etiqueta,
                'mensaje': f'Falta la plantilla del Punto de Cuenta de {p.etiqueta_corta}.',
            })
    return alertas


class PlantillasView(APIView):
    """GET (lista) / POST (crear) /api/v1/documentos/plantillas/"""
    def get_permissions(self):
        return [IsAuthenticated(), (VER if self.request.method == 'GET' else GESTIONAR)()]

    @extend_schema(tags=TAG, summary='Listar las plantillas de documentos')
    def get(self, request):
        proceso = request.query_params.get('proceso') or None
        grupo = request.query_params.get('grupo') or None
        if proceso is not None and obtener_proceso(proceso) is None:
            raise ValidationError(f'Proceso de documento desconocido: «{proceso}».', campo='proceso')
        repo = RepoPlantillasORM()
        plantillas = [_plantilla_dict(p, completa=False) for p in repo.listar(proceso=proceso, grupo=grupo)]
        if request.query_params.get('incluir_alertas') not in ('1', 'true', 'True'):
            return ok(plantillas)
        return ok({'plantillas': plantillas, 'alertas': _alertas_punto_cuenta(repo, proceso, grupo)})

    @extend_schema(tags=TAG, summary='Crear una plantilla (borrador)', request=OpenApiTypes.OBJECT)
    def post(self, request):
        p = uc.crear_plantilla(RepoPlantillasORM(), dict(request.data), _actor(request))
        return ok(_plantilla_dict(p), 'Plantilla creada como borrador.', status=201)


class PlantillaDetalleView(APIView):
    """GET / PUT /api/v1/documentos/plantillas/<id>/ (PUT guarda el borrador)."""
    def get_permissions(self):
        return [IsAuthenticated(), (VER if self.request.method == 'GET' else GESTIONAR)()]

    @extend_schema(tags=TAG, summary='Obtener una plantilla con su borrador')
    def get(self, request, id):
        return ok(_plantilla_dict(uc.obtener_plantilla(RepoPlantillasORM(), id)))

    @extend_schema(tags=TAG, summary='Guardar el borrador de la plantilla', request=OpenApiTypes.OBJECT)
    def put(self, request, id):
        p = uc.actualizar_borrador(RepoPlantillasORM(), id, dict(request.data), _actor(request))
        return ok(_plantilla_dict(p), 'Borrador guardado.')


class PlantillaPublicarView(APIView):
    permission_classes = [IsAuthenticated, GESTIONAR]

    @extend_schema(tags=TAG, summary='Publicar: crea una versión inmutable', request=None)
    def post(self, request, id):
        repo = RepoPlantillasORM()
        v = uc.publicar(repo, id, _actor(request))
        return ok({'version': _version_dict(v), 'plantilla': _plantilla_dict(uc.obtener_plantilla(repo, id))},
                  f'Versión {v.numero} publicada.', status=201)


class PlantillaDuplicarView(APIView):
    permission_classes = [IsAuthenticated, GESTIONAR]

    @extend_schema(tags=TAG, summary='Duplicar una plantilla como borrador nuevo', request=None)
    def post(self, request, id):
        return ok(_plantilla_dict(uc.duplicar(RepoPlantillasORM(), id, _actor(request))), 'Plantilla duplicada.', status=201)


class PlantillaActivarView(APIView):
    permission_classes = [IsAuthenticated, GESTIONAR]

    @extend_schema(tags=TAG, summary='Activar o desactivar la plantilla', request=OpenApiTypes.OBJECT)
    def post(self, request, id):
        activa = request.data.get('activa')
        if not isinstance(activa, bool):
            raise ValidationError('Indique «activa» como verdadero o falso.', campo='activa')
        p = uc.fijar_activa(RepoPlantillasORM(), id, activa)
        return ok(_plantilla_dict(p), 'Plantilla activada.' if activa else 'Plantilla desactivada.')


class PlantillaVersionesView(APIView):
    permission_classes = [IsAuthenticated, VER]

    @extend_schema(tags=TAG, summary='Versiones publicadas de la plantilla')
    def get(self, request, id):
        return ok([_version_dict(v) for v in uc.listar_versiones(RepoPlantillasORM(), id)])


class PlantillaFondoView(APIView):
    """POST /api/v1/documentos/plantillas/<id>/fondo/ (multipart `archivo`): PDF oficial de fondo."""
    permission_classes = [IsAuthenticated, GESTIONAR]
    parser_classes = [MultiPartParser]

    @extend_schema(tags=TAG, summary='Subir el PDF de fondo (formato de terceros)', request=OpenApiTypes.OBJECT)
    def post(self, request, id):
        archivo = request.FILES.get('archivo')
        if archivo is None:
            raise ValidationError('Adjunte el PDF en el campo «archivo».', campo='archivo')
        if not (archivo.name or '').lower().endswith('.pdf'):
            raise ValidationError('El archivo debe ser un PDF (.pdf).', campo='archivo')
        if archivo.size > uc.MAX_BYTES_FONDO:
            raise ValidationError('El PDF debe pesar hasta 15 MB.', campo='archivo')
        p = uc.subir_fondo(RepoPlantillasORM(), almacen_mod.obtener_almacen(), InspectorPdfDocumentos(), id,
                           archivo.read(), archivo.name, _actor(request))
        return ok(_plantilla_dict(p), 'PDF de fondo cargado.')


class PlantillaFondoPaginaView(APIView):
    """GET /api/v1/documentos/plantillas/<id>/fondo/paginas/<n>/ — PNG de la página n del PDF de fondo."""
    permission_classes = [IsAuthenticated, VER]

    @extend_schema(tags=TAG, summary='Imagen (PNG) de una página del PDF de fondo', responses={(200, 'image/png'): OpenApiTypes.BINARY})
    def get(self, request, id, numero):
        png = uc.pagina_de_fondo(RepoPlantillasORM(), almacen_mod.obtener_almacen(), MotorPdfDocumentos(), id, numero)
        resp = HttpResponse(png, content_type='image/png')
        resp['Cache-Control'] = 'private, max-age=300'
        resp['X-Content-Type-Options'] = 'nosniff'
        return resp


class PlantillaLogoView(APIView):
    """POST /api/v1/documentos/plantillas/<id>/logo/ (multipart `archivo`): logo propio del encabezado."""
    permission_classes = [IsAuthenticated, GESTIONAR]
    parser_classes = [MultiPartParser]

    @extend_schema(tags=TAG, summary='Subir el logo propio del encabezado', request=OpenApiTypes.OBJECT)
    def post(self, request, id):
        archivo = request.FILES.get('archivo')
        if archivo is None:
            raise ValidationError('Adjunte la imagen en el campo «archivo».', campo='archivo')
        if archivo.size > uc.MAX_BYTES_LOGO:
            raise ValidationError('El logo debe pesar hasta 2 MB.', campo='archivo')
        p = uc.subir_logo(RepoPlantillasORM(), almacen_mod.obtener_almacen(), id, archivo.read(), _actor(request))
        return ok(_plantilla_dict(p), 'Logo cargado.')


class PlantillaVistaPreviaView(APIView):
    """POST /api/v1/documentos/plantillas/<id>/vista-previa/ — PDF con datos de ejemplo (de lo guardado o de `definicion` sin guardar)."""
    permission_classes = [IsAuthenticated, VER]
    parser_classes = [JSONParser]

    @extend_schema(tags=TAG, summary='Vista previa en PDF con datos de ejemplo', request=OpenApiTypes.OBJECT,
                   responses={(200, 'application/pdf'): OpenApiTypes.BINARY})
    def post(self, request, id):
        cambios = {k: request.data[k] for k in ('definicion', 'campos_propios', 'proceso') if k in request.data}
        pdf = uc.vista_previa(RepoPlantillasORM(), almacen_mod.obtener_almacen(), MotorPdfDocumentos(), id, cambios)
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = 'inline; filename="vista_previa_documento.pdf"'
        resp['Cache-Control'] = 'private, no-store'
        resp['X-Content-Type-Options'] = 'nosniff'
        return resp


class AccesoDocumentoGenerado(BasePermission):
    """Ver documentos, descargar los vinculados a un trabajador o `movimiento:*` con `movimientos.ver`."""

    message = 'No posee un permiso que autorice la descarga de este documento.'

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return any(usuario_tiene_permiso(request.user, p) for p in (
            PERMISO_VER, PERMISO_GENERAR, PERMISO_VER_MOVIMIENTOS,
        ))

    def has_object_permission(self, request, view, documento) -> bool:
        if usuario_tiene_permiso(request.user, PERMISO_VER):
            return True
        if usuario_tiene_permiso(request.user, PERMISO_GENERAR) and documento.trabajador_cedula:
            return True
        return documento.proceso.startswith('movimiento:') and usuario_tiene_permiso(
            request.user, PERMISO_VER_MOVIMIENTOS,
        )


class DocumentoGeneradoView(APIView):
    """GET /api/v1/documentos/generados/<id>/ — metadatos, snapshot y firmas."""
    permission_classes = [IsAuthenticated, AccesoDocumentoGenerado]

    @extend_schema(tags=TAG, summary='Datos de un documento generado y sus firmas')
    def get(self, request, id):
        repo = RepoDocumentosORM()
        d = repo.obtener_generado(id)
        if d is None:
            raise NotFoundError('El documento no existe.')
        self.check_object_permissions(request, d)
        return ok({
            'id': d.id, 'plantilla_id': d.plantilla_id, 'version_numero': d.version_numero, 'sujeto_tipo': d.sujeto_tipo,
            'sujeto_id': d.sujeto_id, 'pdf_sha256': d.pdf_sha256, 'datos_snapshot': d.datos_snapshot,
            'plantilla_codigo': d.plantilla_codigo, 'plantilla_nombre': d.plantilla_nombre,
            'proceso': d.proceso, 'proceso_etiqueta': d.proceso_etiqueta,
            'generado_en': d.generado_en.isoformat() if d.generado_en else None,
            'firmas': [_firma_dict(f) for f in repo.firmas_de(d.id)],
        })


class DocumentoGeneradoArchivoView(APIView):
    """GET /api/v1/documentos/generados/<id>/archivo/ — PDF por streaming, con registro en la bitácora (H-3)."""
    permission_classes = [IsAuthenticated, AccesoDocumentoGenerado]

    @extend_schema(tags=TAG, summary='Descargar el PDF de un documento generado',
                   responses={(200, 'application/pdf'): OpenApiTypes.BINARY})
    def get(self, request, id):
        d = RepoDocumentosORM().obtener_generado(id)
        if d is None:
            raise NotFoundError('El documento no existe.')
        self.check_object_permissions(request, d)
        return respuesta_archivo(almacen_mod.obtener_almacen(), d.pdf_clave, cache='private, no-store', mime='application/pdf',
                                 request=request, recurso='documento_generado', recurso_id=d.id)


def _resumen_generado(d) -> dict:
    return {
        'id': d.id, 'plantilla_id': d.plantilla_id, 'plantilla_codigo': d.plantilla_codigo,
        'plantilla_nombre': d.plantilla_nombre, 'proceso': d.proceso, 'proceso_etiqueta': d.proceso_etiqueta,
        'version_numero': d.version_numero, 'pdf_sha256': d.pdf_sha256,
        'generado_en': d.generado_en.isoformat() if d.generado_en else None,
    }


def _cedula_del_trabajador(valor) -> str:
    cedula = normalizar_cedula_trabajador(valor)
    if not cedula:
        raise ValidationError('Indique la cédula del trabajador.', campo='trabajador_cedula')
    if not ProveedorDatosTrabajadorORM().existe(cedula):
        raise NotFoundError('El trabajador no existe.')
    return cedula


class BajoDemandaView(APIView):
    """GET /api/v1/documentos/bajo-demanda/?trabajador_cedula= — plantillas disponibles y documentos ya generados."""
    permission_classes = [IsAuthenticated, GENERAR_BAJO_DEMANDA]

    @extend_schema(tags=TAG, summary='Plantillas bajo demanda y documentos generados de un trabajador')
    def get(self, request):
        cedula = _cedula_del_trabajador(request.query_params.get('trabajador_cedula'))
        repo = RepoPlantillasORM()
        plantillas = []
        for p in repo.activas_por_proceso(PROCESO_BAJO_DEMANDA):
            version = repo.ultima_version(p.id)
            if version is not None:
                plantillas.append({**_plantilla_dict(p, completa=False), 'campos_propios': version.campos_propios})
        generados = RepoDocumentosORM().documentos_de_trabajador(cedula)
        return ok({
            'plantillas': plantillas,
            'generados': [_resumen_generado(d) for d in generados],
        })


class BajoDemandaGenerarView(APIView):
    """POST /api/v1/documentos/bajo-demanda/generar/ — genera el PDF con snapshot y SHA-256."""
    permission_classes = [IsAuthenticated, GENERAR_BAJO_DEMANDA]
    parser_classes = [JSONParser]

    @extend_schema(tags=TAG, summary='Generar un documento bajo demanda para un trabajador', request=OpenApiTypes.OBJECT)
    def post(self, request):
        cedula = _cedula_del_trabajador(request.data.get('trabajador_cedula'))
        plantilla_id = request.data.get('plantilla_id')
        repo = RepoPlantillasORM()
        plantilla = repo.obtener(str(plantilla_id)) if plantilla_id else None
        if plantilla is None or plantilla.proceso != PROCESO_BAJO_DEMANDA:
            raise NotFoundError('La plantilla no existe o no es de generación bajo demanda.')
        valores = request.data.get('valores_propios')
        if valores is None:
            valores = {}
        if not isinstance(valores, dict):
            raise ValidationError('Los valores propios deben ser un objeto.', campo='valores_propios')
        documento = gen.generar_documento(
            repo, RepoDocumentosORM(), ProveedorDatosTrabajadorORM(almacen_mod.obtener_almacen()),
            MotorPdfDocumentos(), almacen_mod.obtener_almacen(),
            plantilla_id=plantilla.id, sujeto_tipo=SUJETO_TRABAJADOR, sujeto_id=cedula, actor_id=_actor(request),
            valores_propios=valores, trabajador_cedula=cedula,
        )
        return ok(_resumen_generado(documento), 'Documento generado.', status=201)
