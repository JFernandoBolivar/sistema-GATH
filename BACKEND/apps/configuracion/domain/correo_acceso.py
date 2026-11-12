"""
Dominio de Correo de Acceso (A7).

Reglas de configuración y resolución del correo de acceso para cuentas de autogestión:
1. Políticas por condición laboral:
   - Pasivos: INSTITUCIONAL (por defecto; el correo principal es el login), ALTERNATIVO, CORREO_FICHA.
   - Activos: INSTITUCIONAL (por defecto), ALTERNATIVO, CORREO_FICHA.
2. Si falta el correo elegido:
   - DEJAR_SIN_CUENTA (por defecto): no se crea/asigna cuenta hasta que se cargue.
   - USAR_SIGUIENTE: fallback al siguiente correo disponible.
3. Excepciones manuales respetadas en aplicaciones masivas salvo que se fuerce su inclusión.

Puro: sin Django ni DRF (regla B1).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Sequence

from core.domain.catalogos import CONDICION_PASIVO

MODULO_AUDITORIA_CONFIGURACION = 'configuracion'
RECURSO_POLITICA_CORREO_ACCESO = 'politica_correo_acceso'
RECURSO_CORREO_ACCESO_MASIVO = 'correo_acceso_masivo'

ACCION_POLITICA_CORREO_ACTUALIZADA = 'POLITICA_CORREO_ACCESO_ACTUALIZADA'
ACCION_APLICACION_MASIVA_CORREO = 'CORREO_ACCESO_APLICADO_MASIVO'


class PoliticaFuenteCorreo(str, Enum):
    ALTERNATIVO = 'alternativo'
    INSTITUCIONAL = 'institucional'
    CORREO_FICHA = 'correo_ficha'


class PoliticaFaltaCorreo(str, Enum):
    DEJAR_SIN_CUENTA = 'dejar_sin_cuenta'
    USAR_SIGUIENTE = 'usar_siguiente'


class GrupoTrabajadores(str, Enum):
    ACTIVOS = 'activos'
    PASIVOS = 'pasivos'


@dataclass(frozen=True)
class PoliticaCorreoAcceso:
    # O39: el correo principal (institucional de la ficha) es el login por defecto
    # de los pasivos. El alternativo ya no cambia el acceso.
    politica_pasivos: PoliticaFuenteCorreo = PoliticaFuenteCorreo.INSTITUCIONAL
    politica_activos: PoliticaFuenteCorreo = PoliticaFuenteCorreo.INSTITUCIONAL
    si_falta_elegido: PoliticaFaltaCorreo = PoliticaFaltaCorreo.DEJAR_SIN_CUENTA
    avisar_al_aplicar_masivo: bool = False


@dataclass(frozen=True)
class DatosCorreoTrabajador:
    cedula: str
    nombre_completo: str
    condicion: str  # 'ACTIVO' o 'PASIVO'
    correo_actual_acceso: str
    correo_institucional: str
    correo_alternativo: str
    correo_ficha: str
    tiene_cuenta: bool
    es_excepcion_manual: bool = False


@dataclass(frozen=True)
class ItemVistaPrevia:
    cedula: str
    nombre_completo: str
    condicion: str
    correo_actual: str
    correo_propuesto: str | None
    cambiara: bool
    quedara_sin_cuenta: bool
    es_excepcion_manual: bool
    motivo_exclusion: str | None = None


@dataclass(frozen=True)
class ResumenVistaPrevia:
    total_evaluados: int
    cambian: int
    quedan_igual: int
    quedan_sin_cuenta: int
    excepciones_manuales_ignoradas: int
    items: Sequence[ItemVistaPrevia]


def es_correo_valido(correo: str | None) -> bool:
    texto = (correo or '').strip()
    return bool(texto and '@' in texto and '.' in texto)


def resolver_correo_para_trabajador(
    datos: DatosCorreoTrabajador,
    politica: PoliticaCorreoAcceso,
) -> str | None:
    """
    Determina cuál debe ser el correo de acceso de un trabajador según la política vigente.
    Devuelve el correo válido resuelto o None si no tiene correo y debe quedar sin cuenta.
    """
    es_pasivo = datos.condicion.strip().upper() == CONDICION_PASIVO
    fuente_primaria = politica.politica_pasivos if es_pasivo else politica.politica_activos
    # O39: el alternativo nunca es login de un pasivo (solo el principal o la ficha).
    if es_pasivo and fuente_primaria == PoliticaFuenteCorreo.ALTERNATIVO:
        fuente_primaria = PoliticaFuenteCorreo.INSTITUCIONAL

    def obtener_correo_por_fuente(fuente: PoliticaFuenteCorreo) -> str:
        if fuente == PoliticaFuenteCorreo.ALTERNATIVO:
            return (datos.correo_alternativo or '').strip()
        if fuente == PoliticaFuenteCorreo.INSTITUCIONAL:
            # FIX-AUD8.7: para un pasivo el correo principal es el de la ficha,
            # sea cual sea su dominio (se aceptan correos externos). Para un
            # activo sigue siendo solo el institucional.
            if es_pasivo:
                return (datos.correo_institucional or datos.correo_ficha or '').strip()
            return (datos.correo_institucional or '').strip()
        if fuente == PoliticaFuenteCorreo.CORREO_FICHA:
            return (datos.correo_ficha or '').strip()
        return ''

    c_primario = obtener_correo_por_fuente(fuente_primaria)
    if es_correo_valido(c_primario):
        return c_primario

    # Si falta el correo elegido
    if politica.si_falta_elegido == PoliticaFaltaCorreo.DEJAR_SIN_CUENTA:
        return None

    # Fallback: Usar el siguiente disponible
    orden_fallback = (
        [PoliticaFuenteCorreo.CORREO_FICHA, PoliticaFuenteCorreo.INSTITUCIONAL]
        if es_pasivo
        else [PoliticaFuenteCorreo.CORREO_FICHA, PoliticaFuenteCorreo.ALTERNATIVO]
    )
    for f in orden_fallback:
        c_sec = obtener_correo_por_fuente(f)
        if es_correo_valido(c_sec):
            return c_sec

    return None


def generar_vista_previa_masiva(
    trabajadores: Sequence[DatosCorreoTrabajador],
    politica: PoliticaCorreoAcceso,
    incluir_excepciones: bool = False,
) -> ResumenVistaPrevia:
    """Calcula la vista previa de cambios masivos antes de aplicar."""
    items: list[ItemVistaPrevia] = []
    cambian = 0
    quedan_igual = 0
    quedan_sin_cuenta = 0
    excepciones_ignoradas = 0

    for t in trabajadores:
        if t.es_excepcion_manual and not incluir_excepciones:
            excepciones_ignoradas += 1
            items.append(
                ItemVistaPrevia(
                    cedula=t.cedula,
                    nombre_completo=t.nombre_completo,
                    condicion=t.condicion,
                    correo_actual=t.correo_actual_acceso,
                    correo_propuesto=t.correo_actual_acceso,
                    cambiara=False,
                    quedara_sin_cuenta=not t.tiene_cuenta,
                    es_excepcion_manual=True,
                    motivo_exclusion='Excepción manual respetada',
                )
            )
            continue

        correo_resuelto = resolver_correo_para_trabajador(t, politica)
        if correo_resuelto is None:
            quedan_sin_cuenta += 1
            cambia = bool(t.correo_actual_acceso)
            if cambia:
                cambian += 1
            items.append(
                ItemVistaPrevia(
                    cedula=t.cedula,
                    nombre_completo=t.nombre_completo,
                    condicion=t.condicion,
                    correo_actual=t.correo_actual_acceso,
                    correo_propuesto=None,
                    cambiara=cambia,
                    quedara_sin_cuenta=True,
                    es_excepcion_manual=t.es_excepcion_manual,
                )
            )
        elif correo_resuelto.lower() == (t.correo_actual_acceso or '').strip().lower():
            quedan_igual += 1
            items.append(
                ItemVistaPrevia(
                    cedula=t.cedula,
                    nombre_completo=t.nombre_completo,
                    condicion=t.condicion,
                    correo_actual=t.correo_actual_acceso,
                    correo_propuesto=correo_resuelto,
                    cambiara=False,
                    quedara_sin_cuenta=False,
                    es_excepcion_manual=t.es_excepcion_manual,
                )
            )
        else:
            cambian += 1
            items.append(
                ItemVistaPrevia(
                    cedula=t.cedula,
                    nombre_completo=t.nombre_completo,
                    condicion=t.condicion,
                    correo_actual=t.correo_actual_acceso,
                    correo_propuesto=correo_resuelto,
                    cambiara=True,
                    quedara_sin_cuenta=False,
                    es_excepcion_manual=t.es_excepcion_manual,
                )
            )

    return ResumenVistaPrevia(
        total_evaluados=len(trabajadores),
        cambian=cambian,
        quedan_igual=quedan_igual,
        quedan_sin_cuenta=quedan_sin_cuenta,
        excepciones_manuales_ignoradas=excepciones_ignoradas,
        items=items,
    )
