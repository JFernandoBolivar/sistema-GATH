"""
Tests unitarios del módulo pasivos (Arquitectura Onion pura sin BD).
"""
import pytest

from apps.pasivos.application.dtos.pasivos_dtos import ProcesarEgresoDTO
from apps.pasivos.application.use_cases.listar_pasivos import listar_pasivos
from apps.pasivos.application.use_cases.obtener_pasivo import obtener_pasivo_por_cedula
from apps.pasivos.application.use_cases.procesar_egreso import procesar_egreso
from apps.pasivos.domain.entities.pasivo import Pasivo
from core.domain.exceptions import NotFoundError, ValidationError


class RepoPasivosMemoria:
    def __init__(self, empleados_con_cargo=None):
        self.pasivos = [
            Pasivo(
                id=1,
                cedula="5555555",
                nombres="Pedro",
                apellidos="Martínez",
                tipo_pasivo="JUBILADO",
                fecha_egreso="2020-01-15",
                resolucion="RES-001",
            )
        ]
        # Cédulas que sí tienen un cargo previo (requisito real para poder
        # procesar el pase a pasivo, ver `procesar_egreso_a_pasivo`).
        self.empleados_con_cargo = empleados_con_cargo or {"12345678"}
        self.procesados: list[dict] = []

    def listar_pasivos(self, busqueda=None):
        if busqueda:
            return [
                p for p in self.pasivos
                if busqueda.lower() in p.cedula or busqueda.lower() in p.nombres.lower()
            ]
        return list(self.pasivos)

    def obtener_por_cedula(self, cedula):
        return next((p for p in self.pasivos if p.cedula == cedula), None)

    def procesar_egreso_a_pasivo(self, cedula, motivo_movimiento_id, tipo_nomina_id, liberar_activos, usuario_id=None):
        if cedula not in self.empleados_con_cargo:
            raise ValidationError('El empleado no tiene cargos previos para realizar el pase a pasivo.')
        self.procesados.append({
            'cedula': cedula,
            'motivo_movimiento_id': motivo_movimiento_id,
            'tipo_nomina_id': tipo_nomina_id,
            'liberar_activos': liberar_activos,
        })
        nuevo = Pasivo(
            id=99,
            cedula=cedula,
            nombres="Nuevo",
            apellidos="Pasivo",
            tipo_pasivo="JUBILACION",
            fecha_egreso="2026-08-25",
            resolucion="J_0001",
            observaciones="Cargo pasivo generado. JUBILACION",
        )
        self.pasivos.append(nuevo)
        return nuevo


def test_listar_pasivos():
    repo = RepoPasivosMemoria()
    resultado = listar_pasivos(repo)
    assert len(resultado) == 1
    assert resultado[0].cedula == "5555555"
    assert resultado[0].nombre_completo == "Pedro Martínez"


def test_obtener_pasivo_por_cedula():
    repo = RepoPasivosMemoria()
    p = obtener_pasivo_por_cedula(repo, "5555555")
    assert p.tipo_pasivo == "JUBILADO"
    assert p.resolucion == "RES-001"


def test_procesar_egreso_crea_el_pasivo():
    repo = RepoPasivosMemoria()
    dto = procesar_egreso(
        repo,
        ProcesarEgresoDTO(
            cedula="12345678",
            motivo_movimiento_id=1,
            tipo_nomina_id=3,
            liberar_activos=True,
        ),
    )
    assert dto.cedula == "12345678"
    assert dto.tipo_pasivo == "JUBILACION"
    assert repo.procesados[0]["liberar_activos"] is True


def test_procesar_egreso_sin_cargo_previo_lanza_error():
    repo = RepoPasivosMemoria(empleados_con_cargo=set())
    with pytest.raises(ValidationError):
        procesar_egreso(
            repo,
            ProcesarEgresoDTO(cedula="99999999", motivo_movimiento_id=1, tipo_nomina_id=3),
        )


def test_procesar_egreso_liberar_activos_por_defecto_es_true():
    repo = RepoPasivosMemoria()
    procesar_egreso(
        repo,
        ProcesarEgresoDTO(cedula="12345678", motivo_movimiento_id=2, tipo_nomina_id=3),
    )
    assert repo.procesados[0]["liberar_activos"] is True
