"""
Definiciones de los parámetros editables del sistema (D9).

La definición es la fuente de verdad del tipo, el grupo, el rango y el valor por
defecto; la tabla `configuracion_parametro_sistema` guarda el valor vigente y sus
metadatos. Puro: sin Django.
"""
from dataclasses import dataclass

from core.domain.configuracion import (
    CLAVE_AUTOGESTION_AVISO_DIAS,
    CLAVE_AUTOGESTION_MAX_PRORROGAS,
    CLAVE_FE_DE_VIDA_RECORDATORIOS,
    CLAVE_NOTIFICAR_BIENESTAR_POR_CORREO,
    CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO,
    CLAVE_PASSWORD_INICIAL_DIAS,
    como_dias,
)
from core.domain.exceptions import NotFoundError, ValidationError

TIPO_BOOLEANO = 'booleano'
TIPO_ENTERO = 'entero'
TIPO_TEXTO = 'texto'

GRUPO_NOTIFICACIONES = 'notificaciones'
GRUPO_PLAZOS = 'plazos'
GRUPO_FE_DE_VIDA = 'fe_de_vida'

GRUPOS = (
    (GRUPO_NOTIFICACIONES, 'Notificaciones'),
    (GRUPO_PLAZOS, 'Plazos'),
    (GRUPO_FE_DE_VIDA, 'Fe de vida'),
)

ACCION_PARAMETRO_ACTUALIZADO = 'configuracion.parametro_actualizado'
MODULO_AUDITORIA = 'configuracion'
RECURSO_AUDITORIA = 'parametro'

MAX_DIAS_RECORDATORIO = 365
MAX_RECORDATORIOS = 10


@dataclass(frozen=True)
class ParametroDefinicion:
    clave: str
    etiqueta: str
    descripcion: str
    grupo: str
    tipo: str
    defecto: str
    minimo: int | None = None
    maximo: int | None = None


DEFINICIONES = (
    ParametroDefinicion(
        clave=CLAVE_NOTIFICAR_BIENESTAR_POR_CORREO,
        etiqueta='Avisar a Bienestar por correo',
        descripcion=(
            'Además del aviso en el sistema, envía un correo a las cuentas de Bienestar '
            'cuando hay una solicitud nueva, una actualización enviada o una corrección.'
        ),
        grupo=GRUPO_NOTIFICACIONES,
        tipo=TIPO_BOOLEANO,
        defecto='false',
    ),
    ParametroDefinicion(
        clave=CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO,
        etiqueta='Avisar movimientos por correo',
        descripcion=(
            'Envía por correo los avisos de ingreso, traslado, cambio de estatus y egreso '
            'del personal. Apagado, solo se muestran en el sistema.'
        ),
        grupo=GRUPO_NOTIFICACIONES,
        tipo=TIPO_BOOLEANO,
        defecto='false',
    ),
    ParametroDefinicion(
        clave=CLAVE_PASSWORD_INICIAL_DIAS,
        etiqueta='Vigencia de la contraseña inicial',
        descripcion=(
            'Días que dura la contraseña inicial (la cédula) antes de vencer. Aplica al alta '
            'automática de la cuenta y a «Restablecer acceso».'
        ),
        grupo=GRUPO_PLAZOS,
        tipo=TIPO_ENTERO,
        defecto='7',
        minimo=1,
        maximo=365,
    ),
    ParametroDefinicion(
        clave=CLAVE_AUTOGESTION_MAX_PRORROGAS,
        etiqueta='Máximo de prórrogas por ventana',
        descripcion=(
            'Cantidad máxima de prórrogas que Bienestar puede conceder a una ventana de '
            'actualización. 0 = sin límite.'
        ),
        grupo=GRUPO_PLAZOS,
        tipo=TIPO_ENTERO,
        defecto='5',
        minimo=0,
        maximo=50,
    ),
    ParametroDefinicion(
        clave=CLAVE_AUTOGESTION_AVISO_DIAS,
        etiqueta='Anticipación del aviso de vencimiento',
        descripcion=(
            'Días antes del vencimiento en que se avisa al trabajador que su ventana de '
            'actualización está por cerrar.'
        ),
        grupo=GRUPO_PLAZOS,
        tipo=TIPO_ENTERO,
        defecto='1',
        minimo=1,
        maximo=30,
    ),
    ParametroDefinicion(
        clave=CLAVE_FE_DE_VIDA_RECORDATORIOS,
        etiqueta='Días de recordatorio sugeridos',
        descripcion=(
            'Días antes del cierre que se ofrecen como recordatorio al crear un proceso de '
            'fe de vida. Sepárelos con coma (por ejemplo 30,15,7,3,1).'
        ),
        grupo=GRUPO_FE_DE_VIDA,
        tipo=TIPO_TEXTO,
        defecto='30,15,7,3,1',
    ),
)

DEFINICIONES_POR_CLAVE = {definicion.clave: definicion for definicion in DEFINICIONES}


def definicion_de(clave: str) -> ParametroDefinicion:
    definicion = DEFINICIONES_POR_CLAVE.get(clave)
    if definicion is None:
        raise NotFoundError(f'El parámetro «{clave}» no existe.')
    return definicion


def validar_valor(definicion: ParametroDefinicion, valor_crudo) -> str:
    """Normaliza y valida el valor según el tipo; devuelve el texto a guardar."""
    texto = str(valor_crudo if valor_crudo is not None else '').strip()
    if definicion.tipo == TIPO_BOOLEANO:
        if texto.lower() not in ('true', 'false', '1', '0', 'si', 'sí', 'no'):
            raise ValidationError(f'«{definicion.etiqueta}» debe ser verdadero o falso.')
        return 'true' if texto.lower() in ('true', '1', 'si', 'sí') else 'false'
    if definicion.tipo == TIPO_ENTERO:
        try:
            numero = int(texto)
        except ValueError as exc:
            raise ValidationError(f'«{definicion.etiqueta}» debe ser un número entero.') from exc
        if definicion.minimo is not None and numero < definicion.minimo:
            raise ValidationError(
                f'«{definicion.etiqueta}» debe ser mayor o igual a {definicion.minimo}.'
            )
        if definicion.maximo is not None and numero > definicion.maximo:
            raise ValidationError(
                f'«{definicion.etiqueta}» debe ser menor o igual a {definicion.maximo}.'
            )
        return str(numero)
    if definicion.clave == CLAVE_FE_DE_VIDA_RECORDATORIOS:
        dias = como_dias(texto)
        if not dias:
            raise ValidationError(
                'Indique al menos un día de recordatorio entre 1 y 365, separado por comas.'
            )
        if len(dias) > MAX_RECORDATORIOS:
            raise ValidationError(f'No se pueden configurar más de {MAX_RECORDATORIOS} días.')
        return ','.join(str(dia) for dia in dias)
    if not texto:
        raise ValidationError(f'«{definicion.etiqueta}» no puede quedar vacío.')
    if len(texto) > 255:
        raise ValidationError(f'«{definicion.etiqueta}» no puede superar 255 caracteres.')
    return texto
