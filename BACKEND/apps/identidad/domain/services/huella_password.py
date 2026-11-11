"""Huella del hash de contraseña para ligar tokens de un solo uso (S2-04)."""
import hashlib


def huella_password(password_hash: str) -> str:
    """sha256 truncado del hash completo: cambia en cuanto cambia la clave (el prefijo del algoritmo no)."""
    return hashlib.sha256((password_hash or '').encode()).hexdigest()[:32]
