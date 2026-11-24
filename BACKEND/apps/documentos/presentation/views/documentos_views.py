"""
Vistas delgadas de las plantillas de documentos y de los documentos generados (F-1).
Envelope unificado `ok()` y permisos PBAC: `documentos.ver_plantillas` / `documentos.gestionar_plantillas`.
"""
from dataclasses import asdict

from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.documentos.application.use_cases import gestionar_plantillas as uc
from apps.documentos.domain.entities.documentos import FirmaDocumento, Plantilla, VersionPlantilla
from apps.documentos.domain.services.variables_documento import catalogo_para_interfaz
from apps.documentos.domain.value_objects import esquema_documento as esq
from apps.documentos.infrastructure import almacen as almacen_mod
from apps.documentos.infrastructure.pdf.motor import InspectorPdfDocumentos, MotorPdfDocumentos
from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoDocumentosORM, RepoPlantillasORM
from core.domain.exceptions import NotFoundError, ValidationError
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission

TAG = ['Documentos']
VER = HasPermission('documentos.ver_plantillas')
GESTIONAR = HasPermission('documentos.gestionar_plantillas')


def _actor(request) -> int | None:
    pk = getattr(request.user, 'pk', None)
    return pk if isinstance(pk, int) else None


def _plantilla_dict(p: Plantilla, completa: bool = True) -> dict:
    base = {
        'id': p.id, 'codigo': p.codigo, 'nombre': p.nombre, 'descripcion': p.descripcion, 'modo': p.modo,
        'momento': p.momento, 'firmante': p.firmante, 'requiere_firma_clic': p.requiere_firma_clic,
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
        return ok({
            'variables': catalogo_para_interfaz(),
            'tipos_bloque': list(esq.TIPOS_BLOQUE),
            'tipos_campo_overlay': list(esq.TIPOS_CAMPO_OVERLAY),
            'tipos_campo_propio': ['texto', 'texto_largo', 'fecha', 'si_no', 'opcion'],
            'modos': list(esq.MODOS), 'momentos': list(esq.MOMENTOS), 'firmantes': list(esq.FIRMANTES),
            'limites': {'max_bytes_fondo': uc.MAX_BYTES_FONDO, 'max_bytes_logo': uc.MAX_BYTES_LOGO},
        })


class PlantillasView(APIView):
    """GET (lista) / POST (crear) /api/v1/documentos/plantillas/"""
    def get_permissions(self):
        return [IsAuthenticated(), (VER if self.request.method == 'GET' else GESTIONAR)()]

    @extend_schema(tags=TAG, summary='Listar las plantillas de documentos')
    def get(self, request):
        return ok([_plantilla_dict(p, completa=False) for p in uc.listar_plantillas(RepoPlantillasORM())])

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
        cambios = {k: request.data[k] for k in ('definicion', 'campos_propios') if k in request.data}
        pdf = uc.vista_previa(RepoPlantillasORM(), almacen_mod.obtener_almacen(), MotorPdfDocumentos(), id, cambios)
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = 'inline; filename="vista_previa_documento.pdf"'
        resp['Cache-Control'] = 'private, no-store'
        resp['X-Content-Type-Options'] = 'nosniff'
        return resp


class DocumentoGeneradoView(APIView):
    """GET /api/v1/documentos/generados/<id>/ — metadatos, snapshot y firmas."""
    permission_classes = [IsAuthenticated, VER]

    @extend_schema(tags=TAG, summary='Datos de un documento generado y sus firmas')
    def get(self, request, id):
        repo = RepoDocumentosORM()
        d = repo.obtener_generado(id)
        if d is None:
            raise NotFoundError('El documento no existe.')
        return ok({
            'id': d.id, 'plantilla_id': d.plantilla_id, 'version_numero': d.version_numero, 'sujeto_tipo': d.sujeto_tipo,
            'sujeto_id': d.sujeto_id, 'pdf_sha256': d.pdf_sha256, 'datos_snapshot': d.datos_snapshot,
            'generado_en': d.generado_en.isoformat() if d.generado_en else None,
            'firmas': [_firma_dict(f) for f in repo.firmas_de(d.id)],
        })


class DocumentoGeneradoArchivoView(APIView):
    """GET /api/v1/documentos/generados/<id>/archivo/ — PDF por streaming, con registro en la bitácora (H-3)."""
    permission_classes = [IsAuthenticated, VER]

    @extend_schema(tags=TAG, summary='Descargar el PDF de un documento generado',
                   responses={(200, 'application/pdf'): OpenApiTypes.BINARY})
    def get(self, request, id):
        d = RepoDocumentosORM().obtener_generado(id)
        if d is None:
            raise NotFoundError('El documento no existe.')
        return respuesta_archivo(almacen_mod.obtener_almacen(), d.pdf_clave, cache='private, no-store', mime='application/pdf',
                                 request=request, recurso='documento_generado', recurso_id=d.id)
