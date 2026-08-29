"""
Puerto del Repositorio de Pasivos (Reglas B1, B21).
"""
from typing import Protocol

from apps.pasivos.domain.entities.pasivo import Pasivo


class RepoPasivos(Protocol):
    def listar_pasivos(self, busqueda: str | None = None) -> list[Pasivo]:
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
    ) -> Pasivo:
        """
        Transición activo → pasivo (B4.1 del plan de reparación, réplica de
        `RAC/services/egreso_services.py::procesar_egreso_total`/`procesar_pasivo`).

        Si `liberar_activos` es `True`, cierra el expediente activo del
        empleado (antecedente de servicio + contrato) y libera sus cargos
        actuales antes de crear la nueva asignación pasiva.
        """
        ...
