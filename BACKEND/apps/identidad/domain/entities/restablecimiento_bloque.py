"""Entidades del restablecimiento de acceso en bloque (U2). Sin Django."""
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class CuentaClaveInicial:
    """Cuenta activa candidata: identificador y cédula (la clave se comprueba en el adaptador)."""

    cuenta_id: int
    cedula: str


@dataclass(frozen=True)
class ResultadoRestablecimientoBloque:
    """Vista previa o resultado de un lote de restablecimientos."""

    revisadas: int
    activos: int
    pasivos: int
    total: int
    omitidas_administrativas: int
    restablecidas: int = 0
    errores: int = 0
    enviar_correo: bool = True
    dry_run: bool = True


@dataclass(frozen=True)
class DetalleCuentaBloque:
    """Datos de presentación de una cuenta del lote (nombre, correo de acceso y plazo)."""

    cuenta_id: int
    cedula: str
    nombre: str
    correo: str
    vence_en: datetime | None


@dataclass(frozen=True)
class FilaBloque:
    """Fila de la vista previa o del Excel: detalle de la cuenta más su condición."""

    cuenta_id: int
    cedula: str
    nombre: str
    condicion: str
    correo: str
    vence_en: datetime | None
