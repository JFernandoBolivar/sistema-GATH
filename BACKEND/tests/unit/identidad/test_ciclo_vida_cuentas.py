"""
Tests del ciclo de vida de las cuentas (decisión F, D8) con repositorios en memoria:
alta automática (activo/pasivo), cédula como contraseña inicial con vencimiento a 7 días, «Restablecer
acceso», aviso por correo al cambiar la contraseña, cambio del correo de acceso y desactivación por egreso.
"""
from datetime import datetime, timedelta, timezone

import pytest

from apps.identidad.application.dtos.cuenta_dto import CambiarPasswordDTO
from apps.identidad.application.use_cases.aprovisionar_cuenta_trabajador import (
    aprovisionar_cuenta_trabajador,
)
from apps.identidad.application.use_cases.cambiar_correo_acceso import cambiar_correo_acceso
from apps.identidad.application.use_cases.cambiar_password import cambiar_password
from apps.identidad.application.use_cases.desactivar_cuenta_por_egreso import (
    desactivar_cuenta_por_egreso,
)
from apps.identidad.application.use_cases.restablecer_acceso import restablecer_acceso
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.events import MotivoCambioPassword, TipoEventoIdentidad
from apps.identidad.domain.services.notificaciones_eventos import solicitud_de_evento
from apps.identidad.domain.services.politica_password_inicial import (
    ROL_AUTOGESTION_ID,
    es_correo_institucional,
    vencimiento_desde,
)
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from tests.unit.identidad.conftest import RepoCuentasMemoria

AHORA = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)
DOMINIO = 'conatel.gob.ve'


class CuentasMem(RepoCuentasMemoria):
    def obtener_por_cedula(self, cedula):
        return next((c for c in self._cuentas.values() if c.cedula == cedula), None)

    def establecer_password(self, id, password_nuevo):
        super().establecer_password(id, password_nuevo)
        self.limpiado = getattr(self, 'limpiado', []) + [id]


class CorreosMem:
    def __init__(self, correos=None, alternativos=None):
        self.correos = dict(correos or {})
        self.alternativos = dict(alternativos or {})

    def existe_empleado(self, cedula):
        return cedula in self.correos

    def correo_de(self, cedula):
        return self.correos.get(cedula, '')

    def correo_alternativo_de(self, cedula):
        return self.alternativos.get(cedula, '')

    def correo_en_uso_por_otro(self, cedula, correo):
        return any(c != cedula and v.lower() == correo.lower() for c, v in self.correos.items())

    def establecer_correo(self, cedula, correo):
        self.correos[cedula] = correo


class CondicionMem:
    def __init__(self, condiciones):
        self.condiciones = condiciones

    def condicion_por_cedula(self, cedula):
        return self.condiciones.get(cedula, CondicionTrabajador.SIN_ASIGNACION)


class PasswordInicialMem:
    def __init__(self):
        self.filas = {}

    def emitir(self, cuenta_id, vence_en):
        self.filas[cuenta_id] = vence_en

    def vencimiento(self, cuenta_id):
        return self.filas.get(cuenta_id)

    def limpiar(self, cuenta_id):
        self.filas.pop(cuenta_id, None)


class VersionMem:
    def __init__(self):
        self.versiones = {}

    def incrementar_cuenta(self, cuenta_id):
        self.versiones[cuenta_id] = self.versiones.get(cuenta_id, 1) + 1
        return self.versiones[cuenta_id]


@pytest.fixture
def eventos():
    return []


def _alta(cuentas, correos, condiciones, pi, eventos, cedula):
    return aprovisionar_cuenta_trabajador(
        cuentas, correos, CondicionMem(condiciones), pi, eventos.append, cedula, DOMINIO, AHORA
    )


# ─── Alta automática ───

def test_activo_con_correo_institucional_recibe_cuenta_con_cedula_como_password(eventos):
    cuentas, pi = CuentasMem(), PasswordInicialMem()
    correos = CorreosMem({'123': 'ana@conatel.gob.ve'})

    cuenta = _alta(cuentas, correos, {'123': CondicionTrabajador.ACTIVO}, pi, eventos, '123')

    assert cuenta.rol_id == ROL_AUTOGESTION_ID
    assert cuentas.verificar_password(cuenta.id, '123')  # la cédula es la contraseña inicial
    assert pi.vencimiento(cuenta.id) == AHORA + timedelta(days=7)
    assert [e.tipo for e in eventos] == [TipoEventoIdentidad.CUENTA_CREADA]


def test_activo_con_correo_ajeno_al_dominio_no_recibe_cuenta(eventos):
    cuentas = CuentasMem()
    correos = CorreosMem({'123': 'ana@gmail.com'})

    assert _alta(cuentas, correos, {'123': CondicionTrabajador.ACTIVO}, PasswordInicialMem(), eventos, '123') is None
    assert not cuentas.existe_cuenta_para_cedula('123')
    assert eventos == []


