"""Catálogos de referencia de solo lectura para los formularios del trabajador (permiso `autogestion.ver_propio`)."""
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.autogestion.application.use_cases.listar_catalogos_autogestion import listar_catalogo_autogestion
from apps.autogestion.infrastructure.repositories.repo_catalogos_lectura_orm import RepoCatalogosLecturaORM
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission


class ItemCatalogoSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    estado_id = serializers.IntegerField(required=False, help_text='Solo en códigos postales')


class CatalogoAutogestionView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('autogestion.ver_propio')]

    @extend_schema(
        tags=['Autogestión · Catálogos'], summary='Catálogo de referencia (solo lectura)',
        description='clave: condiciones-vivienda, codigos-postales (?estado_id=), niveles-academicos, '
                    'carreras (?nivel_academico_id=), menciones (?carrera_id=), instituciones.',
        parameters=[OpenApiParameter('estado_id', int), OpenApiParameter('nivel_academico_id', int), OpenApiParameter('carrera_id', int)],
        responses={200: ItemCatalogoSerializer(many=True)},
    )
    def get(self, request, clave):
        q = request.query_params
        bruto = q.get('estado_id') or q.get('nivel_academico_id') or q.get('carrera_id')
        padre = int(bruto) if bruto and str(bruto).isdigit() else None
        return ok(listar_catalogo_autogestion(RepoCatalogosLecturaORM(), clave, padre))
