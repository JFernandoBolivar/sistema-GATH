"""
Vistas delgadas de Familiares (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
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
)
from apps.familiares.infrastructure.repositories.repo_familiares_orm import RepoFamiliaresORM
from apps.familiares.presentation.serializers.familiares_serializers import (
    DocumentoFamiliarSerializer,
    FamiliarSerializer,
    RegistrarFamiliarInputSerializer,
)


class FamiliaresEmpleadoListView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasPermission('familiares.crear')]
        return [IsAuthenticated(), HasPermission('familiares.ver')]

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
            return [IsAuthenticated(), HasPermission('familiares.ver')]
        return [IsAuthenticated(), HasPermission('familiares.editar')]

    @extend_schema(tags=['Familiares'], summary='Obtener familiar por id', responses={200: FamiliarSerializer})
    def get(self, request, familiar_id: int):
        repo = RepoFamiliaresORM()
        dto = obtener_familiar_por_id(repo, familiar_id=familiar_id)
        return ok(FamiliarSerializer(dto).data)

    @extend_schema(tags=['Familiares'], summary='Actualizar familiar', responses={200: FamiliarSerializer})
    def put(self, request, familiar_id: int):
        repo = RepoFamiliaresORM()
        dto = actualizar_familiar(repo, familiar_id=familiar_id, datos=request.data)
        return ok(FamiliarSerializer(dto).data)

    @extend_schema(tags=['Familiares'], summary='Eliminar carga familiar', responses={200: None})
    def delete(self, request, familiar_id: int):
        repo = RepoFamiliaresORM()
        eliminar_familiar(repo, familiar_id=familiar_id)
        return ok({'eliminado': True})


class DocumentosFamiliarListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('familiares.ver')]

    @extend_schema(tags=['Familiares'], summary='Listar documentos anexos de un familiar', responses={200: DocumentoFamiliarSerializer(many=True)})
    def get(self, request, familiar_id: int):
        repo = RepoFamiliaresORM()
        dtos = listar_documentos_familiar(repo, familiar_id=familiar_id)
        return ok(DocumentoFamiliarSerializer(dtos, many=True).data)
