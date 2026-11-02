"""Backoff exponencial de los reintentos de correo (puro)."""


def segundos_hasta_reintento(intentos: int, base: int = 60, tope: int = 3600) -> int:
    """Tras el intento n (n>=1): base * 2^(n-1), con tope. 60, 120, 240, 480..."""
    return min(tope, base * (2 ** max(0, intentos - 1)))
