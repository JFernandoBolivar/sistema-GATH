"""Punto de Cuenta de ingreso ligado al expediente (E-5). Sin Django."""
from dataclasses import dataclass
from datetime import datetime

EMITIDO = 'EMITIDO'
FIRMADO = 'FIRMADO'      # Dirección General aprobó el ingreso
RECHAZADO = 'RECHAZADO'  # Dirección General no lo aprobó
ESTADOS_PUNTO_CUENTA = (EMITIDO, FIRMADO, RECHAZADO)
ESTADOS_DECIDIDOS = (FIRMADO, RECHAZADO)


@dataclass(frozen=True)
class PuntoCuentaIngreso:
    """Enlace expediente -> Punto de Cuenta (`apps.puntocuenta`), por id y número, sin FK entre módulos."""

    expediente_id: str
    punto_cuenta_id: str
    numero: str
    estado: str
    puesto_id: int
    referencia_constancia: str
    emitido_por: str                 # cédula
    emitido_el: datetime
    pdf_clave: str = ''              # clave del PDF en el almacén
    decidido_por: str = ''
    decidido_el: datetime | None = None


@dataclass(frozen=True)
class SolicitudPuntoCuentaIngreso:
    """Datos con que se genera el Punto de Cuenta de ingreso: el postulante aún no es `Employee`."""

    expediente_numero: str
    postulante_cedula: str
    postulante_nombre: str
    puesto_id: int
    puesto_codigo: str
    cargo_nombre: str
    dependencia_id: int | None
    dependencia_nombre: str
    direccion_general_id: int | None
    direccion_general_nombre: str     # la «oficina» del puesto
    direccion_linea_id: int | None
    direccion_linea_nombre: str
    referencia_constancia: str
    emitido_por_cedula: str
    emitido_por_nombre: str
    emitido_por_usuario_id: int | None
    ahora: datetime


@dataclass(frozen=True)
class PuntoCuentaEmitido:
    punto_cuenta_id: str
    numero: str
    pdf_clave: str
