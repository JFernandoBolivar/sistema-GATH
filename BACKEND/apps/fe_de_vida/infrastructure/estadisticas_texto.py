"""Texto común del proceso en los reportes de estadísticas (PDF y Excel).

El estado y la prórroga acompañan al nombre del proceso para que el reporte no se lea como si un
proceso cerrado siguiera abierto (o como si ya no admitiera respuestas). La fecha se muestra en la
zona horaria local del servidor, igual que el resto de los reportes.
"""
from django.utils import timezone

from apps.fe_de_vida.domain.entities.estadisticas import EstadisticasFeDeVida


def detalle_proceso(estadisticas: EstadisticasFeDeVida) -> str:
    """«Cerrado · Prórroga general vigente hasta 27/11/2026 05:16» (sin el nombre del proceso)."""
    if estadisticas.proceso is None:
        return ''
    partes = [estadisticas.proceso.estado.title()]
    prorrogas = estadisticas.prorrogas
    if prorrogas.vigentes:
        if prorrogas.general_vigente:
            alcance = 'general'
        elif prorrogas.individuales_vigentes == 1:
            alcance = 'individual'
        else:
            alcance = f'{prorrogas.individuales_vigentes} individuales'
        hasta = (
            timezone.localtime(prorrogas.hasta).strftime('%d/%m/%Y %H:%M')
            if prorrogas.hasta else ''
        )
        partes.append(f'Prórroga {alcance} vigente hasta {hasta}'.strip())
    return ' · '.join(partes)
