"""Entidades del restablecimiento de acceso en bloque (U2). Sin Django."""
from dataclasses import dataclass


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
