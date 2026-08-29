"""
Tests unitarios del módulo personal (Arquitectura Onion pura sin BD).
"""
import pytest

from apps.personal.application.use_cases.gestionar_personal import (
    actualizar_empleado,
    registrar_empleado,
)
from apps.personal.application.use_cases.listar_personal import listar_personal
from apps.personal.application.use_cases.obtener_personal import obtener_personal_por_cedula
from apps.personal.domain.entities.empleado import Empleado


class RepoPersonalMemoria:
    def __init__(self):
        self.empleados = [
            Empleado(
                id=1,
                cedula="12345678",
                nombres="Juan",
                apellidos="Pérez",
                sexo_id=1,
                sexo_nombre="MASCULINO",
                correo="juan.perez@conatel.gob",
                telefono_movil="04121234567",
            )
        ]

    def listar_empleados(self, busqueda=None):
        if busqueda:
            return [
                e for e in self.empleados
                if busqueda.lower() in e.cedula or busqueda.lower() in e.nombres.lower() or busqueda.lower() in e.apellidos.lower()
            ]
        return list(self.empleados)

    def obtener_por_cedula(self, cedula):
        return next((e for e in self.empleados if e.cedula == cedula), None)

    def crear_empleado(self, datos):
        nuevo = Empleado(
            id=len(self.empleados) + 1,
            cedula=datos['cedula'],
            nombres=datos['nombres'],
            apellidos=datos['apellidos'],
            sexo_id=datos['sexo_id'],
            sexo_nombre="MASCULINO",
            correo=datos.get('correo'),
        )
        self.empleados.append(nuevo)
        return nuevo

    def actualizar_empleado(self, cedula, datos):
        e = self.obtener_por_cedula(cedula)
        idx = self.empleados.index(e)
        actualizado = Empleado(
            id=e.id,
            cedula=e.cedula,
            nombres=datos.get('nombres', e.nombres),
            apellidos=datos.get('apellidos', e.apellidos),
            sexo_id=e.sexo_id,
            sexo_nombre=e.sexo_nombre,
            correo=datos.get('correo', e.correo),
        )
        self.empleados[idx] = actualizado
        return actualizado


def test_listar_personal():
    repo = RepoPersonalMemoria()
    resultado = listar_personal(repo)
    assert len(resultado) == 1
    assert resultado[0].cedula == "12345678"
    assert resultado[0].nombre_completo == "Juan Pérez"


def test_obtener_personal_por_cedula():
    repo = RepoPersonalMemoria()
    emp = obtener_personal_por_cedula(repo, "12345678")
    assert emp.nombres == "Juan"


def test_obtener_personal_por_cedula_incluye_expediente():
    """Fase 2.2: el detalle sí devuelve el expediente anidado que la escritura ya soportaba."""
    repo = RepoPersonalMemoria()
    repo.empleados[0] = Empleado(
        **{**repo.empleados[0].__dict__, 'datos_vivienda': {'estado_id': 1}, 'antecedentes': [{'id': 1}]},
    )
    emp = obtener_personal_por_cedula(repo, "12345678")
    assert emp.datos_vivienda == {'estado_id': 1}
    assert emp.antecedentes == [{'id': 1}]


def test_registrar_y_actualizar_empleado():
    repo = RepoPersonalMemoria()
    nuevo = registrar_empleado(
        repo,
        datos={'cedula': '20111222', 'nombres': 'María', 'apellidos': 'Gómez', 'sexo_id': 2},
    )
    assert nuevo.cedula == "20111222"
    assert len(repo.empleados) == 2

    actualizado = actualizar_empleado(repo, "20111222", datos={'correo': 'maria.gomez@conatel.gob'})
    assert actualizado.correo == "maria.gomez@conatel.gob"
