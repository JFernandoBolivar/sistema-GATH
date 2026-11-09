"""
Tests unitarios de `upsert_contrato` (Arquitectura Onion pura sin BD).

Cubre en particular la regresión corregida en la Fase 2.2 del plan de
reparación (`PLAN_REPARACION_GATH.md`): `generar_numero_contrato` siempre
caía al default `'C'` porque ningún llamador poblaba `politica_nombre`.
"""
import pytest
from dataclasses import dataclass

from apps.personal.application.use_cases.upsert_contrato import upsert_contrato
from core.domain.exceptions import ValidationError


@dataclass
class _PoliticaFalsa:
    pk: int
    tipo_politica: str


class RepoContratosMemoria:
    def __init__(self, organismo_conatel="CONATEL", contratos_existentes=None):
        self.organismo_conatel = organismo_conatel
        self.contratos_existentes = contratos_existentes or {}
        self.guardados: list[dict] = []

    def contar_contratos_de_empleado(self, cedula):
        return len(self.contratos_existentes.get(cedula, []))

    def buscar_contrato_por_numero(self, cedula, n_contrato):
        for c in self.contratos_existentes.get(cedula, []):
            if c['n_contrato'] == n_contrato:
                return c
        return None

    def obtener_organismo_conatel(self):
        return self.organismo_conatel

    def guardar_contrato(self, cedula, datos):
        self.guardados.append(datos)
        return {'id': len(self.guardados), 'n_contrato': datos['n_contrato'], 'es_fijo': datos['es_fijo']}


def test_upsert_contrato_deriva_inicial_desde_politica_id_resuelto():
    """Regresión: `politica_id` llega como instancia resuelta (no un id plano ni `politica_nombre`)."""
    repo = RepoContratosMemoria()
    politica = _PoliticaFalsa(pk=5, tipo_politica="HONORARIOS PROFESIONALES")

    resultado = upsert_contrato(
        repo,
        cedula="12345678",
        contrato_data=[{
            'fecha_ingreso': '2026-01-01',
            'politica_id': politica,
        }],
    )

    assert resultado['n_contrato'].startswith('H-12345678-')
    assert repo.guardados[0]['n_contrato'].startswith('H-')


def test_upsert_contrato_respeta_politica_nombre_explicito_si_se_provee():
    repo = RepoContratosMemoria()
    politica = _PoliticaFalsa(pk=5, tipo_politica="HONORARIOS PROFESIONALES")

    resultado = upsert_contrato(
        repo,
        cedula="12345678",
        contrato_data=[{
            'fecha_ingreso': '2026-01-01',
            'politica_id': politica,
            'politica_nombre': 'CONTRATADO',
        }],
    )

    assert resultado['n_contrato'].startswith('C-12345678-')


def test_upsert_contrato_sin_organismo_conatel_lanza_error():
    repo = RepoContratosMemoria(organismo_conatel=None)
    with pytest.raises(ValidationError):
        upsert_contrato(
            repo,
            cedula="12345678",
            contrato_data=[{'fecha_ingreso': '2026-01-01', 'politica_id': _PoliticaFalsa(1, 'CONTRATADO')}],
        )


def test_upsert_contrato_tercer_contrato_se_marca_fijo():
    repo = RepoContratosMemoria(
        contratos_existentes={"12345678": [
            {'n_contrato': 'C-12345678-01', 'es_fijo': False},
            {'n_contrato': 'C-12345678-02', 'es_fijo': False},
        ]},
    )
    politica = _PoliticaFalsa(pk=1, tipo_politica="CONTRATADO")

    upsert_contrato(
        repo,
        cedula="12345678",
        contrato_data=[{'fecha_ingreso': '2026-01-01', 'politica_id': politica}],
    )

    assert repo.guardados[0]['es_fijo'] is True
    assert repo.guardados[0]['fecha_culminacion'] is None
