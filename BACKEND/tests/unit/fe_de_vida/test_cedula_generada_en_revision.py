"""FIX hijo sin cédula: la revisión de Bienestar muestra la cédula que se generará.

La cédula `titular-orden` no se guarda en el valor propuesto (eso trababa el
borrador); el serializer la calcula al presentar el cambio. Puro: no usa BD.
"""
from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import a_dict_cambio
from core.presentation.valores_propuestos import con_cedula_generada

PASIVO = '99000400'


def _alta(**extra):
    valor = {
        'primer_nombre': 'LUCIA', 'primer_apellido': 'PRUEBA', 'parentesco_id': 1,
        'orden_hijo': 2, 'fecha_nacimiento': '2021-03-04', 'sexo_id': 1,
        **extra,
    }
    return CambioActa('familiar', 'CREAR', 'familiar', '*', valor)


def test_la_revision_muestra_la_cedula_generada_sin_guardarla():
    cambio = _alta()
    assert 'cedula_generada' not in cambio.valor_propuesto
    datos = a_dict_cambio(cambio, PASIVO)
    assert datos['valor_propuesto']['cedula_generada'] == f'{PASIVO}-2'
    # Sigue sin escribirse en la entidad (no se persiste).
    assert 'cedula_generada' not in cambio.valor_propuesto


def test_familiar_con_cedula_propia_no_muestra_cedula_generada():
    datos = a_dict_cambio(_alta(cedula_familiar='V-12345678'), PASIVO)
    assert 'cedula_generada' not in datos['valor_propuesto']


def test_borrador_legado_que_ya_trae_el_campo_se_respeta():
    cambio = CambioActa(
        'familiar', 'CREAR', 'familiar', '*',
        {'primer_nombre': 'LUCIA', 'orden_hijo': 2, 'cedula_generada': f'{PASIVO}-9'},
    )
    datos = a_dict_cambio(cambio, PASIVO)
    assert datos['valor_propuesto']['cedula_generada'] == f'{PASIVO}-9'


def test_modificar_un_campo_de_familiar_no_agrega_el_campo():
    cambio = CambioActa('familiar', 'MODIFICAR', 'familiar', 'primer_nombre', 'LUCIA', entidad_id='7')
    assert 'cedula_generada' not in a_dict_cambio(cambio, PASIVO)['valor_propuesto']


def test_valores_que_no_son_dict_o_sin_orden_no_cambian():
    assert con_cedula_generada('texto', PASIVO) == 'texto'
    assert con_cedula_generada(None, PASIVO) is None
    assert con_cedula_generada({'parentesco_id': 1}, PASIVO) == {'parentesco_id': 1}
    assert con_cedula_generada({'orden_hijo': 'x'}, PASIVO) == {'orden_hijo': 'x'}
