"""
Vistas delgadas de Familiares (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission
from apps.familiares.application.use_cases.gestionar_familiar import (
    actualizar_familiar,
    eliminar_familiar,
    registrar_familiar,
)
from apps.familiares.application.use_cases.listar_familiares import (
    listar_documentos_familiar,
    listar_familiares_por_empleado,
    obtener_familiar_por_id,
    subir_documento_familiar,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.familiares.infrastructure.repositories.repo_familiares_orm import RepoFamiliaresORM
from apps.familiares.presentation.serializers.familiares_serializers import (
    DocumentoFamiliarSerializer,
    FamiliarSerializer,
    RegistrarFamiliarInputSerializer,
)


class FamiliaresEmpleadoListView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasPermission('familiares.crear')()]
        return [IsAuthenticated(), HasPermission('familiares.ver')()]

    @extend_schema(tags=['Familiares'], summary='Listar cargas familiares de un empleado', responses={200: FamiliarSerializer(many=True)})
    def get(self, request, cedula: str):
        repo = RepoFamiliaresORM()
        dtos = listar_familiares_por_empleado(repo, empleado_cedula=cedula)
        return ok(FamiliarSerializer(dtos, many=True).data)

    @extend_schema(tags=['Familiares'], summary='Registrar nuevo familiar', request=RegistrarFamiliarInputSerializer, responses={200: FamiliarSerializer})
    def post(self, request, cedula: str):
        data = {**request.data, 'empleado_cedula': cedula}
        serializer = RegistrarFamiliarInputSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        repo = RepoFamiliaresORM()
        dto = registrar_familiar(repo, familiar_datos=serializer.validated_data)
        return ok(FamiliarSerializer(dto).data)


class FamiliarDetailView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission('familiares.ver')()]
        return [IsAuthenticated(), HasPermission('familiares.editar')()]

    @extend_schema(tags=['Familiares'], summary='Obtener familiar por id', responses={200: FamiliarSerializer})
    def get(self, request, familiar_id: int):
        repo = RepoFamiliaresORM()
        dto = obtener_familiar_por_id(repo, familiar_id=familiar_id)
        return ok(FamiliarSerializer(dto).data)

    @extend_schema(tags=['Familiares'], summary='Actualizar familiar', request=RegistrarFamiliarInputSerializer, responses={200: FamiliarSerializer})
    def put(self, request, familiar_id: int):
        instancia = EmployeefamilyModel.objects.filter(pk=familiar_id).first()
        if instancia is None:
            from core.domain.exceptions import NotFoundError
            raise NotFoundError(f"Familiar con id {familiar_id} no encontrado")

        serializer = RegistrarFamiliarInputSerializer(
            instance=instancia,
            data=request.data,
            partial=True,
            context={'empleado_cedula': instancia.employeecedula_id},
        )
        serializer.is_valid(raise_exception=True)

        repo = RepoFamiliaresORM()
        dto = actualizar_familiar(repo, familiar_id=familiar_id, datos=serializer.validated_data)
        return ok(FamiliarSerializer(dto).data)

    @extend_schema(tags=['Familiares'], summary='Eliminar carga familiar', responses={200: None})
    def delete(self, request, familiar_id: int):
        repo = RepoFamiliaresORM()
        eliminar_familiar(repo, familiar_id=familiar_id)
        return ok({'eliminado': True})


_TIPOS_DOCUMENTO_VALIDOS = {'cedula', 'partida_nacimiento'}


class DocumentosFamiliarListView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasPermission('familiares.editar')()]
        return [IsAuthenticated(), HasPermission('familiares.ver')()]

    @extend_schema(tags=['Familiares'], summary='Listar documentos anexos de un familiar', responses={200: DocumentoFamiliarSerializer(many=True)})
    def get(self, request, familiar_id: int):
        repo = RepoFamiliaresORM()
        dtos = listar_documentos_familiar(repo, familiar_id=familiar_id)
        return ok(DocumentoFamiliarSerializer(dtos, many=True).data)

    @extend_schema(tags=['Familiares'], summary='Subir documento anexo (cédula/partida de nacimiento) de un familiar', responses={200: DocumentoFamiliarSerializer})
    def post(self, request, familiar_id: int):
        tipo_documento = request.data.get('tipo_documento')
        if tipo_documento not in _TIPOS_DOCUMENTO_VALIDOS:
            return fail(f"tipo_documento debe ser uno de {sorted(_TIPOS_DOCUMENTO_VALIDOS)}", status=400)

        archivo = request.FILES.get('file')
        if not archivo:
            return fail('No se proporcionó ningún archivo', status=400)

        from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

        storage = SeaweedFSStorage()
        clave = f"familiares/{familiar_id}_{tipo_documento}_{archivo.name}"
        storage.subir(clave, archivo.read(), archivo.content_type)

        repo = RepoFamiliaresORM()
        dto = subir_documento_familiar(repo, familiar_id=familiar_id, tipo_documento=tipo_documento, clave=clave)
        return ok(DocumentoFamiliarSerializer(dto).data)
