"""Punto de Cuenta de ingreso ligado al expediente (E-5). Sin Django."""
from dataclasses import dataclass
from datetime import date, datetime

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
    # M-1: aprobación firmada FUERA del sistema (Dirección General no está en el sistema). `decidido_por`/`decidido_el`
    # son quien la registró y cuándo; `fecha_firma` es la de la firma en papel; el PDF firmado escaneado es opcional.
    aprobado_fuera_sistema: bool = False
    fecha_firma: date | None = None
    registrado_por_nombre: str = ''
    pdf_firmado_clave: str = ''
    pdf_firmado_sha256: str = ''
    pdf_firmado_tamano: int = 0

    @property
    def tiene_pdf_firmado(self) -> bool:
        return bool(self.pdf_firmado_clave)


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


def punto_cuenta_listo(punto: 'PuntoCuentaIngreso | None', reserva) -> bool:
    """M-1: el Punto de Cuenta está generado (aún sin decidir) PARA el puesto que hoy está reservado. Uno viejo, de un puesto
    que se perdió, no cuenta: hay que generarlo de nuevo."""
    return bool(
        punto is not None and punto.estado == EMITIDO and reserva is not None and punto.puesto_id == reserva.puesto_id
    )
