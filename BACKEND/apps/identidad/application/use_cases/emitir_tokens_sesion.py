"""
Caso de uso `emitir_tokens_sesion` (R-11).

Reemplaza, para el módulo `apps.identidad`, a
`USER/services/token_service.py::TokenService.generate_tokens_for_user`. Embebe
los mismos claims propios (`cedula`, `rol`) que el legado, para que el resto
del backend (y el frontend, vía NextAuth) siga leyendo el token igual.

Hallazgo verificado durante esta tarea (no asumido): con
`rest_framework_simplejwt.token_blacklist` instalado (como está en GATH),
`RefreshToken.for_user()` **siempre** escribe una fila `OutstandingToken` en
BD, y su FK `user` exige una instancia real de `AUTH_USER_MODEL` — no basta
un objeto liviano con solo el atributo `id` (una `TitularSesion` de dominio
falla ahí con `ValueError`, verificado con un test antes de este ajuste). Por
eso `titular_orm` se recibe sin tipar contra el modelo concreto (para no
forzar el import de `CuentaModel` aquí), pero en la práctica **debe** ser la
instancia real que ya tiene quien llama (la vista, tras autenticar, o
`rotar_tokens_sesion` vía el puerto `RepoCuentaAuth`). Es una excepción
deliberada y documentada a B21/D-09: la emisión de JWT con blacklisting es un
primitivo de seguridad transversal de la librería, no una regla de negocio
que pueda desacoplarse del ORM sin reimplementar `simplejwt` a mano.
"""
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identidad.application.dtos.token_dto import TokensEmitidosDTO


def emitir_tokens_sesion(
    titular_orm, cedula: str | None, rol_nombre: str | None
) -> TokensEmitidosDTO:
    """Emite el par access/refresh para `titular_orm`, embebiendo los claims."""
    refresh = RefreshToken.for_user(titular_orm)
    refresh['cedula'] = cedula
    refresh['rol'] = rol_nombre

    return TokensEmitidosDTO(access=str(refresh.access_token), refresh=str(refresh))
