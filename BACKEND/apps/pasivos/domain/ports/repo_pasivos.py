"""
Puerto del Repositorio de Pasivos (Reglas B1, B21).
"""
from typing import Protocol

from apps.pasivos.domain.entities.pasivo import Pasivo


class RepoPasivos(Protocol):
    def listar_pasivos(self, busqueda: str | None = None) -> list[Pasivo]:
        ...

    def listar_pasivos_paginados(self, **filtros) -> tuple[list[Pasivo], int]:
        """Listado con filtros y paginación en servidor."""
        ...

    def actualizar_datos_pasivo(self, cedula: str, datos: dict) -> Pasivo:
        """Actualiza los datos básicos editables del pasivo."""
        ...

    def registrar_pasivo_directo(
        self, datos: dict, tipo_nomina_id: int, usuario_id: int | None = None,
    ) -> Pasivo:
        """Alta directa de jubilado/pensionado sin cargo activo previo."""
        ...

    def listar_motivos_egreso_pasivo(self) -> list[dict]:
        """Motivos válidos para egresar un pasivo (fallecimiento)."""
        ...

    def egresar_pasivo(
        self, cedula: str, motivo_id: int, usuario_id: int | None = None, fecha_egreso=None,
    ) -> Pasivo:
        """Egreso de un pasivo: cambia su estatus y registra el egreso."""
        ...

    def obtener_por_cedula(self, cedula: str) -> Pasivo | None:
        ...

    def procesar_egreso_a_pasivo(
        self,
        cedula: str,
        motivo_movimiento_id: int,
        tipo_nomina_id: int,
        liberar_activos: bool,
        usuario_id: int | None = None,
        fecha_egreso=None,
    ) -> Pasivo:
        """
        Transición activo → pasivo (B4.1 del plan de reparación, réplica de
        `RAC/services/egreso_services.py::procesar_egreso_total`/`procesar_pasivo`).

        Si `liberar_activos` es `True`, cierra el expediente activo del
        empleado (antecedente de servicio + contrato) y libera sus cargos
        actuales antes de crear la nueva asignación pasiva.
        """
        ...
