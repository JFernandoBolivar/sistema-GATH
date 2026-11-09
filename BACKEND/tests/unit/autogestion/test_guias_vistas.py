"""
Pruebas unitarias de dominio y casos de uso de guías interactivas vistas (O35, D-09).
"""
import pytest
from datetime import datetime, timezone
import uuid

from apps.autogestion.domain.entities.guia_vista import GuiaVista
from apps.autogestion.domain.ports.repo_guia_vista import RepoGuiaVista
from apps.autogestion.application.use_cases.gestionar_guias_vistas import (
    ConsultarGuiasVistasUseCase,
    MarcarGuiaVistaUseCase,
)


class RepoGuiaVistaEnMemoria(RepoGuiaVista):
    """Repositorio en memoria para pruebas puras sin base de datos."""

    def __init__(self):
        self._vistas: list[GuiaVista] = []

    def listar_vistas_por_cedula(self, cedula: str) -> list[GuiaVista]:
        return [v for v in self._vistas if v.cedula == cedula]

    def ha_visto_guia(self, cedula: str, guia_id: str, version: int) -> bool:
        return any(
            v.cedula == cedula and v.guia_id == guia_id and v.version >= version
            for v in self._vistas
        )

    def registrar_vista(self, cedula: str, guia_id: str, version: int) -> GuiaVista:
        for v in self._vistas:
            if v.cedula == cedula and v.guia_id == guia_id and v.version == version:
                return v

        nueva = GuiaVista(
            id=str(uuid.uuid4()),
            cedula=cedula,
            guia_id=guia_id,
            version=version,
            fecha_vista=datetime.now(timezone.utc),
        )
        self._vistas.append(nueva)
        return nueva


def test_consultar_vistas_inicialmente_vacio():
    repo = RepoGuiaVistaEnMemoria()
    use_case = ConsultarGuiasVistasUseCase(repo)

    resultado = use_case.ejecutar("V-12345678")
    assert resultado == []


def test_marcar_guia_vista_exitoso():
    repo = RepoGuiaVistaEnMemoria()
    marcar_uc = MarcarGuiaVistaUseCase(repo)
    consultar_uc = ConsultarGuiasVistasUseCase(repo)

    vista = marcar_uc.ejecutar("V-12345678", "autogestion_inicio", 1)

    assert vista.cedula == "V-12345678"
    assert vista.guia_id == "autogestion_inicio"
    assert vista.version == 1

    vistas = consultar_uc.ejecutar("V-12345678")
    assert len(vistas) == 1
    assert vistas[0].guia_id == "autogestion_inicio"


def test_marcar_guia_vista_es_idempotente():
    repo = RepoGuiaVistaEnMemoria()
    marcar_uc = MarcarGuiaVistaUseCase(repo)

    vista1 = marcar_uc.ejecutar("V-12345678", "autogestion_inicio", 1)
    vista2 = marcar_uc.ejecutar("V-12345678", "autogestion_inicio", 1)

    assert vista1.id == vista2.id
    assert len(repo.listar_vistas_por_cedula("V-12345678")) == 1


def test_marcar_guia_distintas_versiones():
    repo = RepoGuiaVistaEnMemoria()
    marcar_uc = MarcarGuiaVistaUseCase(repo)

    marcar_uc.ejecutar("V-12345678", "autogestion_inicio", 1)
    marcar_uc.ejecutar("V-12345678", "autogestion_inicio", 2)

    vistas = repo.listar_vistas_por_cedula("V-12345678")
    assert len(vistas) == 2
    versiones = {v.version for v in vistas}
    assert versiones == {1, 2}


def test_validacion_entradas_marcar_vista():
    repo = RepoGuiaVistaEnMemoria()
    marcar_uc = MarcarGuiaVistaUseCase(repo)

    with pytest.raises(ValueError, match="cédula es requerida"):
        marcar_uc.ejecutar("", "autogestion_inicio", 1)

    with pytest.raises(ValueError, match="identificador de la guía es requerido"):
        marcar_uc.ejecutar("V-12345678", "  ", 1)

    with pytest.raises(ValueError, match="versión de la guía debe ser mayor o igual a 1"):
        marcar_uc.ejecutar("V-12345678", "autogestion_inicio", 0)


def test_aislamiento_entre_usuarios():
    repo = RepoGuiaVistaEnMemoria()
    marcar_uc = MarcarGuiaVistaUseCase(repo)
    consultar_uc = ConsultarGuiasVistasUseCase(repo)

    marcar_uc.ejecutar("V-11111111", "autogestion_inicio", 1)

    assert len(consultar_uc.ejecutar("V-11111111")) == 1
    assert len(consultar_uc.ejecutar("V-22222222")) == 0
