"""
Contrato transversal de notificaciones (campana en el sistema + correo).

Los módulos de negocio construyen una `SolicitudNotificacion` y la entregan al puerto `Notificador`
(`core.domain.ports`); no saben cómo se guarda ni cómo se envía. Puro: sin Django.
"""
from dataclasses import dataclass

from core.domain.exceptions import ValidationError


# Ámbitos de la bandeja: cada notificación pertenece a UN módulo y solo se ve en la bandeja de ese módulo.
MODULOS_NOTIFICACION = ('autogestion', 'personal', 'pasivos', 'carnetizacion', 'seguridad')
MODULO_POR_DEFECTO = 'autogestion'


def validar_enlace_interno(enlace: str) -> str:
    """El enlace es una ruta relativa del propio sistema: nunca un esquema ni un host externo."""
    if not enlace:
        return ''
    prohibidos = ('//', '://', chr(92), chr(10), chr(13))
    if not enlace.startswith('/') or any(p in enlace for p in prohibidos):
        raise ValidationError('El enlace de la notificación debe ser una ruta interna relativa (p. ej. /autogestion/solicitudes/1).')
    return enlace


@dataclass(frozen=True)
class AdjuntoCorreo:
    """Archivo adjunto: bytes en línea (`contenido`) o clave del almacén (`clave_almacen`), no ambos."""

    nombre: str
    mime: str = 'application/pdf'
    contenido: bytes | None = None
    clave_almacen: str = ''

    def __post_init__(self):
        if bool(self.contenido) == bool(self.clave_almacen):
            raise ValidationError('El adjunto debe traer su contenido o la clave del almacén (solo uno).')


@dataclass(frozen=True)
class CorreoSolicitado:
    """Correo que acompaña a la notificación; cada destinatario (una cédula o todas las cuentas con el permiso) lo recibe en su correo de acceso."""

    asunto: str
    adjuntos: tuple[AdjuntoCorreo, ...] = ()
    copia_a: tuple[str, ...] = ()  # correos en copia (p. ej. el correo alternativo del pasivo)


@dataclass(frozen=True)
class SolicitudNotificacion:
    """
    Una notificación a una persona (`cedula_destino`) o a todas las cuentas activas con un permiso
    (`permiso_destino`, nunca por nombre de rol). `clave` distingue ocurrencias repetibles del mismo
    hecho (p. ej. la fecha fin de cada prórroga): misma (tipo, ref_id, clave) => no se duplica.
    """

    tipo: str
    titulo: str
    mensaje: str
    cedula_destino: str = ''
    permiso_destino: str = ''
    enlace: str = ''
    ref_tipo: str = ''
    ref_id: str = ''
    clave: str = ''
    excluir_cedulas: tuple[str, ...] = ()
    correo: CorreoSolicitado | None = None
    modulo: str = MODULO_POR_DEFECTO  # bandeja en que aparece; se fija en el origen

    def __post_init__(self):
        if self.modulo not in MODULOS_NOTIFICACION:
            raise ValidationError(f'Módulo de notificación desconocido: {self.modulo}.')
        if bool(self.cedula_destino) == bool(self.permiso_destino):
            raise ValidationError('La notificación debe tener una cédula destino o un permiso destino (solo uno).')
        if not self.tipo or not self.titulo.strip() or not self.mensaje.strip():
            raise ValidationError('La notificación requiere tipo, título y mensaje.')
        validar_enlace_interno(self.enlace)
