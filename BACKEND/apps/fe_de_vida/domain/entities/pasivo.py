"""Datos del pasivo que necesitan la constancia, los avisos y el reporte de cobertura. Sin Django."""
from dataclasses import dataclass


@dataclass(frozen=True)
class DatosPasivo:
    cedula: str
    nombre_completo: str
    condicion: str = ''           # tipo de nómina/pensión (jubilado, pensionado...), tal como está en el catálogo
    correo: str = ''
    correo_alternativo: str = ''


@dataclass(frozen=True)
class PasivoCobertura:
    cedula: str
    nombre_completo: str
    tipo_nomina: str
    correo: str
    tiene_cuenta: bool

    @property
    def sin_correo(self) -> bool:
        return not self.correo
