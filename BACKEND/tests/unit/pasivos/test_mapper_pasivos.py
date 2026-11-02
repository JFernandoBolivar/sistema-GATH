"""
Tests unitarios de `cargo_egresado_a_dict` (Arquitectura Onion pura, sin BD):
verifica que el historial de cargos de un pasivo resuelva tanto el `_id`
crudo como el `_nombre` de cada catálogo (mismo patrón que
`CargoAsignacionSerializer` de `apps.cargos` para cargos activos), para que
la UI de detalle de pasivo no tenga que resolver ~9 catálogos por su cuenta.
"""
from types import SimpleNamespace

from apps.pasivos.infrastructure.mappers.mapper_pasivos import cargo_egresado_a_dict


def _catalogo(nombre_atributo: str, valor: str, id_valor: int = 1):
    return SimpleNamespace(**{nombre_atributo: valor}), id_valor


def _cargo_egresado_mock(*, con_opcionales=True):
    grado, grado_id = _catalogo("grado", "Grado III", 5) if con_opcionales else (None, None)
    direccion_general, dg_id = _catalogo("direccion_general", "Dirección General de Personal", 7) if con_opcionales else (None, None)
    direccion_linea, dl_id = _catalogo("direccion_linea", "Línea de Talento Humano", 8) if con_opcionales else (None, None)
    coordinacion, co_id = _catalogo("coordinacion", "Coordinación de Nómina", 9) if con_opcionales else (None, None)
    organismo, org_id = _catalogo("Organismoadscrito", "Ministerio de Ejemplo", 10) if con_opcionales else (None, None)

    return SimpleNamespace(
        codigo="AN-001",
        denominacioncargoid=SimpleNamespace(cargo="Analista"),
        denominacioncargoid_id=1,
        denominacioncargoespecificoid=SimpleNamespace(cargo="Analista de Sistemas"),
        denominacioncargoespecificoid_id=2,
        gradoId=grado,
        gradoId_id=grado_id,
        tipoNominaId=SimpleNamespace(nomina="Fija"),
        tipoNominaId_id=3,
        tipoPersonalId=SimpleNamespace(tipo_personal="ACTIVO"),
        tipoPersonalId_id=4,
        dependenciaId=SimpleNamespace(dependencia="Dirección de Tecnología"),
        dependenciaId_id=6,
        direccionGeneralId=direccion_general,
        direccionGeneralId_id=dg_id,
        direccionLineaId=direccion_linea,
        direccionLineaId_id=dl_id,
        coordinacionId=coordinacion,
        coordinacionId_id=co_id,
        organismoAdscritoId=organismo,
        organismoAdscritoId_id=org_id,
    )


def test_cargo_egresado_a_dict_resuelve_ids_y_nombres():
    resultado = cargo_egresado_a_dict(_cargo_egresado_mock())

    assert resultado["codigo"] == "AN-001"
    assert resultado["denominacioncargo_id"] == 1
    assert resultado["denominacioncargo_nombre"] == "Analista"
    assert resultado["denominacioncargoespecifico_nombre"] == "Analista de Sistemas"
    assert resultado["grado_nombre"] == "Grado III"
    assert resultado["tipo_nomina_nombre"] == "Fija"
    assert resultado["tipo_personal_nombre"] == "ACTIVO"
    assert resultado["dependencia_nombre"] == "Dirección de Tecnología"
    assert resultado["direccion_general_nombre"] == "Dirección General de Personal"
    assert resultado["direccion_linea_nombre"] == "Línea de Talento Humano"
    assert resultado["coordinacion_nombre"] == "Coordinación de Nómina"
    assert resultado["organismo_adscrito_nombre"] == "Ministerio de Ejemplo"


def test_cargo_egresado_a_dict_sin_catalogos_opcionales_no_lanza_error():
    resultado = cargo_egresado_a_dict(_cargo_egresado_mock(con_opcionales=False))

    assert resultado["grado_id"] is None
    assert resultado["grado_nombre"] is None
    assert resultado["direccion_general_nombre"] is None
    assert resultado["direccion_linea_nombre"] is None
    assert resultado["coordinacion_nombre"] is None
    assert resultado["organismo_adscrito_nombre"] is None
    # Los catálogos obligatorios (dependencia, tipo de nómina, tipo de
    # personal, denominaciones) siguen resolviéndose igual.
    assert resultado["dependencia_nombre"] == "Dirección de Tecnología"
    assert resultado["tipo_nomina_nombre"] == "Fija"
