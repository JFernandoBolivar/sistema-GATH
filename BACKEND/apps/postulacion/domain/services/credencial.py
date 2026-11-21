"""
Reglas de la credencial del postulante (§4.3, §13.3). Puro: no persiste nada ni conoce Django.

Constantes de seguridad (documentadas aquí, no dispersas):
  - MAX_INTENTOS_FALLIDOS = 5: al quinto fallo seguido la credencial se bloquea.
  - MINUTOS_BLOQUEO = 15: duración del bloqueo; al vencer, el contador parte de cero.
  - LONGITUD_CLAVE_TEMPORAL = 12 (mínimo exigido 10): contraseña temporal aleatoria con `secrets`.
  - DURACION_SESION_INVITADO = 2 h: tope de la sesión de invitado (§13.3); además nunca excede `vence_el`.

El acceso solo existe mientras el expediente está en una etapa del postulante (`ESTADOS_CON_ACCESO`) y la
credencial no ha vencido. En las demás etapas la credencial queda «suspendida»: no se revoca, pero no entra nadie.
"""
import re
import secrets
from dataclasses import replace
from datetime import datetime, timedelta

from apps.postulacion.domain.entities.credencial import CredencialPostulante
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.errores import AccesoNoDisponible, CredencialBloqueada, CredencialVencida
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import ValidationError

E = EstadoExpediente

MAX_INTENTOS_FALLIDOS = 5
MINUTOS_BLOQUEO = 15
LONGITUD_MINIMA_CLAVE = 10
LONGITUD_MAXIMA_CLAVE = 128
LONGITUD_CLAVE_TEMPORAL = 12
DURACION_SESION_INVITADO = timedelta(hours=2)

# Etapas en que el postulante puede entrar y actuar: las que abren una ventana suya.
ESTADOS_CON_ACCESO: frozenset[EstadoExpediente] = frozenset({
    E.PRE_REGISTRADO, E.EN_CAPTURA, E.EN_CORRECCION_DATOS, E.CONSOLIDANDO,
})

# Sin caracteres ambiguos (0/O, 1/l/I): la contraseña se dicta o se lee en persona.
_MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
_MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz'
_DIGITOS = '23456789'


def generar_clave_temporal(longitud: int = LONGITUD_CLAVE_TEMPORAL) -> str:
    """Contraseña temporal aleatoria (CSPRNG): al menos una mayúscula, una minúscula y un dígito."""
    if longitud < LONGITUD_MINIMA_CLAVE:
        raise ValueError(f"La contraseña temporal debe tener al menos {LONGITUD_MINIMA_CLAVE} caracteres.")
    todos = _MAYUSCULAS + _MINUSCULAS + _DIGITOS
    caracteres = [secrets.choice(_MAYUSCULAS), secrets.choice(_MINUSCULAS), secrets.choice(_DIGITOS)]
    caracteres += [secrets.choice(todos) for _ in range(longitud - len(caracteres))]
    secrets.SystemRandom().shuffle(caracteres)
    return ''.join(caracteres)


def validar_clave_nueva(clave: str, *, cedula: str, clave_actual: str) -> str:
    """Política de la contraseña elegida por el postulante. Devuelve la clave o lanza `ValidationError`."""
    clave = clave or ''
    if len(clave) < LONGITUD_MINIMA_CLAVE:
        raise ValidationError(
            f"La nueva contraseña debe tener al menos {LONGITUD_MINIMA_CLAVE} caracteres.", campo='clave_nueva',
        )
    if len(clave) > LONGITUD_MAXIMA_CLAVE:
        raise ValidationError(
            f"La nueva contraseña admite como máximo {LONGITUD_MAXIMA_CLAVE} caracteres.", campo='clave_nueva',
        )
    if not (re.search(r'[A-Za-z]', clave) and re.search(r'\d', clave)):
        raise ValidationError("La nueva contraseña debe combinar letras y números.", campo='clave_nueva')
    if cedula and cedula in clave:
        raise ValidationError("La nueva contraseña no puede contener su cédula.", campo='clave_nueva')
    if clave == clave_actual:
        raise ValidationError("La nueva contraseña debe ser distinta de la actual.", campo='clave_nueva')
    return clave


