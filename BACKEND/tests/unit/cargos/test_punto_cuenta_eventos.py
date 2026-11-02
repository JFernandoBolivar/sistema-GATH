"""
Tests de la lógica de Punto de Cuenta automático dentro de
`RepoCargosORM` (Reglas B1, B21): `actualizar_cargo()` debe emitir
`cargo_dependencia_cambiada` ÚNICAMENTE cuando el campo Dependencia cambió
(RN-006-01) -- nunca si solo cambian otros campos del cargo. `cambiar_cargo()`
debe incluir `dependencia_anterior_id`/`dependencia_nueva_id` en el evento
`cargo_movimiento_ejecutado` ya existente.

Mocking en el punto de entrada del ORM (patrón de la skill
`testing-backend-django`): se evita crear las filas reales de
`AsigTrabajoModel` (requiere varias FK obligatorias de catálogos legados)
mockeando el queryset; la lógica de comparación/emisión que sí es nuestra
se ejercita real.
"""
from unittest.mock import MagicMock, patch

import pytest

from apps.cargos.domain.events import cargo_dependencia_cambiada, cargo_movimiento_ejecutado
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM


def _fila_mock(*, dependencia_id, employee_id="12345678"):
    fila = MagicMock()
    fila.pk = 10
    fila.Dependencia_id = dependencia_id
    fila.employee_id = employee_id
    return fila


class _CapturaEventos:
    def __init__(self):
        self.recibidos = []

    def capturar(self, sender, **kwargs):
        self.recibidos.append(kwargs)


@pytest.fixture
def captura_dependencia_cambiada():
    captura = _CapturaEventos()
    cargo_dependencia_cambiada.connect(captura.capturar, weak=False)
    yield captura
    cargo_dependencia_cambiada.disconnect(captura.capturar)


@pytest.fixture
def captura_movimiento_ejecutado():
    captura = _CapturaEventos()
    cargo_movimiento_ejecutado.connect(captura.capturar, weak=False)
    yield captura
    cargo_movimiento_ejecutado.disconnect(captura.capturar)


@pytest.mark.django_db
def test_actualizar_cargo_emite_evento_si_cambia_dependencia(captura_dependencia_cambiada):
    fila = _fila_mock(dependencia_id=1)
    repo = RepoCargosORM()
    with patch("apps.cargos.infrastructure.repositories.repo_cargos_orm.AsigTrabajoModel") as modelo_mock:
        modelo_mock.objects.select_for_update.return_value.filter.return_value.first.return_value = fila
        with patch.object(repo, "obtener_cargo", return_value="RESULTADO"):
            repo.actualizar_cargo(cargo_id=10, datos={"Dependencia": 2, "motivo_id": 7}, usuario_id=99)

    assert len(captura_dependencia_cambiada.recibidos) == 1
    evento = captura_dependencia_cambiada.recibidos[0]
    assert evento["cargo_id"] == 10
    assert evento["cedula"] == "12345678"
    assert evento["dependencia_anterior_id"] == 1
    assert evento["dependencia_nueva_id"] == 2
    assert evento["motivo_id"] == 7
    assert evento["usuario_id"] == 99


@pytest.mark.django_db
def test_actualizar_cargo_no_emite_evento_si_no_cambia_dependencia(captura_dependencia_cambiada):
    fila = _fila_mock(dependencia_id=1)
    repo = RepoCargosORM()
    with patch("apps.cargos.infrastructure.repositories.repo_cargos_orm.AsigTrabajoModel") as modelo_mock:
        modelo_mock.objects.select_for_update.return_value.filter.return_value.first.return_value = fila
        with patch.object(repo, "obtener_cargo", return_value="RESULTADO"):
            # Cambia denominación y nómina, NO dependencia.
            repo.actualizar_cargo(cargo_id=10, datos={"denominacioncargoid": 5, "tiponominaid": 2}, usuario_id=99)

    assert captura_dependencia_cambiada.recibidos == []


