"""
DTOs de Cargos (Regla B5).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class DenominacionDTO:
    id: int
    nombre: str
    orden: int = 30


@dataclass(frozen=True)
class CargoAsignacionDTO:
    id: int
    codigo: str
    empleado_cedula: str | None
    denominacion_id: int
    denominacion_nombre: str
    especifica_id: int
    especifica_nombre: str
    tipo_nomina_id: int
    tipo_nomina_nombre: str
    estatus_id: int
    estatus_nombre: str
    empleado_nombre: str | None = None
    dependencia_id: int | None = None
    dependencia_nombre: str | None = None
    direccion_general_id: int | None = None
    direccion_general_nombre: str | None = None
    direccion_linea_id: int | None = None
    direccion_linea_nombre: str | None = None
    coordinacion_id: int | None = None
    coordinacion_nombre: str | None = None
    organismo_id: int | None = None
    organismo_nombre: str | None = None
    grado_id: int | None = None
    grado_nombre: str | None = None
    observaciones: str | None = None
    esta_vacante: bool = False
    fecha_actualizacion: str | None = None


@dataclass(frozen=True)
class CrearCargoEspecialDTO:
    """
    Datos de entrada para la asignación de cargo especial (gap #3 — código
    autogenerable). Réplica del contrato de
    `RAC/serializers/personal_activo_serializers.py::SpecialPositionAutoCreateSerializer`.
    """
    cedula_empleado: str
    denominacion_id: int
    especifica_id: int
    tipo_nomina_id: int
    dependencia_id: int | None = None
    direccion_general_id: int | None = None
    direccion_linea_id: int | None = None
    coordinacion_id: int | None = None
    organismo_id: int | None = None
    grado_id: int | None = None
    observaciones: str | None = None


@dataclass(frozen=True)
class CrearCargoDTO:
    """
    Datos de entrada para crear un código de posición vacante (sin asignar),
    réplica funcional de la pantalla "Crear Nuevo Código" del legado
    (`CodigoCatalogForm`). A diferencia de `CrearCargoEspecialDTO`, no exige
    `cedula_empleado` ni un tipo de nómina "especial" — usa el esquema de
    código NORMAL (`generar_codigo_normal`), ya definido en el dominio pero
    sin ningún caso de uso que lo invocara hasta ahora.
    """
    denominacion_id: int
    especifica_id: int
    tipo_nomina_id: int
    dependencia_id: int | None = None
    direccion_general_id: int | None = None
    direccion_linea_id: int | None = None
    coordinacion_id: int | None = None
    organismo_id: int | None = None
    grado_id: int | None = None
    observaciones: str | None = None


@dataclass(frozen=True)
class PrestamoCargoDTO:
    """Fase 2.5 del plan de reparación — subsistema de préstamo/encargaduría."""
    id: int
    empleado_encargado_cedula: str
    empleado_encargado_nombre: str
    cargo_encargado_id: int
    cargo_encargado_codigo: str
    motivo_id: int
    motivo_nombre: str
    estatus_id: int
    estatus_nombre: str
    fecha_inicio: str
    fecha_fin: str
    ejecutado_por_id: int
    cargo_encargado_denominacion: str = ""
    titular_cedula: str | None = None
    titular_nombre: str | None = None
    esta_finalizada: bool = False
