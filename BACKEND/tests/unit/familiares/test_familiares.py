"""
Tests unitarios del módulo familiares (Arquitectura Onion pura sin BD).
"""
import pytest

from apps.familiares.application.use_cases.gestionar_familiar import (
    actualizar_familiar,
    eliminar_familiar,
    registrar_familiar,
)
from apps.familiares.application.use_cases.listar_familiares import (
    listar_documentos_familiar,
    listar_familiares_por_empleado,
    obtener_familiar_por_id,
)
from apps.familiares.domain.entities.documento_familiar import DocumentoFamiliar
from apps.familiares.domain.entities.familiar import Familiar
from core.domain.exceptions import NotFoundError


class RepoFamiliaresMemoria:
    def __init__(self):
        self.familiares = [
            Familiar(
                id=1,
                empleado_cedula="12345678",
                primer_nombre="Carlos",
                primer_apellido="Pérez",
                parentesco_id=1,
                parentesco_nombre="HIJO(A)",
                fecha_nacimiento="2010-05-15",
                sexo_id=1,
                sexo_nombre="MASCULINO",
            )
        ]
        self.documentos = [
            DocumentoFamiliar(
                id=10,
                familiar_id=1,
                tipo_documento="cedula",
                ruta_archivo="/media/familiares/cedula.pdf",
                fecha_subida="2026-01-01",
            )
        ]

    def listar_por_empleado(self, empleado_cedula):
        return [f for f in self.familiares if f.empleado_cedula == empleado_cedula]

    def obtener_familiar(self, familiar_id):
        return next((f for f in self.familiares if f.id == familiar_id), None)

    def crear_familiar(self, familiar_datos):
        nuevo = Familiar(
            id=len(self.familiares) + 1,
            empleado_cedula=familiar_datos['empleado_cedula'],
            primer_nombre=familiar_datos['primer_nombre'],
            primer_apellido=familiar_datos['primer_apellido'],
            parentesco_id=familiar_datos['parentesco_id'],
            parentesco_nombre="HIJO(A)",
            fecha_nacimiento=str(familiar_datos['fecha_nacimiento']),
            sexo_id=familiar_datos['sexo_id'],
            sexo_nombre="MASCULINO",
        )
        self.familiares.append(nuevo)
        return nuevo

    def actualizar_familiar(self, familiar_id, datos):
        f = self.obtener_familiar(familiar_id)
        idx = self.familiares.index(f)
        actualizado = Familiar(
            id=f.id,
            empleado_cedula=f.empleado_cedula,
            primer_nombre=datos.get('primer_nombre', f.primer_nombre),
            primer_apellido=datos.get('primer_apellido', f.primer_apellido),
            parentesco_id=f.parentesco_id,
            parentesco_nombre=f.parentesco_nombre,
            fecha_nacimiento=f.fecha_nacimiento,
            sexo_id=f.sexo_id,
            sexo_nombre=f.sexo_nombre,
        )
        self.familiares[idx] = actualizado
        return actualizado

    def eliminar_familiar(self, familiar_id):
        self.familiares = [f for f in self.familiares if f.id != familiar_id]

    def listar_documentos(self, familiar_id):
        return [d for d in self.documentos if d.familiar_id == familiar_id]


def test_listar_familiares_por_empleado():
    repo = RepoFamiliaresMemoria()
    resultado = listar_familiares_por_empleado(repo, empleado_cedula="12345678")
    assert len(resultado) == 1
    assert resultado[0].primer_nombre == "Carlos"


def test_registrar_y_eliminar_familiar():
    repo = RepoFamiliaresMemoria()
    nuevo = registrar_familiar(
        repo,
        familiar_datos={
            'empleado_cedula': '12345678',
            'primer_nombre': 'Ana',
            'primer_apellido': 'Pérez',
            'parentesco_id': 1,
            'fecha_nacimiento': '2015-08-20',
            'sexo_id': 2,
        },
    )
    assert nuevo.primer_nombre == "Ana"
    assert len(repo.familiares) == 2

    eliminar_familiar(repo, familiar_id=nuevo.id)
    assert len(repo.familiares) == 1


def test_listar_documentos_familiar():
    repo = RepoFamiliaresMemoria()
    docs = listar_documentos_familiar(repo, familiar_id=1)
    assert len(docs) == 1
    assert docs[0].tipo_documento == "cedula"


def test_obtener_familiar_por_id():
    repo = RepoFamiliaresMemoria()
    familiar = obtener_familiar_por_id(repo, familiar_id=1)
    assert familiar.primer_nombre == "Carlos"


def test_obtener_familiar_por_id_inexistente_lanza_not_found():
    repo = RepoFamiliaresMemoria()
    with pytest.raises(NotFoundError):
        obtener_familiar_por_id(repo, familiar_id=999)
