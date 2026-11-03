"""Traduce un evento de identidad a la solicitud de aviso (campana + correo). Puro."""
from uuid import uuid4

from apps.identidad.domain.events import EventoIdentidad, MotivoCambioPassword, TipoEventoIdentidad
from core.domain.notificaciones import CorreoSolicitado, SolicitudNotificacion

_CIERRE = ' Si usted no reconoce este cambio, comuníquese de inmediato con la Oficina de Gestión Humana para resguardar su cuenta.'
_MOTIVOS = {
    MotivoCambioPassword.VOLUNTARIO.value: 'La cambió usted desde su cuenta.',
    MotivoCambioPassword.OBLIGATORIO.value: 'Reemplazó su contraseña inicial en su primer ingreso.',
    MotivoCambioPassword.ENLACE.value: 'Se restableció con el enlace de recuperación.',
    MotivoCambioPassword.RESTABLECIDO_RRHH.value: (
        'Gestión Humana restableció su acceso: su contraseña inicial vuelve a ser su cédula y '
        'deberá cambiarla en su próximo ingreso.'
    ),
}


def _es_aviso_de_acceso(e: EventoIdentidad) -> bool:
    """Correos que le revelan a alguien que tiene acceso a GATH (controlados por el parámetro)."""
    return (
        e.tipo is TipoEventoIdentidad.CUENTA_CREADA
        or e.tipo is TipoEventoIdentidad.CORREO_ACCESO_CAMBIADO
        or (e.tipo is TipoEventoIdentidad.PASSWORD_CAMBIADA and e.motivo == MotivoCambioPassword.RESTABLECIDO_RRHH.value)
    )


def solicitud_de_evento(
    e: EventoIdentidad, avisar_cuenta_creada_por_correo: bool = True,
) -> SolicitudNotificacion | None:
    """`avisar_cuenta_creada_por_correo=False` (parámetro «Enviar correos de acceso a los trabajadores»,
    apagado hasta que Gestión Humana anuncie el sistema): los avisos de acceso (cuenta creada, acceso
    restablecido, correo de acceso cambiado) quedan solo en la campana, sin correo. El aviso de
    contraseña cambiada por la propia persona sale siempre (alerta de seguridad)."""
    if e.tipo is TipoEventoIdentidad.PASSWORD_CAMBIADA and e.motivo == MotivoCambioPassword.RESTABLECIDO_RRHH.value:
        # QA 2026-11-03: «fue cambiada» confundía; es un restablecimiento con instrucciones para entrar.
        titulo = 'Gestión Humana restableció su acceso a GATH'
        plazo = f' y tiene {e.dias_vigencia} días para hacerlo' if e.dias_vigencia else ''
        mensaje = (
            'Gestión Humana restableció su acceso al sistema GATH. Ingrese con este correo y, como '
            f'contraseña, su número de cédula. Deberá cambiarla en su próximo ingreso{plazo}.{_CIERRE}'
        )
    elif e.tipo is TipoEventoIdentidad.PASSWORD_CAMBIADA:
        titulo = 'La contraseña de su cuenta fue cambiada'
        mensaje = f'La contraseña de su cuenta en GATH fue cambiada. {_MOTIVOS.get(e.motivo, "")}{_CIERRE}'
    elif e.tipo is TipoEventoIdentidad.CUENTA_CREADA:
        titulo = 'Su cuenta de GATH está lista'
        mensaje = (
            'Gestión Humana creó su cuenta en el sistema GATH. Ingrese con este correo y, como contraseña inicial, su número de '
            f'cédula. Deberá cambiarla en su primer ingreso y tiene {e.dias_vigencia} días para hacerlo; '
            'después puede usar ¿Olvidó su contraseña? o solicitar a Gestión Humana que restablezca el acceso.'
        )
    elif e.tipo is TipoEventoIdentidad.CORREO_ACCESO_CAMBIADO:
        titulo = 'Este es ahora su correo de acceso a GATH'
        mensaje = (
            'Gestión Humana registró este correo como su correo de acceso a GATH. A partir de ahora '
            'ingrese al sistema con este correo. Su contraseña no fue modificada.'
        )
    else:
        return None
    return SolicitudNotificacion(
        tipo='identidad.' + e.tipo.value.lower(), titulo=titulo, mensaje=mensaje,
        cedula_destino=e.cedula,
        # Cada ocurrencia es un aviso distinto (se puede cambiar la clave varias veces): sin esta clave el
        # outbox y la campana lo tomarían por duplicado.
        clave=uuid4().hex,
        correo=(
            None
            if _es_aviso_de_acceso(e) and not avisar_cuenta_creada_por_correo
            else CorreoSolicitado(asunto=titulo + ' - GATH CONATEL')
        ),
    )
