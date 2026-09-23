"""
DTOs de Personal (Regla B5).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class EmpleadoDTO:
    id: int
    cedula: str
    nombres: str
    apellidos: str
    nombre_completo: str
    sexo_id: int
    sexo_nombre: str
    correo: str | None = None
    telefono_movil: str | None = None
    telefono_habitacion: str | None = None
    fecha_nacimiento: str | None = None
    estado_civil_id: int | None = None
    estado_civil_nombre: str | None = None
    carnet_patria: str | None = None
    total_anos_apn: float = 0.0
    datos_vivienda: dict | None = None
    perfil_salud: dict | None = None
    perfil_fisico: dict | None = None
    formacion_academica: list = field(default_factory=list)
    formacion_complementaria: list = field(default_factory=list)
    contacto_emergencia: list = field(default_factory=list)
    antecedentes: list = field(default_factory=list)
    contrato_actual: dict | None = None
    contratos: list = field(default_factory=list)
    asignaciones: list = field(default_factory=list)
    encargadurias: list = field(default_factory=list)
