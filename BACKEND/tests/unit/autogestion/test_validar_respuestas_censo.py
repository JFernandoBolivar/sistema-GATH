"""
Validación de respuestas del censo contra el catálogo de preguntas activas
(`CensoEmpleadoView.post`). Pura: el catálogo tiene la forma que devuelve
`RepoAutogestionORM.listar_preguntas_con_detalle`.
"""
from apps.autogestion.presentation.views.autogestion_views import validar_respuestas_censo

CATALOGO = [
    {'id': 1, 'enunciado': 'N° CARNET', 'tipo': {'id': 1, 'nombre': 'number'}, 'opciones': []},
    {'id': 5, 'enunciado': '¿VIVIENDA PROPIA?', 'tipo': {'id': 2, 'nombre': 'cerrada'},
     'opciones': [{'id': 8}, {'id': 9}]},
]


def test_respuestas_validas():
    assert validar_respuestas_censo([
        {'pregunta': 1, 'opcion': None, 'respuesta': '123'},
        {'pregunta': 5, 'opcion': 8, 'respuesta': ''},
    ], CATALOGO) is None


def test_ids_como_texto_se_aceptan():
    assert validar_respuestas_censo([{'pregunta': '5', 'opcion': '9'}], CATALOGO) is None


def test_lista_vacia():
    assert validar_respuestas_censo([], CATALOGO) == "Debe enviar al menos una respuesta."


def test_pregunta_inexistente_o_inactiva():
    assert 'no existe o no está activa' in validar_respuestas_censo([{'pregunta': 99, 'opcion': None}], CATALOGO)


def test_cerrada_sin_opcion():
    assert 'Debe seleccionar una opción' in validar_respuestas_censo([{'pregunta': 5, 'opcion': None}], CATALOGO)


def test_cerrada_con_opcion_de_otra_pregunta():
    assert 'no pertenece a la pregunta' in validar_respuestas_censo([{'pregunta': 5, 'opcion': 26}], CATALOGO)


def test_abierta_no_admite_opcion():
    assert 'no admite opción' in validar_respuestas_censo([{'pregunta': 1, 'opcion': 8}], CATALOGO)


def test_pregunta_repetida():
    error = validar_respuestas_censo([{'pregunta': 5, 'opcion': 8}, {'pregunta': 5, 'opcion': 9}], CATALOGO)
    assert 'más de una vez' in error


def test_item_con_formato_invalido():
    assert 'formato esperado' in validar_respuestas_censo(['x'], CATALOGO)