def test_pasivo_recibe_cuenta_con_correo_de_cualquier_dominio(eventos):
    cuentas = CuentasMem()
    correos = CorreosMem({'456': 'luis@gmail.com'})

    cuenta = _alta(cuentas, correos, {'456': CondicionTrabajador.PASIVO}, PasswordInicialMem(), eventos, '456')

    assert cuenta is not None and cuenta.cedula == '456'


def test_sin_correo_o_sin_asignacion_no_hay_cuenta(eventos):
    cuentas = CuentasMem()
    correos = CorreosMem({'1': '', '2': 'x@conatel.gob.ve'})

    assert _alta(cuentas, correos, {'1': CondicionTrabajador.ACTIVO}, PasswordInicialMem(), eventos, '1') is None
    assert _alta(cuentas, correos, {}, PasswordInicialMem(), eventos, '2') is None


def test_no_duplica_si_ya_tiene_cuenta(eventos):
    cuentas, pi = CuentasMem(), PasswordInicialMem()
    correos = CorreosMem({'123': 'ana@conatel.gob.ve'})
    condiciones = {'123': CondicionTrabajador.ACTIVO}

    primera = _alta(cuentas, correos, condiciones, pi, eventos, '123')
    segunda = _alta(cuentas, correos, condiciones, pi, eventos, '123')

    assert primera is not None and segunda is None
    assert len(cuentas._cuentas) == 1
    assert len(eventos) == 1


def test_dominio_institucional_se_compara_sin_distinguir_mayusculas():
    assert es_correo_institucional('Ana@CONATEL.gob.ve', 'conatel.gob.ve')
    assert not es_correo_institucional('ana@otro.conatel.gob.ve.com', 'conatel.gob.ve')
    assert not es_correo_institucional('ana@gmail.com', '')


# ─── Vencimiento ───

def test_vencimiento_a_siete_dias():
    assert vencimiento_desde(AHORA) - AHORA == timedelta(days=7)


# ─── Restablecer acceso ───

def test_restablecer_acceso_repone_cedula_renueva_plazo_revoca_sesiones_y_avisa(eventos):
    cuenta = Cuenta(id=1, cedula='123', rol_id=3, is_active=True)
    cuentas = CuentasMem(cuentas=[cuenta], passwords={1: 'MiClave*Segura9'})
    pi, version = PasswordInicialMem(), VersionMem()
    pi.emitir(1, AHORA - timedelta(days=30))  # vencida

    restablecer_acceso(cuentas, pi, version, eventos.append, 1, AHORA)

    assert cuentas.verificar_password(1, '123')
    assert pi.vencimiento(1) == AHORA + timedelta(days=7)
    assert version.versiones[1] == 2
    assert eventos[0].tipo is TipoEventoIdentidad.PASSWORD_CAMBIADA
    assert eventos[0].motivo == MotivoCambioPassword.RESTABLECIDO_RRHH.value


def test_restablecer_acceso_rechaza_cuenta_inexistente_o_desactivada(eventos):
    inactiva = Cuenta(id=2, cedula='9', is_active=False)
    cuentas = CuentasMem(cuentas=[inactiva])

    with pytest.raises(NotFoundError):
        restablecer_acceso(cuentas, PasswordInicialMem(), VersionMem(), eventos.append, 99, AHORA)
    with pytest.raises(ValidationError):
        restablecer_acceso(cuentas, PasswordInicialMem(), VersionMem(), eventos.append, 2, AHORA)


# ─── Aviso al cambiar la contraseña ───

def _fortaleza_ok(_):
    return None


def test_cambio_voluntario_publica_aviso(eventos):
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123')], passwords={1: 'Actual*Clave1'})

    cambiar_password(cuentas, CambiarPasswordDTO(1, 'Actual*Clave1', 'Nueva*Clave22'), _fortaleza_ok, eventos.append)

    assert eventos[0].motivo == MotivoCambioPassword.VOLUNTARIO.value
    assert eventos[0].cedula == '123'


def test_primer_ingreso_con_la_cedula_es_cambio_obligatorio(eventos):
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123')], passwords={1: '123'})

    cambiar_password(cuentas, CambiarPasswordDTO(1, '123', 'Nueva*Clave22'), _fortaleza_ok, eventos.append)

    assert eventos[0].motivo == MotivoCambioPassword.OBLIGATORIO.value


def test_la_clave_nueva_si_pasa_por_los_validadores_de_fortaleza(eventos):
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123')], passwords={1: '123'})

    def fortaleza(_):
        raise ValidationError('débil')

    with pytest.raises(ValidationError):
        cambiar_password(cuentas, CambiarPasswordDTO(1, '123', '12345'), fortaleza, eventos.append)
    assert eventos == []


