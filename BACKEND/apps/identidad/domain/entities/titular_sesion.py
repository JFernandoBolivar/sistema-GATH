"""
Entidad `TitularSesion` del dominio de identidad (R-11).

Datos mínimos del sujeto de un JWT de sesión: solo lo que
`emitir_tokens_sesion`/`rotar_tokens_sesion` necesitan para construir o
revalidar el par access/refresh. Deliberadamente más angosta que `Cuenta`
(gestión de usuarios): no transporta departamento ni correo. Pura e
inmutable (B1, B5). `simplejwt.RefreshToken.for_user()` solo lee el atributo
`id` (según `SIMPLE_JWT['USER_ID_FIELD']`), así que esta entidad basta como
"user" para la librería sin importar el ORM (B21).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class TitularSesion:
    """Sujeto de un JWT: PK, cédula y nombre de rol (claims embebidos) + estado."""

    id: int
    cedula: str | None
    rol_nombre: str | None
    is_active: bool = True
