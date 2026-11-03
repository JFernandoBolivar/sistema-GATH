"""El seed de permisos corre al final de la cadena de identidad."""
import importlib
import inspect


def test_0003_ya_no_ejecuta_el_seed():
    modulo = importlib.import_module("apps.identidad.migrations.0003_seed_permisos")
    fuente = inspect.getsource(modulo)
    assert "call_command('seed_permisos')" not in fuente
    assert "call_command(\"seed_permisos\")" not in fuente


def test_0010_depende_de_0009_y_de_core_y_ejecuta_el_seed():
    modulo = importlib.import_module("apps.identidad.migrations.0010_seed_permisos_final")
    dependencias = set(modulo.Migration.dependencies)
    assert ("identidad", "0009_desactivacion_egreso_cuenta") in dependencias
    assert any(app == "core" for app, _ in dependencias)
    assert "call_command('seed_permisos')" in inspect.getsource(modulo)
