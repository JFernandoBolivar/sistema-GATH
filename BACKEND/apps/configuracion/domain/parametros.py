"""
Definiciones de los parámetros editables del sistema (D9).

La definición es la fuente de verdad del tipo, el grupo, el rango y el valor por
defecto; la tabla `configuracion_parametro_sistema` guarda el valor vigente y sus
metadatos. Puro: sin Django.
"""
from dataclasses import dataclass

from apps.autogestion.domain.value_objects.secciones import CODIGOS_SECCIONES
from core.domain.configuracion import (
    CLAVE_AUTOGESTION_ACTIVOS_HABILITADO,
    CLAVE_AUTOGESTION_ACTIVOS_SECCIONES,
    CLAVE_AUTOGESTION_AVISO_DIAS,
    CLAVE_AUTOGESTION_MAX_PRORROGAS,
    CLAVE_AUTOGESTION_PASIVOS_HABILITADO,
    CLAVE_AUTOGESTION_PASIVOS_SECCIONES,
    CLAVE_AVISAR_CUENTA_CREADA_POR_CORREO,
    CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR,
    CLAVE_FE_DE_VIDA_RECORDATORIOS,
    CLAVE_FE_DE_VIDA_REGISTRADOR_PUEDE_CHECAR,
    CLAVE_GENERAR_PUNTOS_CUENTA,
    CLAVE_NOTIFICAR_BIENESTAR_POR_CORREO,
    CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO,
    CLAVE_PASSWORD_INICIAL_DIAS,
    CLAVE_RETENCION_EVIDENCIAS_DIAS,
    CLAVE_RETENCION_NOTIFICACIONES_DIAS,
    CLAVE_RETENCION_OUTBOX_DIAS,
    CLAVE_RETENCION_SOPORTES_DIAS,
    como_dias,
)
from core.domain.exceptions import NotFoundError, ValidationError

TIPO_BOOLEANO = 'booleano'
TIPO_ENTERO = 'entero'
TIPO_TEXTO = 'texto'

GRUPO_NOTIFICACIONES = 'notificaciones'
GRUPO_PLAZOS = 'plazos'
GRUPO_FE_DE_VIDA = 'fe_de_vida'
GRUPO_RETENCION = 'retencion'
GRUPO_PUNTOS_CUENTA = 'puntocuenta'
GRUPO_AUTOGESTION = 'autogestion'

GRUPOS = (
    (GRUPO_NOTIFICACIONES, 'Notificaciones'),
    (GRUPO_PLAZOS, 'Plazos'),
    (GRUPO_FE_DE_VIDA, 'Fe de vida'),
    (GRUPO_AUTOGESTION, 'Autogestión'),
    (GRUPO_RETENCION, 'Retención de datos'),
    (GRUPO_PUNTOS_CUENTA, 'Puntos de cuenta'),
)

# Secciones que se pueden habilitar por condición. El orden y los códigos salen del
# dominio de autogestión (no de una lista escrita a mano).
SECCIONES_AUTOGESTION_DEFECTO = ','.join(CODIGOS_SECCIONES)

ACCION_PARAMETRO_ACTUALIZADO = 'configuracion.parametro_actualizado'
MODULO_AUDITORIA = 'configuracion'
RECURSO_AUDITORIA = 'parametro'

# Plazos de retención seleccionables (días, etiqueta). 0 = Nunca: no se borra nada.
RETENCION_NUNCA = 0
OPCIONES_RETENCION: tuple[tuple[int, str], ...] = (
    (30, '1 mes'),
    (90, '3 meses'),
    (180, '6 meses'),
    (365, '1 año'),
    (1095, '3 años'),
    (2190, '6 años'),
    (RETENCION_NUNCA, 'Nunca'),
)

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
    # (valor, etiqueta); si no está vacío, solo se aceptan esos valores.
    opciones: tuple[tuple[int, str], ...] = ()


