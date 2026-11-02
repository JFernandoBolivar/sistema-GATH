"""
Caso de uso `cambiar_password` (autoservicio, cierra CRIT-04).

El legado histórico (`cambiar_password_primera_vez`) era `AllowAny` y solo
pedía `id` + `password` nuevos, sin exigir la contraseña actual ni sesión: con
el `id` de cualquier cuenta, cualquiera podía reemplazar su contraseña sin
autenticarse. Aquí el cierre real es doble: la vista exige `IsAuthenticated`
y opera exclusivamente sobre `request.user` (nunca un `id` del body), y este
caso de uso exige que `password_actual` coincida con la almacenada antes de
aceptar la nueva. Puro: recibe el puerto por inyección (B4/B21); el
validador de fortaleza también es inyectable para poder probarlo sin Django.
`validar_fortaleza` es obligatorio: el adaptador real vive en
`infrastructure/providers/validadores_password.py`.
"""
from typing import Callable

from apps.identidad.application.dtos.cuenta_dto import CambiarPasswordDTO
from apps.identidad.domain.events import EventoIdentidad, MotivoCambioPassword, TipoEventoIdentidad
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from core.domain.exceptions import ValidationError


def cambiar_password(
    repo: RepoCuentas,
    dto: CambiarPasswordDTO,
    validar_fortaleza: Callable[[str], None],
    publicar: Callable[[EventoIdentidad], None] | None = None,
) -> None:
    """Cambia la contraseña propia tras verificar la actual (CRIT-04, S4, S5)."""
    if not repo.verificar_password(dto.actor_id, dto.password_actual):
        raise ValidationError('La contraseña actual no es correcta.')

    if dto.password_actual == dto.password_nuevo:
        raise ValidationError('La nueva contraseña debe ser diferente a la actual.')

    validar_fortaleza(dto.password_nuevo)

    cuenta = repo.obtener_por_id(dto.actor_id)
    repo.establecer_password(dto.actor_id, dto.password_nuevo)

    if publicar is not None and cuenta is not None:
        # Dejar la contraseña inicial (la cédula) es el cambio obligatorio del primer ingreso (D8).
        era_inicial = dto.password_actual == cuenta.cedula
        publicar(EventoIdentidad(
            tipo=TipoEventoIdentidad.PASSWORD_CAMBIADA, cedula=cuenta.cedula,
            motivo=(MotivoCambioPassword.OBLIGATORIO if era_inicial else MotivoCambioPassword.VOLUNTARIO).value,
        ))
