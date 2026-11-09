"""El listado del censo precarga cargos/vivienda/respuestas: serializar un empleado no debe tocar la BD."""
from datetime import date
from types import SimpleNamespace

from apps.autogestion.infrastructure.repositories.repo_autogestion_orm import RepoAutogestionORM


def test_serializar_con_datos_precargados_no_consulta_bd():
    emp = SimpleNamespace(
        id=1, cedulaidentidad='123', nombres='A', apellidos='B',
        fecha_nacimiento=date(2000, 1, 2), carnet_patria=None, carnet_patria_serial=None, total_anos_apn=2.5,
        antecedentes_servicio=[
            SimpleNamespace(fecha_ingreso=date(2000, 1, 1), fecha_egreso=date(2002, 6, 30)),
        ],
    )
    resultado = RepoAutogestionORM()._serializar_censo_empleado(
        emp, cargos=[], vivienda=None, respuestas=[],
    )
    assert resultado['cedula'] == '123'
    assert resultado['cargos'] == []
    assert resultado['datos_vivienda'] is None
    assert resultado['preguntas'] == []
    assert resultado['total_apn'] == {'years': 2, 'months': 6, 'days': 0}
