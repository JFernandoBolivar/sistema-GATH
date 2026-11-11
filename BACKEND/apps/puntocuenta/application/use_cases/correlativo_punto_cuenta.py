"""
Correlativo del Punto de Cuenta (A2-01): la atomicidad vive en el repositorio.

Formato: XXXX-YYYY (ej. 0001-2026). Sin Django.
"""
from datetime import date

from apps.puntocuenta.domain.ports.repo_punto_cuenta_config import RepoSecuenciaPuntoCuenta


def obtener_siguiente_correlativo(
    repo: RepoSecuenciaPuntoCuenta, anio: int | None = None,
) -> tuple[int, str]:
    """Devuelve `(secuencia, numero_formateado)` para el año indicado."""
    anio = anio if anio is not None else date.today().year
    secuencia = repo.siguiente(anio)
    return secuencia, f'{secuencia:04d}-{anio}'
