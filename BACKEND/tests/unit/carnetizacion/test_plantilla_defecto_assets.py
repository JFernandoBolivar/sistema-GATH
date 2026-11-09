"""Plantilla de carnet: logo oficial y color aprobado (O46/plantilla)."""
from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_pasivo,
    plantilla_defecto_trabajador,
)


def _logo(definicion: dict) -> dict:
    return next(
        el
        for el in definicion['anverso']
        if el['tipo'] == 'image' and (el.get('props') or {}).get('label') == 'LOGO'
    )


def test_plantilla_trabajador_usa_logo_oficial_y_acento_aprobado():
    definicion = plantilla_defecto_trabajador()
    assert _logo(definicion)['props']['asset'] == 'logo01.png'
    assert definicion['reglas']['valores']['FUNCIONARIO'] == {
        'primario': '#16264a',
        'acento': '#d9121f',
        'texto': '#ffffff',
    }


def test_plantilla_pasivo_usa_logo_oficial():
    assert _logo(plantilla_defecto_pasivo())['props']['asset'] == 'logo01.png'


def test_el_asset_del_logo_existe_en_los_recursos_pdf():
    from core.infrastructure.pdf.pdf_components import ruta_asset

    assert ruta_asset('logo01.png')
