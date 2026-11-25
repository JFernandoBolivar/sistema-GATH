"""Servicio de documentos para otras aplicaciones (N-2, N-3, N-4).

Concentra el contrato de infraestructura: consulta de plantillas activas,
generación por proceso o por plantilla y documentos de un trabajador. Los datos
los conoce el módulo llamador; el servicio no importa dominios ajenos.
"""
from datetime import date

from apps.documentos.application.use_cases.generar_documento import generar_documento
from apps.documentos.domain.entities.documentos import DocumentoGenerado, Plantilla
from apps.documentos.domain.services.catalogo_procesos import validar_proceso
from apps.documentos.infrastructure import almacen as almacen_mod
from apps.documentos.infrastructure.pdf.motor import MotorPdfDocumentos
from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoDocumentosORM, RepoPlantillasORM
from core.domain.exceptions import NotFoundError


class ServicioDocumentosExternos:
    def __init__(self, repo_plantillas=None, repo_documentos=None, motor=None, almacen=None):
        self.repo_plantillas = repo_plantillas or RepoPlantillasORM()
        self.repo_documentos = repo_documentos or RepoDocumentosORM()
        self._motor = motor
        self._almacen = almacen

    @property
    def motor(self):
        if self._motor is None:
            self._motor = MotorPdfDocumentos()
        return self._motor

    @property
    def almacen(self):
        if self._almacen is None:
            self._almacen = almacen_mod.obtener_almacen()
        return self._almacen

    def plantillas_activas(self, proceso: str) -> list[Plantilla]:
        return self.repo_plantillas.activas_por_proceso(validar_proceso(proceso))

    def generar_plantilla(
        self, plantilla_id: str, *, sujeto_tipo: str, sujeto_id: str, datos: dict, actor_id: int | None,
        valores_propios: dict | None = None, trabajador_cedula: str = '', estricto: bool = True,
        hoy: date | None = None,
    ) -> DocumentoGenerado:
        """Genera una plantilla concreta; el caso de uso exige que esté activa y publicada."""
        return generar_documento(
            self.repo_plantillas, self.repo_documentos, None, self.motor, self.almacen,
            plantilla_id=plantilla_id, sujeto_tipo=sujeto_tipo, sujeto_id=str(sujeto_id), actor_id=actor_id,
            valores_propios=valores_propios, datos_base=datos, hoy=hoy,
            trabajador_cedula=trabajador_cedula, estricto=estricto,
        )

    def generar_por_proceso(
        self, proceso: str, *, sujeto_tipo: str, sujeto_id: str, datos: dict, actor_id: int | None,
        valores_propios: dict | None = None, trabajador_cedula: str = '', estricto: bool = True,
        hoy: date | None = None,
    ) -> DocumentoGenerado:
        """Genera con la plantilla publicada y activa del proceso (una, para Punto de Cuenta)."""
        proceso = validar_proceso(proceso)
        plantilla = self.repo_plantillas.obtener_activa_por_proceso(proceso)
        if plantilla is None:
            raise NotFoundError(f'No hay una plantilla publicada y activa para el proceso «{proceso}».')
        return self.generar_plantilla(
            plantilla.id, sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id, datos=datos, actor_id=actor_id,
            valores_propios=valores_propios, trabajador_cedula=trabajador_cedula, estricto=estricto, hoy=hoy,
        )

    def documentos_de_trabajador(self, cedula: str) -> list[DocumentoGenerado]:
        return self.repo_documentos.documentos_de_trabajador(str(cedula).strip())