def bloqueo_vigente(cred: CredencialPostulante, ahora: datetime) -> bool:
    return cred.bloqueada_hasta is not None and ahora < cred.bloqueada_hasta


def exigir_sin_bloqueo(cred: CredencialPostulante, ahora: datetime) -> None:
    if bloqueo_vigente(cred, ahora):
        raise CredencialBloqueada(
            f"Demasiados intentos fallidos: el acceso está bloqueado temporalmente. "
            f"Intente de nuevo en {MINUTOS_BLOQUEO} minutos como máximo.",
            bloqueada_hasta=cred.bloqueada_hasta,
        )


def exigir_vigente(cred: CredencialPostulante, estado: EstadoExpediente, ahora: datetime) -> None:
    """La credencial sirve si no está revocada, no venció y el expediente está en una etapa del postulante."""
    if cred.revocada:
        raise CredencialVencida("Su acceso fue cerrado. Solicite a Captación que lo habilite de nuevo.")
    if ahora > cred.vence_el:
        raise CredencialVencida(
            "Su acceso venció y ya no puede ingresar. Comuníquese con Captación para que lo reabra."
        )
    if estado not in ESTADOS_CON_ACCESO:
        raise AccesoNoDisponible(
            "Su expediente está siendo revisado por CONATEL y no admite cambios por ahora. "
            "Captación se comunicará con usted."
        )


def tras_fallo(cred: CredencialPostulante, ahora: datetime) -> CredencialPostulante:
    """Suma un intento fallido; al llegar al máximo bloquea `MINUTOS_BLOQUEO` y reinicia el contador."""
    intentos = cred.intentos_fallidos + 1
    if intentos >= MAX_INTENTOS_FALLIDOS:
        return replace(cred, intentos_fallidos=0, bloqueada_hasta=ahora + timedelta(minutes=MINUTOS_BLOQUEO))
    return replace(cred, intentos_fallidos=intentos)


def tras_exito(cred: CredencialPostulante, ahora: datetime) -> CredencialPostulante:
    return replace(cred, intentos_fallidos=0, bloqueada_hasta=None, ultimo_acceso=ahora)


def expiracion_sesion(cred: CredencialPostulante, ahora: datetime) -> datetime:
    """Fin de la sesión de invitado: el menor entre `ahora + 2 h` y el vencimiento de la credencial."""
    return min(ahora + DURACION_SESION_INVITADO, cred.vence_el)


def credencial_tras_transicion(
    cred: CredencialPostulante, origen: EstadoExpediente, exp: ExpedientePostulacion,
) -> CredencialPostulante:
    """
    Cómo queda la credencial cuando el expediente cambia de estado (el caso de uso lo aplica en la misma
    transacción):
      - terminal: se revoca;
      - destino con ventana del postulante: la vigencia y el número de ventana se alinean con el expediente
        (reabrir la Ventana 2 o devolver por observaciones EXTIENDE la credencial);
      - destino de revisión: queda suspendida y se cierran las sesiones abiertas (el postulante «envió»).
    """
    if exp.es_terminal:
        if cred.revocada:
            return cred
        return replace(cred, revocada=True, version_sesion=cred.version_sesion + 1)
    if exp.estado in ESTADOS_CON_ACCESO:
        if exp.ventana_vence_el and (exp.ventana_vence_el != cred.vence_el or (exp.ventana or cred.ventana) != cred.ventana):
            return replace(cred, ventana=exp.ventana or cred.ventana, vence_el=exp.ventana_vence_el)
        return cred
    if origen in ESTADOS_CON_ACCESO:
        return replace(cred, version_sesion=cred.version_sesion + 1)
    return cred
