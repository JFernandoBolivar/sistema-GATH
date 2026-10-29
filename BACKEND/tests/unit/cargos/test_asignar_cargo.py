"""
Tests unitarios de asignación de cargo (normal y especial), gaps #3 y #5.
Puros, sin BD: repositorio en memoria implementando el puerto `RepoCargos`.
"""
import pytest

from apps.cargos.application.dtos.cargos_dtos import CrearCargoEspecialDTO
from apps.cargos.application.use_cases.asignar_cargo import asignar_cargo, desasignar_cargo
from apps.cargos.application.use_cases.asignar_cargo_especial import asignar_cargo_especial
from apps.cargos.domain.entities.cargo_asignacion import CargoAsignacion
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError


class RepoCargosMemoria:
    def __init__(self, cargos=()):
        self.cargos = {c.id: c for c in cargos}
        self.siguiente_id = max(self.cargos, default=0) + 1
        self.nominas_requieren_codigo = {}
        self.codigos_generados = []

    def obtener_cargo(self, cargo_id):
        return self.cargos.get(cargo_id)

    def asignar_cargo_a_empleado(self, cargo_id, cedula, motivo_id=None, usuario_id=None):
        cargo = self.cargos.get(cargo_id)
        if not cargo:
            raise NotFoundError('Cargo no encontrado')
        if cargo.empleado_cedula is not None:
            raise ConflictError('Este código ya está ocupado por el empleado.')
        actualizado = CargoAsignacion(
            **{**cargo.__dict__, 'empleado_cedula': cedula, 'estatus_nombre': 'ACTIVO'}
        )
        self.cargos[cargo_id] = actualizado
        return actualizado

    def desasignar_cargo(self, cargo_id, motivo_id=None, usuario_id=None):
        cargo = self.cargos.get(cargo_id)
        if not cargo:
            raise NotFoundError('Cargo no encontrado')
        actualizado = CargoAsignacion(**{**cargo.__dict__, 'empleado_cedula': None})
        self.cargos[cargo_id] = actualizado
        return actualizado

    def obtener_nombre_tipo_nomina(self, tipo_nomina_id):
        return self.nominas_requieren_codigo[tipo_nomina_id][0]

    def generar_siguiente_codigo_especial(self, prefijo):
        self.codigos_generados.append(prefijo)
        return f"{prefijo}0001"

    def crear_cargo_especial_y_asignar(self, datos):
        nombre, requiere = self.nominas_requieren_codigo[datos['tipo_nomina_id']]
        if not requiere:
            raise ValidationError('Esta nómina no permite generación automática de códigos especiales.')
        nuevo = CargoAsignacion(
            id=self.siguiente_id,
            codigo="CS_0001",
            empleado_cedula=datos['cedula_empleado'],
            denominacion_id=datos['denominacion_id'],
            denominacion_nombre='ANALISTA',
            especifica_id=datos['especifica_id'],
            especifica_nombre='ANALISTA I',
            tipo_nomina_id=datos['tipo_nomina_id'],
            tipo_nomina_nombre=nombre,
            estatus_id=1,
            estatus_nombre='ACTIVO',
            observaciones=datos.get('observaciones'),
        )
        self.cargos[nuevo.id] = nuevo
        self.siguiente_id += 1
        return nuevo


def _cargo_vacante(id_=1):
    return CargoAsignacion(
        id=id_, codigo='04010203', empleado_cedula=None,
        denominacion_id=1, denominacion_nombre='COORDINADOR',
        especifica_id=1, especifica_nombre='COORDINADOR I',
        tipo_nomina_id=1, tipo_nomina_nombre='FIJO',
        estatus_id=2, estatus_nombre='VACANTE',
    )


def test_asignar_cargo_vacante_lo_marca_activo():
    repo = RepoCargosMemoria([_cargo_vacante()])
    resultado = asignar_cargo(repo, cargo_id=1, cedula='V12345678')
    assert resultado.empleado_cedula == 'V12345678'
    assert resultado.estatus_nombre == 'ACTIVO'


def test_asignar_cargo_ocupado_lanza_conflicto():
    repo = RepoCargosMemoria([_cargo_vacante()])
    asignar_cargo(repo, cargo_id=1, cedula='V12345678')
    with pytest.raises(ConflictError):
        asignar_cargo(repo, cargo_id=1, cedula='V99999999')


def test_asignar_cargo_inexistente_lanza_not_found():
    repo = RepoCargosMemoria()
    with pytest.raises(NotFoundError):
        asignar_cargo(repo, cargo_id=999, cedula='V12345678')


def test_desasignar_cargo_libera_la_vacante():
    repo = RepoCargosMemoria([_cargo_vacante()])
    asignar_cargo(repo, cargo_id=1, cedula='V12345678')
    resultado = desasignar_cargo(repo, cargo_id=1)
    assert resultado.empleado_cedula is None


def test_asignar_cargo_especial_genera_codigo_y_asigna():
    repo = RepoCargosMemoria()
    repo.nominas_requieren_codigo[9] = ('COMISION DE SERVICIO', True)
    dto = CrearCargoEspecialDTO(
        cedula_empleado='V12345678', denominacion_id=1, especifica_id=1, tipo_nomina_id=9,
    )
    resultado = asignar_cargo_especial(repo, dto)
    assert resultado.empleado_cedula == 'V12345678'
    assert resultado.codigo == 'CS_0001'


def test_asignar_cargo_especial_con_nomina_sin_codigo_falla():
    repo = RepoCargosMemoria()
    repo.nominas_requieren_codigo[3] = ('FIJO', False)
    dto = CrearCargoEspecialDTO(
        cedula_empleado='V12345678', denominacion_id=1, especifica_id=1, tipo_nomina_id=3,
    )
    with pytest.raises(ValidationError):
        asignar_cargo_especial(repo, dto)
