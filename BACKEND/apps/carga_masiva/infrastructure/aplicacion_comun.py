"""Helpers compartidos de aplicación/reversión de cargas masivas."""
import logging
from datetime import date

from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from core.domain.configuracion import CLAVE_CARGA_MASIVA_APROBACION
from core.infrastructure.providers import obtener_lector_configuracion

logger = logging.getLogger('apps.carga_masiva.infrastructure.aplicacion')





def _id(modelo, nombre):
    if not nombre:
        return None
    campo = 'sexo' if modelo is SexoModel else 'nombre' if modelo is NacionalidadModel else 'estadoCivil'
    return modelo.objects.filter(**{f'{campo}__iexact': nombre}).values_list('id', flat=True).first()

def _fecha(valor) -> date | None:
    if isinstance(valor, date):
        return valor
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        return None

def _es_origen_movimiento(fila: CargaMasivaFilaModel) -> bool:
    movimiento = fila.movimiento or {}
    origen = movimiento.get('origen') or {}
    return (
        origen.get('tipo') == fila.tipo
        and int(origen.get('numero_fila') or 0) == int(fila.numero_fila)
    )

def _cedula_de(fila: CargaMasivaFilaModel) -> str:
    return str(fila.datos.get('cedula') or fila.datos.get('cedula_titular') or '')

def _requiere_aprobacion() -> bool:
    lector = obtener_lector_configuracion()
    if lector is None:
        return False
    return bool(lector.obtener_booleano(CLAVE_CARGA_MASIVA_APROBACION))
