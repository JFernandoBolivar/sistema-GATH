"""Hash de contraseñas del postulante con el hasher configurado en Django (Argon2id OWASP del proyecto)."""
import secrets

from django.contrib.auth.hashers import check_password, make_password


class HasheadorDjango:
    _hash_ficticio: str | None = None

    def hashear(self, clave: str) -> str:
        return make_password(clave)

    def verificar(self, clave: str, clave_hash: str) -> bool:
        return bool(clave_hash) and check_password(clave, clave_hash)

    def verificar_ficticio(self, clave: str) -> None:
        """Mismo costo que una verificación real: el tiempo de respuesta no delata qué cédulas existen."""
        if HasheadorDjango._hash_ficticio is None:
            HasheadorDjango._hash_ficticio = make_password(secrets.token_urlsafe(32))
        check_password(clave, HasheadorDjango._hash_ficticio)
