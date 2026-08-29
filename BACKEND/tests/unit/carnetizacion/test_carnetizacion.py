"""
Tests unitarios del módulo carnetización (Arquitectura Onion pura sin BD).
"""
import pytest

from apps.carnetizacion.application.use_cases.generar_pdf_carnet import generar_pdf_carnet
from apps.carnetizacion.application.use_cases.gestionar_plantillas import (
    activar_plantilla,
    listar_plantillas,
)
from apps.carnetizacion.application.use_cases.listar_carnets import emitir_carnet, listar_carnets
from apps.carnetizacion.application.use_cases.revocar_carnet import revocar_carnet
from apps.carnetizacion.application.use_cases.validar_carnet import (
    validar_carnet_por_hash,
    validar_carnet_por_id,
)
from core.domain.exceptions import NotFoundError
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet


class RepoCarnetizacionMemoria:
    def __init__(self):
        self.carnets = [
            Carnet(
                id=1,
                empleado_cedula="12345678",
                empleado_nombres="Juan",
                empleado_apellidos="Pérez",
                security_hash="hash-valido-12345",
                fecha_emision="2026-01-01",
                motivo_id=1,
                motivo_nombre="EMISION INICIAL",
                activo=True,
            ),
            Carnet(
                id=2,
                empleado_cedula="87654321",
                empleado_nombres="Ana",
                empleado_apellidos="Gómez",
                security_hash="hash-inactivo-99999",
                fecha_emision="2025-01-01",
                motivo_id=2,
                motivo_nombre="RENOVACION",
                activo=False,
            ),
        ]
        self.plantillas = [
            PlantillaCarnet(id=1, nombre="Plantilla Azul", imagen_url="/media/p1.png", activo=True, creado="2026-01-01"),
            PlantillaCarnet(id=2, nombre="Plantilla Roja", imagen_url="/media/p2.png", activo=False, creado="2026-01-02"),
        ]

    def listar_carnets(self, empleado_cedula=None):
        if empleado_cedula:
            return [c for c in self.carnets if c.empleado_cedula == empleado_cedula]
        return list(self.carnets)

    def obtener_por_hash(self, security_hash):
        return next((c for c in self.carnets if c.security_hash == security_hash), None)

    def obtener_por_id(self, carnet_id):
        return next((c for c in self.carnets if c.id == carnet_id), None)

    def emitir_carnet(self, empleado_cedula, motivo_id, observaciones=None):
        nuevo = Carnet(
            id=len(self.carnets) + 1,
            empleado_cedula=empleado_cedula,
            empleado_nombres="Nuevo",
            empleado_apellidos="Empleado",
            security_hash=f"hash-nuevo-{len(self.carnets)+1}",
            fecha_emision="2026-08-24",
            motivo_id=motivo_id,
            motivo_nombre="EMISION",
            activo=True,
            observaciones=observaciones,
        )
        self.carnets.append(nuevo)
        return nuevo

    def listar_plantillas(self):
        return list(self.plantillas)

    def generar_pdf(self, carnet_id):
        carnet = self.obtener_por_id(carnet_id)
        if not carnet:
            raise NotFoundError(f"Carnet con id {carnet_id} no encontrado")
        return b"%PDF-1.4-simulado-para-test"

    def revocar_carnet(self, carnet_id):
        idx = next((i for i, c in enumerate(self.carnets) if c.id == carnet_id), None)
        if idx is None:
            raise NotFoundError(f"Carnet con id {carnet_id} no encontrado")
        revocado = Carnet(**{**self.carnets[idx].__dict__, 'activo': False})
        self.carnets[idx] = revocado
        return revocado

    def activar_plantilla(self, plantilla_id):
        nuevas = []
        activa = None
        for p in self.plantillas:
            if p.id == plantilla_id:
                activa = PlantillaCarnet(id=p.id, nombre=p.nombre, imagen_url=p.imagen_url, activo=True, creado=p.creado)
                nuevas.append(activa)
            else:
                nuevas.append(PlantillaCarnet(id=p.id, nombre=p.nombre, imagen_url=p.imagen_url, activo=False, creado=p.creado))
        self.plantillas = nuevas
        return activa


def test_listar_y_emitir_carnet():
    repo = RepoCarnetizacionMemoria()
    lista = listar_carnets(repo, empleado_cedula="12345678")
    assert len(lista) == 1
    assert lista[0].security_hash == "hash-valido-12345"

    nuevo = emitir_carnet(repo, empleado_cedula="11223344", motivo_id=1)
    assert nuevo.empleado_cedula == "11223344"
    assert len(repo.carnets) == 3


def test_validar_carnet_por_hash():
    repo = RepoCarnetizacionMemoria()
    valido = validar_carnet_por_hash(repo, "hash-valido-12345")
    assert valido.es_valido is True

    inactivo = validar_carnet_por_hash(repo, "hash-inactivo-99999")
    assert inactivo.es_valido is False
    assert "inactivo" in inactivo.mensaje.lower()

    inexistente = validar_carnet_por_hash(repo, "hash-fantasma")
    assert inexistente.es_valido is False


def test_gestionar_plantillas():
    repo = RepoCarnetizacionMemoria()
    plantillas = listar_plantillas(repo)
    assert len(plantillas) == 2

    activada = activar_plantilla(repo, plantilla_id=2)
    assert activada.id == 2
    assert activada.activo is True


def test_generar_pdf_carnet_existente():
    repo = RepoCarnetizacionMemoria()
    pdf_bytes = generar_pdf_carnet(repo, carnet_id=1)
    assert pdf_bytes.startswith(b"%PDF")


def test_generar_pdf_carnet_inexistente_lanza_error():
    repo = RepoCarnetizacionMemoria()
    with pytest.raises(NotFoundError):
        generar_pdf_carnet(repo, carnet_id=999)


def test_revocar_carnet_lo_marca_inactivo():
    repo = RepoCarnetizacionMemoria()
    dto = revocar_carnet(repo, carnet_id=1)
    assert dto.activo is False
    assert repo.obtener_por_id(1).activo is False


def test_revocar_carnet_inexistente_lanza_error():
    repo = RepoCarnetizacionMemoria()
    with pytest.raises(NotFoundError):
        revocar_carnet(repo, carnet_id=999)
