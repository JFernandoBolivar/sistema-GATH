"""`guardar_contrato` resuelve el estatus del catalogo ('POR VENCER') y responde 400 si falta."""
from datetime import date
from unittest.mock import MagicMock

import pytest

from apps.personal.infrastructure.repositories import repo_personal_orm as modulo
from apps.personal.shared.domain.services.contrato_rules import ClaveEstatusContrato
from core.domain.exceptions import ValidationError


def _datos(clave):
    return {
        "n_contrato": "C-1-01", "fecha_ingreso": date(2026, 1, 1), "fecha_culminacion": None,
        "politica_id": 1, "es_fijo": False, "clave_estatus": clave,
        "organismo_conatel": MagicMock(), "existente": None,
    }


@pytest.fixture
def parchear(monkeypatch):
    contrato = MagicMock()
    contrato.pk = 5
    contrato.n_contrato = "C-1-01"
    contrato.es_fijo = False
    monkeypatch.setattr(modulo, "EmployeeModel", MagicMock())
    monkeypatch.setattr(modulo, "AntecedenteServicioModel", MagicMock())
    monkeypatch.setattr(modulo, "ContratoModel", MagicMock(return_value=contrato))
    estatus = MagicMock()
    monkeypatch.setattr(modulo, "EstatusModel", estatus)
    return estatus


def test_por_vencer_busca_el_nombre_del_catalogo_con_espacio(parchear):
    parchear.objects.filter.return_value.first.return_value = MagicMock()
    resultado = modulo.RepoPersonalORM().guardar_contrato("1", _datos(ClaveEstatusContrato.POR_VENCER))
    parchear.objects.filter.assert_called_once_with(estatus__iexact="por vencer")
    assert resultado["id"] == 5


def test_estatus_inexistente_da_error_de_validacion_claro(parchear):
    parchear.objects.filter.return_value.first.return_value = None
    with pytest.raises(ValidationError, match="No existe el estatus de contrato"):
        modulo.RepoPersonalORM().guardar_contrato("1", _datos(ClaveEstatusContrato.ACTIVO))
