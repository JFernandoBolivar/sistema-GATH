"""Corregir cédula (caso de uso puro): validaciones, clave inicial y efectos sobre la cuenta."""
from contextlib import contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from apps.identidad.application.use_cases.corregir_cedula import (
    corregir_cedula,
    previsualizar_correccion_cedula,
)
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

AHORA = datetime(2026, 11, 11, tzinfo=timezone.utc)
AFECTADOS = [('Ficha del trabajador', 1), ('Asignación de cargo', 2)]


class RepoCorreccion:
    def __init__(self, existentes=('12345678',), ocupadas=(), falla=False):
        self.existentes, self.ocupadas, self.falla = set(existentes), set(ocupadas), falla
        self.aplicado = None

    def obtener_nombre(self, c):
        return 'PEREZ ANA' if c in self.existentes else None

    def contar_afectados(self, c):
        return AFECTADOS

    def existe_cedula(self, c):
        return c in self.ocupadas

    def aplicar(self, v, n):
        if self.falla:
            raise RuntimeError('fallo a mitad')
        self.aplicado = (v, n)
        return AFECTADOS


class RepoCuentas:
    def __init__(self, con_cuenta=True):
        self.cuenta = SimpleNamespace(id=7, correo='a@b.c') if con_cuenta else None
        self.claves = []

    def obtener_por_cedula(self, c):
        return self.cuenta

    def establecer_password(self, id, p):
        self.claves.append(p)


class RepoInicial:
    def __init__(self, pendiente):
        self.pendiente, self.emitido = pendiente, None

    def vencimiento(self, id):
        return AHORA if self.pendiente else None

    def emitir(self, id, vence):
        self.emitido = vence


class RepoVersion:
    def __init__(self):
        self.subidas = 0

    def obtener(self, id):
        return 3

    def incrementar_cuenta(self, id):
        self.subidas += 1
        return 3


class RepoCondicion:
    def condicion_por_cedula(self, c):
        return CondicionTrabajador.PASIVO


@contextmanager
def _atomico():
    yield


def _ejecutar(repo=None, cuentas=None, inicial=None, version=None, **extra):
    repo = repo or RepoCorreccion()
    cuentas = cuentas or RepoCuentas()
    inicial = inicial or RepoInicial(True)
    version = version or RepoVersion()
    eventos = {'auditoria': [], 'caches': []}
    args = dict(
        atomico=_atomico,
        auditar=lambda p, n: eventos['auditoria'].append((p, n)),
        invalidar_caches=lambda *a: eventos['caches'].append(a),
        ahora=AHORA, dias_vigencia=7, cedula_actual='12345678', cedula_nueva='12345687',
        motivo='Error de transcripción', confirmacion='12345687',
    )
    args.update(extra)
    return corregir_cedula(repo, cuentas, inicial, version, **args), eventos, repo, cuentas, inicial, version


def test_con_clave_inicial_la_clave_pasa_a_la_cedula_nueva():
    res, ev, repo, cuentas, inicial, version = _ejecutar()
    assert repo.aplicado == ('12345678', '12345687')
    assert cuentas.claves == ['12345687'] and inicial.emitido is not None
    assert res.clave_inicial_actualizada and res.total_registros == 3
    assert version.subidas == 0  # la sube `establecer_password`
    assert ev['auditoria'][0][0] == {'cedula': '12345678'}
    assert ev['auditoria'][0][1]['cedula'] == '12345687'
    assert ev['caches'] == [('12345678', '12345687', 'a@b.c', 3)]


def test_sin_clave_inicial_conserva_la_clave_y_sube_la_version():
    res, _, _, cuentas, inicial, version = _ejecutar(inicial=RepoInicial(False))
    assert cuentas.claves == [] and inicial.emitido is None
    assert not res.clave_inicial_actualizada and version.subidas == 1


def test_sin_cuenta_solo_reescribe_las_tablas():
    res, ev, *_ = _ejecutar(cuentas=RepoCuentas(con_cuenta=False))
    assert res.total_registros == 3 and ev['caches'][0][3] is None


@pytest.mark.parametrize('actual,nueva', [
    ('123', '12345687'), ('12345678', '1234abc7'), ('12345678', '1234567890'),
    ('12345678', '12345678'),
])
def test_formato_invalido_o_igual_es_400(actual, nueva):
    with pytest.raises(ValidationError):
        _ejecutar(cedula_actual=actual, cedula_nueva=nueva, confirmacion=nueva)


def test_confirmacion_incorrecta_es_400_y_no_toca_nada():
    repo = RepoCorreccion()
    with pytest.raises(ValidationError):
        _ejecutar(repo=repo, confirmacion='99999999')
    assert repo.aplicado is None


def test_motivo_corto_es_400():
    with pytest.raises(ValidationError):
        _ejecutar(motivo='corto')


def test_trabajador_inexistente_es_404():
    with pytest.raises(NotFoundError):
        _ejecutar(repo=RepoCorreccion(existentes=()))


def test_cedula_nueva_ocupada_es_409():
    repo = RepoCorreccion(ocupadas={'12345687'})
    with pytest.raises(ConflictError):
        _ejecutar(repo=repo)
    assert repo.aplicado is None


def test_un_fallo_a_mitad_se_propaga_sin_auditar_ni_limpiar_caches():
    eventos = {'a': [], 'c': []}
    with pytest.raises(RuntimeError):
        corregir_cedula(
            RepoCorreccion(falla=True), RepoCuentas(), RepoInicial(True), RepoVersion(),
            atomico=_atomico, auditar=lambda p, n: eventos['a'].append(1),
            invalidar_caches=lambda *a: eventos['c'].append(1), ahora=AHORA, dias_vigencia=7,
            cedula_actual='12345678', cedula_nueva='12345687', motivo='Error de transcripción',
            confirmacion='12345687',
        )
    assert eventos == {'a': [], 'c': []}


def test_vista_previa_describe_trabajador_cuenta_y_total():
    vista = previsualizar_correccion_cedula(
        RepoCorreccion(), RepoCondicion(), RepoCuentas(), RepoInicial(True),
        '12345678', '12345687',
    )
    assert vista.trabajador.nombre == 'PEREZ ANA' and vista.trabajador.condicion == 'PASIVO'
    assert vista.cuenta.clave_inicial_pendiente and vista.cuenta.correo == 'a@b.c'
    assert vista.total_registros == 3