DEFINICIONES = (
    ParametroDefinicion(
        clave=CLAVE_AUTOGESTION_ACTIVOS_HABILITADO,
        etiqueta='Permitir solicitudes de actualización a trabajadores activos',
        descripcion=(
            'Habilita el flujo de solicitudes de actualización de datos para el personal '
            'activo. Apagado, no pueden crear solicitudes nuevas ni editar borradores '
            'nuevos; las solicitudes ya creadas siguen su curso.'
        ),
        grupo=GRUPO_AUTOGESTION,
        tipo=TIPO_BOOLEANO,
        defecto='true',
    ),
    ParametroDefinicion(
        clave=CLAVE_AUTOGESTION_ACTIVOS_SECCIONES,
        etiqueta='Secciones habilitadas para trabajadores activos',
        descripcion=(
            'Secciones que puede pedir un trabajador activo al solicitar la actualización. '
            'Sepárelas con coma: ' + ', '.join(CODIGOS_SECCIONES) + '.'
        ),
        grupo=GRUPO_AUTOGESTION,
        tipo=TIPO_TEXTO,
        defecto=SECCIONES_AUTOGESTION_DEFECTO,
    ),
    ParametroDefinicion(
        clave=CLAVE_AUTOGESTION_PASIVOS_HABILITADO,
        etiqueta='Permitir solicitudes de actualización a trabajadores pasivos',
        descripcion=(
            'Habilita el flujo de solicitudes de actualización para el personal pasivo. '
            'Apagado por defecto: el administrador debe activarlo. Las solicitudes ya '
            'creadas siguen su curso.'
        ),
        grupo=GRUPO_AUTOGESTION,
        tipo=TIPO_BOOLEANO,
        defecto='false',
    ),
    ParametroDefinicion(
        clave=CLAVE_AUTOGESTION_PASIVOS_SECCIONES,
        etiqueta='Secciones habilitadas para trabajadores pasivos',
        descripcion=(
            'Secciones que puede pedir un trabajador pasivo cuando el flujo está habilitado. '
            'Sepárelas con coma: ' + ', '.join(CODIGOS_SECCIONES) + '.'
        ),
        grupo=GRUPO_AUTOGESTION,
        tipo=TIPO_TEXTO,
        defecto=SECCIONES_AUTOGESTION_DEFECTO,
    ),
    ParametroDefinicion(
        clave=CLAVE_GENERAR_PUNTOS_CUENTA,
        etiqueta='Generar puntos de cuenta',
        descripcion=(
            'Genera automáticamente un punto de cuenta cuando un trabajador cambia de '
            'Gerencia/Oficina (por actualización del código o por traslado). Apagado, '
            'no se genera ninguno.'
        ),
        grupo=GRUPO_PUNTOS_CUENTA,
        tipo=TIPO_BOOLEANO,
        defecto='false',
    ),
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
        clave=CLAVE_AVISAR_CUENTA_CREADA_POR_CORREO,
        etiqueta='Enviar correos de acceso a los trabajadores',
        descripcion=(
            'Envía al trabajador los correos que le dan acceso a GATH: «Su cuenta está lista», '
            '«Gestión Humana restableció su acceso» y «Este es ahora su correo de acceso». '
            'Apagado, las cuentas se crean y restablecen igual pero no se envía ningún correo '
            '(el aviso queda solo dentro del sistema): manténgalo apagado hasta que Gestión '
            'Humana anuncie el sistema.'
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
    ParametroDefinicion(
        clave=CLAVE_FE_DE_VIDA_REGISTRADOR_PUEDE_CHECAR,
        etiqueta='Permitir que quien registra una fe de vida presencial dé uno de los checks',
        descripcion=(
            'Permite que el funcionario de Bienestar que registró la fe de vida presencial '
            'pueda también dar uno de los dos checks de revisión, devolverla, rechazarla o retirar su check. '
            'Aplica a Analistas y demás roles; no aplica a la Administradora (véase el parámetro siguiente). '
            'Apagado por defecto: quien registró no decide sobre su propio registro.'
        ),
        grupo=GRUPO_FE_DE_VIDA,
        tipo=TIPO_BOOLEANO,
        defecto='false',
    ),
    ParametroDefinicion(
        clave=CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR,
        etiqueta='Permitir que la Administradora que registró una fe de vida presencial la apruebe de forma directa',
        descripcion=(
            'Si está activo, la Administradora que registró la fe de vida presencial puede aprobarla de forma '
            'directa, con justificación obligatoria y sin check previo de una Analista; queda marcado que quien '
            'registró también aprobó. No le permite dar check, devolver, rechazar ni retirar check de su propio '
            'registro. Apagado por defecto.'
        ),
        grupo=GRUPO_FE_DE_VIDA,
        tipo=TIPO_BOOLEANO,
        defecto='false',
    ),
    ParametroDefinicion(
        clave=CLAVE_RETENCION_EVIDENCIAS_DIAS,
        etiqueta='Retención de evidencias de fe de vida',
        descripcion=(
            'Tiempo que se conservan las selfies y evidencias de las solicitudes de fe de vida. '
            'Después se elimina el archivo; la constancia y la auditoría nunca se borran. '
            '«Nunca» conserva los archivos indefinidamente.'
        ),
        grupo=GRUPO_RETENCION,
        tipo=TIPO_ENTERO,
        defecto='365',
        opciones=OPCIONES_RETENCION,
    ),
    ParametroDefinicion(
        clave=CLAVE_RETENCION_SOPORTES_DIAS,
        etiqueta='Retención de soportes de autogestión',
        descripcion=(
            'Tiempo que se conservan los soportes documentales subidos por los trabajadores. '
            'Al vencer se elimina el archivo y su registro de soporte. '
            '«Nunca» conserva los archivos indefinidamente.'
        ),
        grupo=GRUPO_RETENCION,
        tipo=TIPO_ENTERO,
        defecto='365',
        opciones=OPCIONES_RETENCION,
    ),
    ParametroDefinicion(
        clave=CLAVE_RETENCION_NOTIFICACIONES_DIAS,
        etiqueta='Retención de notificaciones leídas',
        descripcion=(
            'Tiempo que se conservan las notificaciones ya leídas. Las no leídas no se purgan. '
            '«Nunca» las conserva indefinidamente.'
        ),
        grupo=GRUPO_RETENCION,
        tipo=TIPO_ENTERO,
        defecto='180',
        opciones=OPCIONES_RETENCION,
    ),
    ParametroDefinicion(
        clave=CLAVE_RETENCION_OUTBOX_DIAS,
        etiqueta='Retención del correo saliente',
        descripcion=(
            'Tiempo que se conservan los correos enviados o fallidos y sus adjuntos. '
            'Los pendientes no se purgan. «Nunca» conserva los archivos indefinidamente.'
        ),
        grupo=GRUPO_RETENCION,
        tipo=TIPO_ENTERO,
        defecto='90',
        opciones=OPCIONES_RETENCION,
    ),
)

DEFINICIONES_POR_CLAVE = {definicion.clave: definicion for definicion in DEFINICIONES}


def definicion_de(clave: str) -> ParametroDefinicion:
    definicion = DEFINICIONES_POR_CLAVE.get(clave)
    if definicion is None:
        raise NotFoundError(f'El parámetro «{clave}» no existe.')
    return definicion


def validar_valor(
    definicion: ParametroDefinicion, valor_crudo, valor_actual: str | None = None
) -> str:
    """Normaliza y valida el valor según el tipo; devuelve el texto a guardar.

    En los parámetros con opciones solo se aceptan esas, salvo el valor ya guardado
    (compatibilidad con datos anteriores a la lista).
    """
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
        if definicion.opciones:
            permitidos = {valor for valor, _ in definicion.opciones}
            if numero not in permitidos and str(numero) != (valor_actual or '').strip():
                etiquetas = ', '.join(etiqueta for _, etiqueta in definicion.opciones)
                raise ValidationError(
                    f'«{definicion.etiqueta}» debe ser una de estas opciones: {etiquetas}.'
                )
            return str(numero)
        if definicion.minimo is not None and numero < definicion.minimo:
            raise ValidationError(
                f'«{definicion.etiqueta}» debe ser mayor o igual a {definicion.minimo}.'
            )
        if definicion.maximo is not None and numero > definicion.maximo:
            raise ValidationError(
                f'«{definicion.etiqueta}» debe ser menor o igual a {definicion.maximo}.'
            )
        return str(numero)
    if definicion.clave in (
        CLAVE_AUTOGESTION_ACTIVOS_SECCIONES, CLAVE_AUTOGESTION_PASIVOS_SECCIONES,
    ):
        pedidas = {
            parte.strip().lower()
            for parte in texto.replace(';', ',').split(',')
            if parte.strip()
        }
        desconocidas = sorted(pedidas - set(CODIGOS_SECCIONES))
        if desconocidas:
            raise ValidationError(
                f'«{definicion.etiqueta}» tiene secciones desconocidas: '
                + ', '.join(desconocidas)
                + '.'
            )
        if not pedidas:
            raise ValidationError(f'«{definicion.etiqueta}» debe incluir al menos una sección.')
        return ','.join(codigo for codigo in CODIGOS_SECCIONES if codigo in pedidas)
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