@pytest.mark.django_db
def test_actualizar_cargo_no_emite_evento_si_dependencia_es_la_misma_explicita(captura_dependencia_cambiada):
    fila = _fila_mock(dependencia_id=3)
    repo = RepoCargosORM()
    with patch("apps.cargos.infrastructure.repositories.repo_cargos_orm.AsigTrabajoModel") as modelo_mock:
        modelo_mock.objects.select_for_update.return_value.filter.return_value.first.return_value = fila
        with patch.object(repo, "obtener_cargo", return_value="RESULTADO"):
            repo.actualizar_cargo(cargo_id=10, datos={"Dependencia": 3}, usuario_id=99)

    assert captura_dependencia_cambiada.recibidos == []


@pytest.mark.django_db
def test_actualizar_cargo_no_emite_evento_si_el_cargo_esta_vacante(captura_dependencia_cambiada):
    fila = _fila_mock(dependencia_id=1, employee_id=None)
    repo = RepoCargosORM()
    with patch("apps.cargos.infrastructure.repositories.repo_cargos_orm.AsigTrabajoModel") as modelo_mock:
        modelo_mock.objects.select_for_update.return_value.filter.return_value.first.return_value = fila
        with patch.object(repo, "obtener_cargo", return_value="RESULTADO"):
            repo.actualizar_cargo(cargo_id=10, datos={"Dependencia": 2}, usuario_id=99)

    assert captura_dependencia_cambiada.recibidos == []


@pytest.mark.django_db
def test_cambiar_cargo_incluye_dependencias_anterior_y_nueva_en_el_evento(captura_movimiento_ejecutado):
    # Se desconecta temporalmente el receiver REAL de apps.movimientos (ya
    # conectado a esta misma señal): con un `cargo_id` ficticio, ese
    # receiver intentaría resolverlo contra la BD real y fallaría -- un
    # comportamiento preexistente (no introducido aquí) que no es lo que
    # este test verifica. En producción `cargo_id` siempre es real.
    from apps.movimientos.infrastructure.receivers import despachar_registro_historial
    cargo_movimiento_ejecutado.disconnect(despachar_registro_historial)
    try:
        actual = _fila_mock(dependencia_id=1)
        actual.pk = 10
        nuevo = _fila_mock(dependencia_id=2, employee_id=None)
        nuevo.pk = 20
        nuevo.estatusid_id = 1  # coincide con estatus_vacante_mock.pk más abajo

        repo = RepoCargosORM()
        with patch("apps.cargos.infrastructure.repositories.repo_cargos_orm.AsigTrabajoModel") as asig_mock, \
             patch("apps.cargos.infrastructure.repositories.repo_cargos_orm.EstatusModel") as estatus_mock, \
             patch("apps.cargos.infrastructure.repositories.repo_cargos_orm.TipoMovimientoModel") as motivo_mock:

            asig_mock.objects.select_for_update.return_value.filter.return_value.first.side_effect = [actual, nuevo]

            estatus_vacante = MagicMock(pk=1)
            estatus_activo = MagicMock(pk=2)
            estatus_mock.objects.get.side_effect = [estatus_vacante, estatus_activo]

            motivo = MagicMock(movimiento="TRASLADO POR NECESIDAD")
            motivo_mock.objects.get.return_value = motivo

            with patch.object(repo, "obtener_cargo", return_value="RESULTADO"):
                repo.cambiar_cargo(cargo_actual_id=10, cargo_nuevo_id=20, motivo_id=7, usuario_id=99)
    finally:
        cargo_movimiento_ejecutado.connect(despachar_registro_historial)

    assert len(captura_movimiento_ejecutado.recibidos) == 1
    evento = captura_movimiento_ejecutado.recibidos[0]
    assert evento["tipo_movimiento"] == "TRASLADO"
    assert evento["dependencia_anterior_id"] == 1
    assert evento["dependencia_nueva_id"] == 2
