"""Transiciones del ciclo físico del carnet (B-5)."""
import pytest

from apps.carnetizacion.domain.value_objects import estado_fisico_carnet as est
from core.domain.exceptions import ConflictError


def test_un_carnet_inactivo_siempre_es_anulado():
    assert est.estado_efectivo(False, est.ENTREGADO) == est.ANULADO
    assert est.estado_efectivo(True, None) == est.EMITIDO
    assert est.estado_efectivo(True, est.IMPRESO) == est.IMPRESO


@pytest.mark.parametrize('actual,destino', [
    (est.EMITIDO, est.IMPRESO),
    (est.IMPRESO, est.ENTREGADO),
    (est.EMITIDO, est.ANULADO),
    (est.IMPRESO, est.ANULADO),
    (est.ENTREGADO, est.ANULADO),
])
def test_transiciones_permitidas(actual, destino):
    est.exigir_transicion(actual, destino)


@pytest.mark.parametrize('actual,destino', [
    (est.EMITIDO, est.ENTREGADO),   # no se entrega sin imprimir
    (est.IMPRESO, est.IMPRESO),
    (est.ENTREGADO, est.IMPRESO),
    (est.ANULADO, est.IMPRESO),
    (est.ANULADO, est.ENTREGADO),
    (est.ANULADO, est.ANULADO),
])
def test_transiciones_prohibidas(actual, destino):
    with pytest.raises(ConflictError):
        est.exigir_transicion(actual, destino)
