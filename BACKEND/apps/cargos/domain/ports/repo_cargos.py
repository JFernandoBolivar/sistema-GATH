"""
Puerto del Repositorio de Cargos (Reglas B1, B21).
"""
from typing import Protocol

from apps.cargos.domain.entities.cargo_asignacion import CargoAsignacion
from apps.cargos.domain.entities.denominacion_cargo import DenominacionCargo
from apps.cargos.domain.entities.denominacion_especifica import DenominacionEspecifica
from apps.cargos.domain.entities.prestamo_cargo import PrestamoCargo


class RepoCargos(Protocol):
    def listar_denominaciones(self) -> list[DenominacionCargo]:
        ...

    def listar_denominaciones_especificas(self) -> list[DenominacionEspecifica]:
        ...

    def crear_denominacion(self, nombre: str, orden: int) -> DenominacionCargo:
        ...

    def actualizar_denominacion(self, denominacion_id: int, nombre: str, orden: int) -> DenominacionCargo:
        ...

    def eliminar_denominacion(self, denominacion_id: int) -> None:
        ...

    def crear_denominacion_especifica(self, nombre: str, orden: int) -> DenominacionEspecifica:
        ...

    def actualizar_denominacion_especifica(self, denominacion_id: int, nombre: str, orden: int) -> DenominacionEspecifica:
        ...

    def eliminar_denominacion_especifica(self, denominacion_id: int) -> None:
        ...

    def listar_cargos(
        self,
        tipo_nomina_id: int | None = None,
        dependencia_id: int | None = None,
        solo_vacantes: bool = False,
        direccion_general_id: int | None = None,
        direccion_linea_id: int | None = None,
        coordinacion_id: int | None = None,
        codigo: str | None = None,
    ) -> list[CargoAsignacion]:
        ...

    def obtener_cargo(self, cargo_id: int) -> CargoAsignacion | None:
        ...

    def asignar_cargo_a_empleado(
        self, cargo_id: int, cedula: str, motivo_id: int | None = None, usuario_id: int | None = None
    ) -> CargoAsignacion:
        ...

    def desasignar_cargo(
        self, cargo_id: int, motivo_id: int | None = None, usuario_id: int | None = None
    ) -> CargoAsignacion:
        ...

    def obtener_nombre_tipo_nomina(self, tipo_nomina_id: int) -> str:
        ...

    def generar_siguiente_codigo_especial(self, prefijo: str) -> str:
        ...

    def crear_cargo_especial_y_asignar(self, datos: dict) -> CargoAsignacion:
        ...

    def crear_cargo(self, datos: dict) -> CargoAsignacion:
        ...

    def actualizar_cargo(self, cargo_id: int, datos: dict, usuario_id: int | None = None) -> CargoAsignacion:
        ...

    # ------------------------------------------------------------------
    # Fase 2.5 del plan de reparación — traslado, estatus, encargaduría
    # ------------------------------------------------------------------
    def cambiar_cargo(
        self, cargo_actual_id: int, cargo_nuevo_id: int, motivo_id: int, usuario_id: int
    ) -> CargoAsignacion:
        ...

    def gestionar_estatus_puesto(
        self, cargo_id: int, estatus_id: int, motivo_id: int, usuario_id: int
    ) -> CargoAsignacion:
        ...

    def listar_prestamos(self, solo_activos: bool = False, empleado: str | None = None) -> list[PrestamoCargo]:
        ...

    def crear_prestamo(
        self,
        cedula_encargado: str,
        cargo_id: int,
        motivo_id: int,
        fecha_inicio: str,
        fecha_fin: str,
        usuario_id: int,
    ) -> PrestamoCargo:
        ...

    def finalizar_prestamo(self, prestamo_id: int, fecha_fin=None) -> PrestamoCargo:
        ...
