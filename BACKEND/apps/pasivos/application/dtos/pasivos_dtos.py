"""
DTOs de Pasivos (Regla B5).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class PasivoDTO:
    id: int
    cedula: str
    nombres: str
    apellidos: str
    nombre_completo: str
    tipo_pasivo: str
    tipo_nomina_id: int | None = None
    fecha_egreso: str | None = None
    resolucion: str | None = None
    observaciones: str | None = None
    correo: str | None = None
    telefono_movil: str | None = None
    telefono_habitacion: str | None = None
    carnet_patria: str | None = None
    carnet_patria_serial: str | None = None
    fecha_nacimiento: str | None = None
    sexo_nombre: str | None = None
    fecha_ingreso_organismo: str | None = None
    estado_civil_id: int | None = None
    nacionalidad_id: int | None = None
    datos_vivienda: dict | None = None
    perfil_salud: dict | None = None
    perfil_fisico: dict | None = None
    formacion_academica: list = field(default_factory=list)
    formacion_complementaria: list = field(default_factory=list)
    contacto_emergencia: list = field(default_factory=list)
    antecedentes: list = field(default_factory=list)
    contrato_actual: dict | None = None
    cargos_historial: list = field(default_factory=list)
    contratos: list = field(default_factory=list)
    asignaciones: list = field(default_factory=list)
    encargadurias: list = field(default_factory=list)


@dataclass(frozen=True)
class ProcesarEgresoDTO:
    cedula: str
    motivo_movimiento_id: int
    tipo_nomina_id: int
    liberar_activos: bool = True
    usuario_id: int | None = None
    # C20: si se indican, tras el egreso se da de alta a estos familiares como
    # pensionados por sobrevivencia (el motivo debe ser fallecimiento).
    sobrevivientes_familiar_ids: tuple[int, ...] = ()


@dataclass(frozen=True)
class CrearSobrevivientesDTO:
    cedula_titular: str
    tipo_nomina_id: int | None = None
    familiar_ids: tuple[int, ...] | None = None
    usuario_id: int | None = None


@dataclass(frozen=True)
class EgresarPasivoDTO:
    cedula: str
    motivo_id: int
    sobrevivientes_familiar_ids: tuple[int, ...] = ()
    usuario_id: int | None = None


@dataclass(frozen=True)
class RegistrarPasivoDirectoDTO:
    datos: dict
    tipo_nomina_id: int
    usuario_id: int | None = None


@dataclass(frozen=True)
class PaginaPasivosDTO:
    resultados: list[PasivoDTO]
    total: int
    limite: int
    desplazamiento: int
