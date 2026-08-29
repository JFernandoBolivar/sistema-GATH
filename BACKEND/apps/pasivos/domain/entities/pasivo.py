"""
Entidad de Dominio `Pasivo` (Regla B1).
Representa a un trabajador jubilado, pensionado o sobreviviente.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Pasivo:
    id: int
    cedula: str
    nombres: str
    apellidos: str
    tipo_pasivo: str
    fecha_egreso: str | None = None
    resolucion: str | None = None
    observaciones: str | None = None
    # Expediente anidado (Fase 2.1/2.2 del plan de reparación): reutiliza el
    # mismo expediente de `apps.personal` (un pasivo también es un
    # `Employee`) — solo se puebla en `obtener_por_cedula` (detalle).
    datos_vivienda: dict | None = None
    perfil_salud: dict | None = None
    formacion_academica: list = field(default_factory=list)
    contacto_emergencia: list = field(default_factory=list)
    antecedentes: list = field(default_factory=list)
    contrato_actual: dict | None = None

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombres} {self.apellidos}".strip()
