"""
Entidad de Dominio `Empleado` (Regla B1).
Representa a un trabajador de la institución.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Empleado:
    id: int
    cedula: str
    nombres: str
    apellidos: str
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
    # Expediente anidado (Fase 2.2 del plan de reparación): solo se puebla en
    # `obtener_por_cedula` (detalle) — `listar_empleados` sigue devolviendo
    # estos campos vacíos/`None` a propósito, para no cargar N+1 relaciones
    # en cada fila de un listado.
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

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombres} {self.apellidos}".strip()
