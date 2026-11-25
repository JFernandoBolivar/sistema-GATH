"""Adaptador entre el puerto de Punto de Cuenta y el diseñador de documentos."""
from typing import Any

from apps.documentos.domain.services.catalogo_procesos import obtener_proceso
from apps.documentos.infrastructure.repositories.repo_documentos_orm import (
    RepoPlantillasORM,
)
from apps.documentos.infrastructure.servicio_externo import ServicioDocumentosExternos
from apps.puntocuenta.domain.exceptions import PlantillaPuntoCuentaFaltante
from apps.puntocuenta.domain.ports.generador_punto_cuenta import (
    DocumentoPuntoCuenta,
    GeneradorPuntoCuenta,
)
from core.domain.exceptions import ConflictError, NotFoundError


def proceso_documento(proceso: str) -> str:
    """Convierte el proceso operativo al código del catálogo de documentos."""
    proceso = (proceso or '').strip()
    if not proceso:
        raise PlantillaPuntoCuentaFaltante(proceso)
    return proceso if proceso.startswith('punto_cuenta:') else f'punto_cuenta:{proceso}'


def _faltante(proceso: str) -> PlantillaPuntoCuentaFaltante:
    definicion = obtener_proceso(proceso_documento(proceso))
    return PlantillaPuntoCuentaFaltante(proceso, definicion.etiqueta_corta if definicion else '')


class AdaptadorGeneradorPuntoCuenta:
    def __init__(self, *, servicio=None, repo_plantillas=None):
        self.servicio = servicio or ServicioDocumentosExternos()
        self.repo_plantillas = repo_plantillas or RepoPlantillasORM()

    def validar(self, proceso: str) -> None:
        codigo = proceso_documento(proceso)
        if self.repo_plantillas.obtener_activa_por_proceso(codigo) is None:
            raise _faltante(proceso)

    def generar(
        self,
        proceso: str,
        *,
        sujeto_id: str,
        datos: dict[str, Any],
        actor_id: int | None,
        valores_propios: dict[str, Any] | None = None,
        trabajador_cedula: str = '',
    ) -> DocumentoPuntoCuenta:
        codigo = proceso_documento(proceso)
        try:
            documento = self.servicio.generar_por_proceso(
                codigo,
                sujeto_tipo='punto_cuenta',
                sujeto_id=sujeto_id,
                datos=datos,
                actor_id=actor_id,
                valores_propios=valores_propios,
                trabajador_cedula=trabajador_cedula,
                estricto=True,
            )
        except (NotFoundError, ConflictError) as exc:
            raise _faltante(proceso) from exc
        return DocumentoPuntoCuenta(
            id=str(documento.id),
            pdf_clave=documento.pdf_clave,
            pdf_sha256=documento.pdf_sha256,
            plantilla_id=str(getattr(documento, 'plantilla_id', '') or ''),
            version_id=str(getattr(documento, 'version_id', '') or ''),
            version_numero=getattr(documento, 'version_numero', None),
        )


def obtener_generador_punto_cuenta(almacen=None) -> GeneradorPuntoCuenta:
    """Obtiene el adaptador de infraestructura sin filtrarlo a application. `almacen` None = el de documentos."""
    return AdaptadorGeneradorPuntoCuenta(servicio=ServicioDocumentosExternos(almacen=almacen))
