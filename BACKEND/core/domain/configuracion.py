"""
Claves y lectura tolerante de los parámetros del sistema (D9).

El kernel solo conoce el contrato y las claves: cada módulo pide el valor al
puerto `LectorConfiguracion` (`core.domain.ports`) y nunca lee
`django.conf.settings` para estos parámetros. Los valores por defecto viven en
`apps.configuracion.domain.parametros` y la implementación del puerto los usa
como respaldo cuando la fila todavía no existe. Puro: sin Django.
"""

CLAVE_NOTIFICAR_BIENESTAR_POR_CORREO = 'notificaciones.bienestar_por_correo'
CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO = 'notificaciones.movimientos_por_correo'

CLAVE_PASSWORD_INICIAL_DIAS = 'plazos.password_inicial_dias'
CLAVE_AUTOGESTION_MAX_PRORROGAS = 'plazos.autogestion_max_prorrogas'
CLAVE_AUTOGESTION_AVISO_DIAS = 'plazos.autogestion_aviso_dias'

CLAVE_FE_DE_VIDA_RECORDATORIOS = 'fe_de_vida.dias_recordatorio'

VERDADEROS = frozenset({'1', 'true', 'si', 'sí', 'yes', 'on'})


def como_booleano(texto: str | None, por_defecto: bool = False) -> bool:
    if texto is None:
        return por_defecto
    return texto.strip().lower() in VERDADEROS


def como_entero(texto: str | None, por_defecto: int = 0) -> int:
    if texto is None:
        return por_defecto
    try:
        return int(str(texto).strip())
    except (TypeError, ValueError):
        return por_defecto


def como_dias(texto: str | None, por_defecto: tuple[int, ...] = ()) -> tuple[int, ...]:
    """Lista de días separada por comas; descarta repetidos/inválidos y ordena descendente."""
    if not texto:
        return por_defecto
    dias: set[int] = set()
    for parte in str(texto).replace(';', ',').split(','):
        parte = parte.strip()
        if not parte:
            continue
        try:
            dia = int(parte)
        except ValueError:
            continue
        if 1 <= dia <= 365:
            dias.add(dia)
    if not dias:
        return por_defecto
    return tuple(sorted(dias, reverse=True))
