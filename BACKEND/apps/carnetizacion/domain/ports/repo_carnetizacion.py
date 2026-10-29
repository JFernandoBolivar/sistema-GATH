"""
Puerto del Repositorio de Carnetización (Reglas B1, B21).
"""
from typing import Protocol

from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet


class RepoCarnetizacion(Protocol):
    def listar_carnets(self, empleado_cedula: str | None = None) -> list[Carnet]:
        ...

    def obtener_por_hash(self, security_hash: str) -> Carnet | None:
        ...

    def obtener_por_id(self, carnet_id: int) -> Carnet | None:
        ...

    def emitir_carnet(self, empleado_cedula: str, motivo_id: int, observaciones: str | None = None) -> Carnet:
        ...

    def listar_plantillas(self) -> list[PlantillaCarnet]:
        ...

    def activar_plantilla(self, plantilla_id: int) -> PlantillaCarnet:
        ...

    def crear_plantilla(self, nombre: str, imagen: object, activar: bool = False) -> PlantillaCarnet:
        """Sube una plantilla de diseño de carnet (paridad con `plantillas` del legado)."""
        ...

    def ruta_imagen_plantilla(self, plantilla_id: int) -> str:
        """Ruta local de la imagen de la plantilla; NotFoundError si no existe."""
        ...

    def empleado_existe(self, cedula: str) -> bool:
        ...

    def registrar_foto_perfil(self, cedula: str, clave: str) -> None:
        """Guarda la clave de la foto de perfil del empleado; NotFoundError si no existe."""
        ...

    def generar_pdf(self, carnet_id: int) -> bytes:
        """
        Genera el PDF físico del carnet (QR + foto + plantilla, Fase 2.3 del
        plan de reparación) — antes `emitir_carnet` solo creaba el registro.
        """
        ...

    def revocar_carnet(self, carnet_id: int) -> Carnet:
        """Marca el carnet como inactivo (Fase 2.3): permiso `carnetizacion.revocar` ya sembrado, sin código hasta ahora."""
        ...

    def obtener_estadisticas_carnets(self) -> dict:
        """Métricas agregadas de carnets (paridad con `estadisticas` del legado)."""
        ...
