"""
Tests unitarios del subsistema de préstamo de cargo / encargaduría
(Fase 2.5 del plan de reparación). Puros, sin BD: repositorio en memoria
implementando el puerto `RepoCargos`.
"""
import datetime

import pytest

from apps.cargos.application.use_cases.prestamo_cargo import (
    crear_prestamo,
    finalizar_prestamo,
    listar_prestamos,
)
from apps.cargos.domain.entities.prestamo_cargo import PrestamoCargo
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError


class RepoPrestamosMemoria:
    def __init__(self):
        self.prestamos = {}
        self.siguiente_id = 1
        self.empleados = {'V11111111'}
        self.cargos_vacantes = {10, 11}

    def _base(self, id_, cedula, cargo_id, motivo_id, fecha_inicio, fecha_fin, usuario_id, estatus_nombre='ACTIVO'):
        return PrestamoCargo(
            id=id_, empleado_encargado_cedula=cedula, empleado_encargado_nombre='Juan Pérez',
            cargo_encargado_id=cargo_id, cargo_encargado_codigo=f"COD-{cargo_id}",
            titular_cedula='V22222222', titular_nombre='Ana Gómez',
            motivo_id=motivo_id, motivo_nombre='ENCARGADURIA POR VACANTE',
            estatus_id=1, estatus_nombre=estatus_nombre,
            fecha_inicio=fecha_inicio.isoformat(), fecha_fin=fecha_fin.isoformat(),
            ejecutado_por_id=usuario_id,
        )

    def listar_prestamos(self, solo_activos=False):
        valores = list(self.prestamos.values())
        if solo_activos:
            valores = [p for p in valores if not p.esta_finalizada]
        return valores

    def crear_prestamo(self, cedula_encargado, cargo_id, motivo_id, fecha_inicio, fecha_fin, usuario_id):
        if fecha_fin < fecha_inicio:
            raise ValidationError('La fecha de fin no puede ser anterior a la fecha de inicio.')
        if cedula_encargado not in self.empleados:
            raise NotFoundError('Empleado no encontrado.')
        if cargo_id not in self.cargos_vacantes:
            raise NotFoundError('Cargo no encontrado.')
        for p in self.prestamos.values():
            if p.cargo_encargado_id == cargo_id and not p.esta_finalizada:
                raise ConflictError('Ya existe una encargaduría activa para este cargo.')
            if p.empleado_encargado_cedula == cedula_encargado and not p.esta_finalizada:
                raise ConflictError('El trabajador ya tiene una encargaduría activa.')

        nuevo = self._base(self.siguiente_id, cedula_encargado, cargo_id, motivo_id, fecha_inicio, fecha_fin, usuario_id)
        self.prestamos[nuevo.id] = nuevo
        self.siguiente_id += 1
        return nuevo

    def finalizar_prestamo(self, prestamo_id):
        prestamo = self.prestamos.get(prestamo_id)
        if not prestamo:
            raise NotFoundError('Préstamo no encontrado.')
        if prestamo.esta_finalizada:
            raise ConflictError('Este préstamo ya se encuentra finalizado.')
        actualizado = PrestamoCargo(**{**prestamo.__dict__, 'estatus_nombre': 'FINALIZADA'})
        self.prestamos[prestamo_id] = actualizado
        return actualizado


def test_crear_prestamo_registra_encargaduria():
    repo = RepoPrestamosMemoria()
    resultado = crear_prestamo(
        repo, cedula_encargado='V11111111', cargo_id=10, motivo_id=1,
        fecha_inicio=datetime.date(2026, 1, 1), fecha_fin=datetime.date(2026, 2, 1), usuario_id=7,
    )
    assert resultado.empleado_encargado_cedula == 'V11111111'
    assert resultado.esta_finalizada is False


def test_crear_prestamo_duplicado_para_el_mismo_cargo_lanza_conflicto():
    repo = RepoPrestamosMemoria()
    crear_prestamo(
        repo, cedula_encargado='V11111111', cargo_id=10, motivo_id=1,
        fecha_inicio=datetime.date(2026, 1, 1), fecha_fin=datetime.date(2026, 2, 1), usuario_id=7,
    )
    repo.empleados.add('V33333333')
    with pytest.raises(ConflictError):
        crear_prestamo(
            repo, cedula_encargado='V33333333', cargo_id=10, motivo_id=1,
            fecha_inicio=datetime.date(2026, 1, 1), fecha_fin=datetime.date(2026, 2, 1), usuario_id=7,
        )


def test_crear_prestamo_fecha_fin_anterior_a_inicio_lanza_validacion():
    repo = RepoPrestamosMemoria()
    with pytest.raises(ValidationError):
        crear_prestamo(
            repo, cedula_encargado='V11111111', cargo_id=10, motivo_id=1,
            fecha_inicio=datetime.date(2026, 2, 1), fecha_fin=datetime.date(2026, 1, 1), usuario_id=7,
        )


def test_finalizar_prestamo_lo_marca_finalizada_y_excluye_de_activos():
    repo = RepoPrestamosMemoria()
    creado = crear_prestamo(
        repo, cedula_encargado='V11111111', cargo_id=10, motivo_id=1,
        fecha_inicio=datetime.date(2026, 1, 1), fecha_fin=datetime.date(2026, 2, 1), usuario_id=7,
    )
    finalizado = finalizar_prestamo(repo, prestamo_id=creado.id)
    assert finalizado.esta_finalizada is True
    assert listar_prestamos(repo, solo_activos=True) == []


def test_finalizar_prestamo_ya_finalizado_lanza_conflicto():
    repo = RepoPrestamosMemoria()
    creado = crear_prestamo(
        repo, cedula_encargado='V11111111', cargo_id=10, motivo_id=1,
        fecha_inicio=datetime.date(2026, 1, 1), fecha_fin=datetime.date(2026, 2, 1), usuario_id=7,
    )
    finalizar_prestamo(repo, prestamo_id=creado.id)
    with pytest.raises(ConflictError):
        finalizar_prestamo(repo, prestamo_id=creado.id)


def test_repo_prestamos_orm_normalizar_fecha():
    from apps.cargos.infrastructure.repositories.repo_prestamos_cargo_orm import RepoPrestamosCargoORM

    norm = RepoPrestamosCargoORM._normalizar_fecha
    d = datetime.date(2026, 5, 10)
    assert norm('2026-05-10') == d
    assert norm(d) == d
    assert norm(datetime.datetime(2026, 5, 10, 14, 30)) == d