def test_el_evento_se_traduce_en_aviso_por_correo():
    from apps.identidad.domain.events import EventoIdentidad

    s = solicitud_de_evento(EventoIdentidad(
        tipo=TipoEventoIdentidad.PASSWORD_CAMBIADA, cedula='123', motivo=MotivoCambioPassword.ENLACE.value
    ))

    assert s.cedula_destino == '123'
    assert s.correo is not None and s.correo.asunto.startswith('[GATH]')
    assert 'enlace de recuperación' in s.mensaje


# ─── Cambiar correo de acceso (pase a pasivo) ───

def test_elegir_el_alternativo_actualiza_el_correo_y_avisa(eventos):
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123')])
    correos = CorreosMem({'123': 'ana@conatel.gob.ve'}, {'123': 'ana@gmail.com'})

    r = cambiar_correo_acceso(correos, cuentas, eventos.append, lambda c: None, '123', 'ALTERNATIVO')

    assert correos.correos['123'] == 'ana@gmail.com'
    assert r.avisado and not r.cuenta_creada
    assert eventos[0].tipo is TipoEventoIdentidad.CORREO_ACCESO_CAMBIADO


def test_elegir_el_institucional_no_cambia_el_correo_pero_avisa(eventos):
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123')])
    correos = CorreosMem({'123': 'ana@conatel.gob.ve'})

    cambiar_correo_acceso(correos, cuentas, eventos.append, lambda c: None, '123', 'INSTITUCIONAL')

    assert correos.correos['123'] == 'ana@conatel.gob.ve'
    assert len(eventos) == 1


def test_correo_ya_usado_por_otro_trabajador_se_rechaza(eventos):
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123')])
    correos = CorreosMem({'123': 'ana@conatel.gob.ve', '999': 'otro@gmail.com'}, {'123': 'otro@gmail.com'})

    with pytest.raises(ConflictError):
        cambiar_correo_acceso(correos, cuentas, eventos.append, lambda c: None, '123', 'ALTERNATIVO')
    assert correos.correos['123'] == 'ana@conatel.gob.ve'


def test_sin_alternativo_declarado_se_rechaza(eventos):
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123')])
    correos = CorreosMem({'123': 'ana@conatel.gob.ve'})

    with pytest.raises(ValidationError):
        cambiar_correo_acceso(correos, cuentas, eventos.append, lambda c: None, '123', 'ALTERNATIVO')
    with pytest.raises(NotFoundError):
        cambiar_correo_acceso(correos, cuentas, eventos.append, lambda c: None, '000', 'INSTITUCIONAL')


def test_pasivo_sin_cuenta_la_recibe_al_elegir_su_correo(eventos):
    cuentas, pi = CuentasMem(), PasswordInicialMem()
    correos = CorreosMem({'456': 'luis@conatel.gob.ve'}, {'456': 'luis@gmail.com'})
    condiciones = {'456': CondicionTrabajador.PASIVO}

    def aprovisionar(cedula):
        return _alta(cuentas, correos, condiciones, pi, eventos, cedula)

    r = cambiar_correo_acceso(correos, cuentas, eventos.append, aprovisionar, '456', 'ALTERNATIVO')

    assert r.cuenta_creada and r.avisado
    assert cuentas.existe_cuenta_para_cedula('456')
    assert [e.tipo for e in eventos] == [TipoEventoIdentidad.CUENTA_CREADA]  # un solo aviso


# ─── Egreso ───

def test_egreso_sin_pase_a_pasivo_desactiva_la_cuenta():
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123', is_active=True)])

    c = desactivar_cuenta_por_egreso(cuentas, CondicionMem({}), '123')

    assert c.is_active is False
    assert cuentas.obtener_por_id(1).is_active is False


def test_egreso_desactiva_cualquier_rol():
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123', rol_id=1)])  # ADMINISTRADOR

    assert desactivar_cuenta_por_egreso(cuentas, CondicionMem({}), '123').is_active is False


@pytest.mark.parametrize('condicion', [CondicionTrabajador.PASIVO, CondicionTrabajador.ACTIVO])
def test_pasivo_o_con_cargo_no_se_desactiva(condicion):
    cuentas = CuentasMem(cuentas=[Cuenta(id=1, cedula='123', is_active=True)])

    assert desactivar_cuenta_por_egreso(cuentas, CondicionMem({'123': condicion}), '123') is None
    assert cuentas.obtener_por_id(1).is_active is True


def test_egreso_de_quien_no_tiene_cuenta_no_falla():
    assert desactivar_cuenta_por_egreso(CuentasMem(), CondicionMem({}), '777') is None
