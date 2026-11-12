"""
Actualizar mi vivienda: el borrador valida el estado FINAL (país, estado, municipio, parroquia)
y solo conserva los campos que realmente cambiaron. Puertos en memoria, sin BD.
"""
import pytest

from apps.autogestion.application.dtos.actualizacion_dtos import ItemCambioDTO
from apps.autogestion.application.use_cases.solicitud_ciclo import solicitar_actualizacion
from core.domain.exceptions import ValidationError
from tests.unit.autogestion.memoria_actualizacion import TRABAJADOR, FichaMem, Mundo
from tests.unit.autogestion.test_actualizacion_flujo import borrador, habilitar

MOTIVO = 'Me mudé a otra casa hace poco tiempo'
CAMPOS = [
    'pais_id', 'ciudad_region', 'estado_id', 'municipio_id', 'parroquia_id',
    'direccion_exacta', 'condicion_vivienda_id', 'codigo_postal_id',
]
VENEZUELA, ALEMANIA = 1, 25
# municipio -> estado; parroquia -> municipio
MUNICIPIOS = {13: 2, 14: 3}
PARROQUIAS = {47: 13, 48: 14}
VIGENTE = {
    'pais_id': VENEZUELA, 'ciudad_region': None, 'estado_id': 2, 'municipio_id': 13,
    'parroquia_id': 47, 'direccion_exacta': 'CALLE BOLIVAR CASA 5', 'condicion_vivienda_id': 1,
    'codigo_postal_id': 100,
}


class FichaConVivienda(FichaMem):
    """Ficha con una vivienda venezolana y la geografía mínima para validar su coherencia."""

    def __init__(self):
        super().__init__()
        self.datos[('datos_vivienda', None)] = dict(VIGENTE)

    def valores_vivienda(self, cedula):
        return dict(self.datos[('datos_vivienda', None)])

    def es_pais_venezuela(self, pais_id):
        return pais_id in (None, VENEZUELA)

    def validar_cadena_geografica(self, estado_id, municipio_id, parroquia_id):
        if estado_id and municipio_id and MUNICIPIOS.get(municipio_id) != estado_id:
            raise ValidationError('El municipio no pertenece al estado seleccionado.')
        if municipio_id and parroquia_id and PARROQUIAS.get(parroquia_id) != municipio_id:
            raise ValidationError('La parroquia no pertenece al municipio seleccionado.')


def cambio(campo, valor):
    return ItemCambioDTO('vivienda', 'datos_vivienda', 'MODIFICAR', campo, valor)


@pytest.fixture
def mundo_y_solicitud():
    m = Mundo()
    m.ficha = FichaConVivienda()
    sol = solicitar_actualizacion(
        m.solicitudes, m.secciones, m.publicador, cedula=TRABAJADOR,
        campos=[f'datos_vivienda.{c}' for c in CAMPOS], motivo=MOTIVO,
    )
    return m, habilitar(m, sol)


def test_estado_nuevo_con_municipio_viejo_se_rechaza(mundo_y_solicitud):
    m, sol = mundo_y_solicitud
    with pytest.raises(ValidationError, match='municipio no pertenece al estado'):
        borrador(m, sol, [cambio('estado_id', 3)])


def test_parroquia_de_otro_municipio_se_rechaza(mundo_y_solicitud):
    m, sol = mundo_y_solicitud
    with pytest.raises(ValidationError, match='parroquia no pertenece al municipio'):
        borrador(m, sol, [cambio('parroquia_id', 48)])


def test_cadena_completa_y_coherente_se_acepta(mundo_y_solicitud):
    m, sol = mundo_y_solicitud
    borrador(m, sol, [cambio('estado_id', 3), cambio('municipio_id', 14), cambio('parroquia_id', 48)])
    campos = {c.campo for c in m.cambios.listar('ACTUALIZACION', sol.id)}
    assert campos == {'estado_id', 'municipio_id', 'parroquia_id'}


def test_pais_extranjero_con_geografia_venezolana_se_rechaza(mundo_y_solicitud):
    m, sol = mundo_y_solicitud
    # Cambia el país y la ciudad pero deja el estado, municipio y parroquia vigentes.
    with pytest.raises(ValidationError, match='fuera de Venezuela'):
        borrador(m, sol, [cambio('pais_id', ALEMANIA), cambio('ciudad_region', 'Berlin')])


def test_pais_extranjero_con_geografia_vaciada_se_acepta(mundo_y_solicitud):
    m, sol = mundo_y_solicitud
    borrador(m, sol, [
        cambio('pais_id', ALEMANIA), cambio('ciudad_region', 'Berlin'), cambio('estado_id', None),
        cambio('municipio_id', None), cambio('parroquia_id', None), cambio('codigo_postal_id', None),
    ])
    propuestos = {c.campo: c.valor_propuesto for c in m.cambios.listar('ACTUALIZACION', sol.id)}
    assert propuestos['pais_id'] == ALEMANIA
    assert propuestos['ciudad_region'] == 'BERLIN'
    assert propuestos['estado_id'] is None


def test_solo_se_guardan_los_cambios_reales_con_su_valor_anterior(mundo_y_solicitud):
    m, sol = mundo_y_solicitud
    borrador(m, sol, [
        cambio('pais_id', VENEZUELA), cambio('estado_id', 2), cambio('municipio_id', 13),
        cambio('parroquia_id', 47), cambio('direccion_exacta', 'AVENIDA PRINCIPAL CASA 9'),
        cambio('condicion_vivienda_id', 1),
    ])
    cambios = m.cambios.listar('ACTUALIZACION', sol.id)
    assert [c.campo for c in cambios] == ['direccion_exacta']
    assert cambios[0].valor_anterior == 'CALLE BOLIVAR CASA 5'
    assert cambios[0].valor_propuesto == 'AVENIDA PRINCIPAL CASA 9'


def test_cambiar_solo_la_parroquia_del_mismo_municipio_deja_lo_demas_igual():
    m = Mundo()
    m.ficha = FichaConVivienda()
    PARROQUIAS[49] = 13
    try:
        sol = habilitar(m, solicitar_actualizacion(
            m.solicitudes, m.secciones, m.publicador, cedula=TRABAJADOR,
            campos=[f'datos_vivienda.{c}' for c in CAMPOS], motivo=MOTIVO,
        ))
        borrador(m, sol, [cambio('parroquia_id', 49)])
        assert [c.campo for c in m.cambios.listar('ACTUALIZACION', sol.id)] == ['parroquia_id']
    finally:
        PARROQUIAS.pop(49, None)
