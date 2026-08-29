"""
Tests unitarios de traslado de cargo y gestión de estatus de puesto
(Fase 2.5 del plan de reparación). Puros, sin BD: repositorio en memoria
implementando el puerto `RepoCargos`.
"""
import pytest

from apps.cargos.application.use_cases.cambiar_cargo import cambiar_cargo
from apps.cargos.application.use_cases.gestionar_estatus_puesto import gestionar_estatus_puesto
from apps.cargos.domain.entities.cargo_asignacion import CargoAsignacion
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError


class RepoCargosMemoria:
    def __init__(self, cargos=()):
        self.cargos = {c.id: c for c in cargos}
        self.motivos = {1: 'TRASLADO POR NECESIDAD', 2: 'BLOQUEO ADMINISTRATIVO'}
        self.estatus = {1: 'ACTIVO', 2: 'VACANTE', 3: 'SUSPENDIDO', 4: 'BLOQUEADO'}
        self.eventos = []

    def obtener_cargo(self, cargo_id):
        return self.cargos.get(cargo_id)

    def cambiar_cargo(self, cargo_actual_id, cargo_nuevo_id, motivo_id, usuario_id):
        actual = self.cargos.get(cargo_actual_id)
        if not actual:
            raise NotFoundError('Cargo actual no encontrado')
        if actual.empleado_cedula is None:
            raise ValidationError('El cargo actual no tiene empleado asignado.')
        nuevo = self.cargos.get(cargo_nuevo_id)
        if not nuevo:
            raise NotFoundError('Cargo nuevo no encontrado')
        if not nuevo.esta_vacante:
            raise ConflictError('El cargo seleccionado ya está ocupado.')

        cedula = actual.empleado_cedula
        self.cargos[cargo_actual_id] = CargoAsignacion(**{**actual.__dict__, 'empleado_cedula': None, 'estatus_nombre': 'VACANTE'})
        actualizado = CargoAsignacion(**{**nuevo.__dict__, 'empleado_cedula': cedula, 'estatus_nombre': 'ACTIVO', 'observaciones': self.motivos[motivo_id]})
        self.cargos[cargo_nuevo_id] = actualizado
        self.eventos.append(('TRASLADO', cargo_nuevo_id, cedula, motivo_id, usuario_id))
        return actualizado

    def gestionar_estatus_puesto(self, cargo_id, estatus_id, motivo_id, usuario_id):
        cargo = self.cargos.get(cargo_id)
        if not cargo:
            raise NotFoundError('Cargo no encontrado')
        nombre_estatus = self.estatus[estatus_id]
        if nombre_estatus.upper() not in ('SUSPENDIDO', 'BLOQUEADO', 'ACTIVO'):
            raise ValidationError('Gestión de estatus no permitida.')
        if cargo.estatus_id == estatus_id:
            raise ConflictError(f"El cargo ya se encuentra en estatus '{nombre_estatus}'.")
        actualizado = CargoAsignacion(**{**cargo.__dict__, 'estatus_id': estatus_id, 'estatus_nombre': nombre_estatus, 'observaciones': self.motivos[motivo_id]})
        self.cargos[cargo_id] = actualizado
        self.eventos.append(('CAMBIO DE ESTATUS', cargo_id, cargo.empleado_cedula, motivo_id, usuario_id))
        return actualizado


def _cargo(id_, empleado_cedula, estatus_id=1, estatus_nombre='ACTIVO'):
    return CargoAsignacion(
        id=id_, codigo=f"COD-{id_}", empleado_cedula=empleado_cedula,
        denominacion_id=1, denominacion_nombre='ANALISTA',
        especifica_id=1, especifica_nombre='ANALISTA I',
        tipo_nomina_id=1, tipo_nomina_nombre='FIJO',
        estatus_id=estatus_id, estatus_nombre=estatus_nombre,
    )


def test_cambiar_cargo_traslada_al_empleado_y_libera_el_anterior():
    repo = RepoCargosMemoria([_cargo(1, 'V12345678'), _cargo(2, None, estatus_id=2, estatus_nombre='VACANTE')])
    resultado = cambiar_cargo(repo, cargo_actual_id=1, cargo_nuevo_id=2, motivo_id=1, usuario_id=7)
    assert resultado.empleado_cedula == 'V12345678'
    assert resultado.estatus_nombre == 'ACTIVO'
    assert repo.cargos[1].empleado_cedula is None
    assert repo.eventos == [('TRASLADO', 2, 'V12345678', 1, 7)]


def test_cambiar_cargo_sin_empleado_en_origen_lanza_validacion():
    repo = RepoCargosMemoria([_cargo(1, None), _cargo(2, None, estatus_id=2, estatus_nombre='VACANTE')])
    with pytest.raises(ValidationError):
        cambiar_cargo(repo, cargo_actual_id=1, cargo_nuevo_id=2, motivo_id=1, usuario_id=7)


def test_cambiar_cargo_destino_ocupado_lanza_conflicto():
    repo = RepoCargosMemoria([_cargo(1, 'V12345678'), _cargo(2, 'V99999999')])
    with pytest.raises(ConflictError):
        cambiar_cargo(repo, cargo_actual_id=1, cargo_nuevo_id=2, motivo_id=1, usuario_id=7)


def test_gestionar_estatus_puesto_bloquea_el_cargo():
    repo = RepoCargosMemoria([_cargo(1, 'V12345678')])
    resultado = gestionar_estatus_puesto(repo, cargo_id=1, estatus_id=4, motivo_id=2, usuario_id=7)
    assert resultado.estatus_nombre == 'BLOQUEADO'
    assert repo.eventos == [('CAMBIO DE ESTATUS', 1, 'V12345678', 2, 7)]


def test_gestionar_estatus_puesto_mismo_estatus_lanza_conflicto():
    repo = RepoCargosMemoria([_cargo(1, 'V12345678')])
    with pytest.raises(ConflictError):
        gestionar_estatus_puesto(repo, cargo_id=1, estatus_id=1, motivo_id=2, usuario_id=7)
