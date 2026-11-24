"""
Errores del acceso del postulante (D-3, D-4). Sin Django.

Todos son `DomainError` con un `codigo` estable que el cliente puede interpretar sin leer el texto. El estado
HTTP lo decide la capa de presentación a partir del código (el dominio no conoce HTTP).
"""
from datetime import datetime

from core.domain.exceptions import ConflictError, DomainError, NotFoundError, PermissionDeniedError, ValidationError


class ErrorAccesoPostulante(DomainError):
    codigo = 'ACCESO_RECHAZADO'

    def __init__(self, *args, campo: str | None = None):
        super().__init__(*args, campo=campo)


class CredencialesInvalidas(ErrorAccesoPostulante):
    """Cédula o contraseña incorrectas. El mensaje es el mismo exista o no la cédula (no revela cuáles hay)."""

    codigo = 'CREDENCIALES_INVALIDAS'


class CredencialBloqueada(ErrorAccesoPostulante):
    """Demasiados intentos fallidos: bloqueo temporal hasta `bloqueada_hasta`."""

    codigo = 'CREDENCIAL_BLOQUEADA'

    def __init__(self, *args, bloqueada_hasta: datetime | None = None):
        super().__init__(*args)
        self.bloqueada_hasta = bloqueada_hasta


class CredencialVencida(ErrorAccesoPostulante):
    """La credencial venció (o fue revocada): hay que pedir a Captación que reabra el acceso."""

    codigo = 'CREDENCIAL_VENCIDA'


class AccesoNoDisponible(ErrorAccesoPostulante):
    """El expediente está en una etapa en la que el postulante no actúa (revisión de Captación, etc.)."""

    codigo = 'ACCESO_NO_DISPONIBLE'


class CambioClaveObligatorio(ErrorAccesoPostulante):
    """La contraseña temporal sigue vigente: antes de cualquier otra acción hay que cambiarla."""

    codigo = 'CAMBIO_CLAVE_OBLIGATORIO'


class SesionInvalida(ErrorAccesoPostulante):
    """Token ausente, mal firmado, vencido, de otra clase o ya revocado."""

    codigo = 'SESION_INVALIDA'


# --- Errores de las transiciones del expediente (D-7): cada uno lleva un `codigo` estable para el cliente ---
class ConflictoConCodigo(ConflictError):
    """409 con código: transición ilegal, expediente final, guarda incumplida (psicofísico, ventana vencida...)."""

    def __init__(self, *args, codigo: str, campo: str | None = None):
        super().__init__(*args, campo=campo)
        self.codigo = codigo


class ValidacionConCodigo(ValidationError):
    """400 con código: dato faltante o inválido de una transición (motivo, cargo y oficina, propuesta)."""

    def __init__(self, *args, codigo: str, campo: str | None = None):
        super().__init__(*args, campo=campo)
        self.codigo = codigo


class SinPermisoConCodigo(PermissionDeniedError):
    """403 con código: el actor no puede ejecutar esa transición."""

    def __init__(self, *args, codigo: str = 'SIN_PERMISO', campo: str | None = None):
        super().__init__(*args, campo=campo)
        self.codigo = codigo


class NoEncontradoConCodigo(NotFoundError):
    """404 con código (puesto o reserva inexistente), para que el cliente no lea el texto."""

    def __init__(self, *args, codigo: str, campo: str | None = None):
        super().__init__(*args, campo=campo)
        self.codigo = codigo


class Ventana2Incompleta(ValidacionConCodigo):
    """400 `VENTANA2_INCOMPLETA`: lo que falta para enviar la Ventana 2 viaja en `detalle['faltantes']` (va en `data`)."""

    def __init__(self, faltantes: list[dict]):
        resumen = '; '.join(f['mensaje'] for f in faltantes[:3]) + ('…' if len(faltantes) > 3 else '')
        super().__init__(
            f"La Ventana 2 está incompleta ({len(faltantes)} pendiente{'s' if len(faltantes) != 1 else ''}): {resumen}",
            codigo='VENTANA2_INCOMPLETA', campo='datos_ventana2',
        )
        self.detalle = {'faltantes': faltantes}


class DatosVentana2Invalidos(ValidacionConCodigo):
    """400 `DATOS_INVALIDOS`: los datos de la Ventana 2 no cuadran con los catálogos; `detalle['errores']` = `{ruta: mensaje}`."""

    def __init__(self, errores: dict[str, str]):
        ruta, mensaje = next(iter(errores.items()))
        super().__init__(mensaje, campo=f'datos_ventana2.{ruta}', codigo='DATOS_INVALIDOS')
        self.detalle = {'errores': errores}


# --- Enlace de activación (D-10): mensajes amables; el cliente decide por `codigo` ---
class ErrorEnlaceActivacion(ErrorAccesoPostulante):
    codigo = 'ENLACE_INVALIDO'
    mensaje = 'Este enlace no es válido. Pide a Captación un enlace nuevo.'

    def __init__(self, mensaje: str | None = None, *, campo: str | None = None):
        super().__init__(mensaje or self.mensaje, campo=campo)


class EnlaceInvalido(ErrorEnlaceActivacion):
    """No existe, fue reemplazado por otro o el expediente ya no admite acceso."""


class EnlaceVencido(ErrorEnlaceActivacion):
    codigo = 'ENLACE_VENCIDO'
    mensaje = 'Este enlace venció. Pide a Captación un enlace nuevo.'


class EnlaceUsado(ErrorEnlaceActivacion):
    codigo = 'ENLACE_USADO'
    mensaje = 'Este enlace ya se usó. Si ya creaste tu contraseña, ingresa con tu cédula; si no, pide a Captación un enlace nuevo.'


class EnlaceBloqueado(ErrorEnlaceActivacion):
    codigo = 'ENLACE_BLOQUEADO'
    mensaje = 'Este enlace se bloqueó por demasiados intentos. Pide a Captación un enlace nuevo.'


class DatosActivacionIncorrectos(ErrorEnlaceActivacion):
    """La cédula no coincide: mensaje genérico (no revela si el enlace existe ni de quién es)."""

    codigo = 'ACTIVACION_DATOS_INCORRECTOS'
    mensaje = 'No pudimos verificar tus datos. Revisa tu cédula e inténtalo de nuevo.'
