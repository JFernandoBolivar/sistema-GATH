"""
Tests unitarios de sincronización y alta de cuentas con correo alternativo (FIX-AUD8 / FIX-QA11).
Verifica:
1. El correo alternativo no es login: un pasivo con solo alternativo NO recibe cuenta.
2. Con correo principal (`Employee.correo`) sí la recibe.
3. El rol se resuelve por nombre (AUTOGESTION) y no revienta si el rol no existe.
"""
from datetime import datetime, timezone
import pytest

from apps.identidad.application.use_cases.aprovisionar_cuenta_trabajador import (
    aprovisionar_cuenta_trabajador,
)
from apps.identidad.domain.events import TipoEventoIdentidad
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from tests.unit.identidad.conftest import RepoCuentasMemoria

AHORA = datetime(2026, 11, 6, 12, 0, tzinfo=timezone.utc)
DOMINIO = 'conatel.gob.ve'


class CuentasMem(RepoCuentasMemoria):
    def __init__(self, rol_autogestion_id: int | None = 3):
        super().__init__()
        self._rol_id = rol_autogestion_id

    def resolver_rol_autogestion_id(self) -> int | None:
        return self._rol_id


class CorreosMem:
    def __init__(self, institucionales=None, alternativos=None):
        self.inst = dict(institucionales or {})
        self.alt = dict(alternativos or {})

    def correo_de(self, cedula):
        # Como el repositorio real: solo `Employee.correo`; el alternativo no es login.
        return self.inst.get(cedula, '')

    def correo_alternativo_de(self, cedula):
        return self.alt.get(cedula, '')

    def correo_institucional_de(self, cedula):
        return self.inst.get(cedula, '')


class CondicionMem:
    def __init__(self, condiciones):
        self.condiciones = dict(condiciones)

    def condicion_por_cedula(self, cedula):
        return self.condiciones.get(cedula, CondicionTrabajador.SIN_ASIGNACION)


class PasswordInicialMem:
    def __init__(self):
        self.emitidos = {}

    def emitir(self, cuenta_id, vence_en):
        self.emitidos[cuenta_id] = vence_en


@pytest.fixture
def eventos():
    return []


def test_pasivo_con_solo_correo_alternativo_no_recibe_cuenta(eventos):
    cuentas = CuentasMem(rol_autogestion_id=10)
    correos = CorreosMem(institucionales={}, alternativos={'10001': 'pasivo@gmail.com'})
    condiciones = CondicionMem({'10001': CondicionTrabajador.PASIVO})
    pi = PasswordInicialMem()

    cuenta = aprovisionar_cuenta_trabajador(
        cuentas, correos, condiciones, pi, eventos.append, '10001', DOMINIO, AHORA,
        permitir_pasivo=True,
    )

    assert cuenta is None
    assert pi.emitidos == {}
    assert eventos == []


def test_pasivo_con_correo_principal_recibe_cuenta(eventos):
    cuentas = CuentasMem(rol_autogestion_id=10)
    correos = CorreosMem(
        institucionales={'10001': 'pasivo@gmail.com'}, alternativos={'10001': 'otro@gmail.com'},
    )
    condiciones = CondicionMem({'10001': CondicionTrabajador.PASIVO})
    pi = PasswordInicialMem()

    cuenta = aprovisionar_cuenta_trabajador(
        cuentas, correos, condiciones, pi, eventos.append, '10001', DOMINIO, AHORA,
        permitir_pasivo=True,
    )

    assert cuenta is not None and cuenta.rol_id == 10
    assert cuenta.id in pi.emitidos
    assert any(e.tipo == TipoEventoIdentidad.CUENTA_CREADA and e.cedula == '10001' for e in eventos)


def test_pasivo_con_permitir_pasivo_false_no_recibe_cuenta(eventos):
    cuentas = CuentasMem(rol_autogestion_id=10)
    correos = CorreosMem(institucionales={'10002': 'pasivo2@gmail.com'})
    condiciones = CondicionMem({'10002': CondicionTrabajador.PASIVO})
    pi = PasswordInicialMem()

    cuenta = aprovisionar_cuenta_trabajador(
        cuentas,
        correos,
        condiciones,
        pi,
        eventos.append,
        '10002',
        DOMINIO,
        AHORA,
        permitir_pasivo=False,
    )

    assert cuenta is None
    assert len(eventos) == 0


def test_sin_rol_autogestion_no_crea_cuenta_ni_falla(eventos):
    # Cuando el rol no existe (None), debe retornar None limpiamente sin reventar
    cuentas = CuentasMem(rol_autogestion_id=None)
    correos = CorreosMem(institucionales={'10003': 'pasivo3@gmail.com'})
    condiciones = CondicionMem({'10003': CondicionTrabajador.PASIVO})
    pi = PasswordInicialMem()

    cuenta = aprovisionar_cuenta_trabajador(
        cuentas,
        correos,
        condiciones,
        pi,
        eventos.append,
        '10003',
        DOMINIO,
        AHORA,
        permitir_pasivo=True,
    )

    assert cuenta is None
    assert len(eventos) == 0
