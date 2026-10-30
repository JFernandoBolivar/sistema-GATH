"""Unitarios (sin BD) de la verificación de constancias por QR: enmascarado, formato del código y casos de uso."""
from dataclasses import replace

import pytest

from apps.fe_de_vida.application.use_cases.consultas import verificar_constancia, verificar_constancia_publica
from apps.fe_de_vida.domain.entities.constancia import Certificador, ConstanciaFeDeVida
from apps.fe_de_vida.domain.services.verificacion import codigo_con_formato_valido, enmascarar_cedula
from apps.fe_de_vida.domain.value_objects.estados import EstadoSolicitud
from core.domain.exceptions import NotFoundError
from tests.unit.fe_de_vida.memoria import AHORA, PASIVO, LectorPasivosMem, Mundo

CODIGO = 'a1' * 32
CERTIFICANTES = (Certificador('Ana Analista', '20000001', 'ANALISTA'), Certificador('Ada Admin', '20000002', 'ADMINISTRADORA'))


@pytest.mark.parametrize('cedula,esperado', [
    ('10079123', '10****23'), ('5111111', '51***11'), ('123456', '1****6'), ('12345', '1***5'),
    ('1234', '****'), ('', ''), (' 10079123 ', '10****23'),
])
def test_enmascarar_cedula_oculta_los_digitos_centrales(cedula, esperado):
    assert enmascarar_cedula(cedula) == esperado


def test_enmascarado_conserva_la_longitud_y_nunca_expone_el_centro():
    for cedula in ('10079123', '5111111', '123456'):
        m = enmascarar_cedula(cedula)
        assert len(m) == len(cedula) and m != cedula and '*' in m


@pytest.mark.parametrize('codigo,valido', [
    (CODIGO, True), ('', False), ('abc', False), ('A1' * 32, False), ('g1' * 32, False), (CODIGO + 'a', False),
])
def test_formato_del_codigo(codigo, valido):
    assert codigo_con_formato_valido(codigo) is valido


class RepoConstanciasMem:
    def __init__(self, *constancias):
        self.filas = {c.codigo_verificacion: c for c in constancias}

    def obtener_por_codigo(self, codigo):
        return self.filas.get(codigo)


@pytest.fixture
def mundo():
    m = Mundo()
    s = m.solicitud_enviada()
    constancia = ConstanciaFeDeVida('c1', s.id, 'FV-2026-000001', CODIGO, CERTIFICANTES, 1, emitida_en=AHORA)
    return m, s, RepoConstanciasMem(constancia)


def _validar(m, s):
    m.solicitudes.filas[s.id] = replace(m.solicitudes.filas[s.id], estado=EstadoSolicitud.VALIDADA)


def _publica(m, repo, codigo=CODIGO):
    return verificar_constancia_publica(repo, m.solicitudes, m.procesos, LectorPasivosMem(), codigo=codigo)


def test_publica_devuelve_cedula_enmascarada_y_sin_certificantes_ni_ids(mundo):
    m, s, repo = mundo
    _validar(m, s)
    v = _publica(m, repo)
    assert v.numero == 'FV-2026-000001' and v.proceso_nombre == m.proceso.nombre
    assert v.nombre_completo == f'Nombre {PASIVO}' and v.cedula == enmascarar_cedula(PASIVO) != PASIVO
    assert v.certificada_por == () and v.solicitud_id == ''


@pytest.mark.parametrize('codigo', ['inexistente', 'f' * 64, ''])
def test_publica_rechaza_codigo_malformado_o_inexistente_con_el_mismo_mensaje(mundo, codigo):
    m, s, repo = mundo
    _validar(m, s)
    with pytest.raises(NotFoundError) as e:
        _publica(m, repo, codigo)
    with pytest.raises(NotFoundError) as e2:
        _publica(m, RepoConstanciasMem(), CODIGO)
    assert str(e.value) == str(e2.value)


def test_publica_no_responde_si_la_solicitud_no_esta_validada(mundo):
    m, _, repo = mundo
    with pytest.raises(NotFoundError):
        _publica(m, repo)


def test_interna_devuelve_datos_completos_certificantes_y_solicitud(mundo):
    m, s, repo = mundo
    v = verificar_constancia(repo, m.solicitudes, m.procesos, LectorPasivosMem(), codigo=CODIGO)
    assert v.cedula == PASIVO and v.solicitud_id == s.id and v.certificada_por == CERTIFICANTES
    with pytest.raises(NotFoundError):
        verificar_constancia(repo, m.solicitudes, m.procesos, LectorPasivosMem(), codigo='x')
