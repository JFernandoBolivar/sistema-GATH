"""Preflight de esquema: solo lectura y salida JSON estable."""
import json
from io import StringIO

import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db


def test_verificar_esquema_emite_json_sin_bloqueantes():
    salida = StringIO()
    call_command("verificar_esquema", "--json", stdout=salida)
    informe = json.loads(salida.getvalue())

    assert informe["bloqueantes"] == 0
    assert informe["apto"] is True
    nombres = {r["nombre"] for r in informe["resultados"]}
    assert 'Tabla "Nacionalidad"' in nombres
    assert "Employee.nacionalidadId" in nombres
    assert "Historial de migraciones" in nombres


def test_verificar_esquema_estricto_falla_si_hay_avisos():
    """En la BD de pruebas no hay superadmin ni bootstrap: son avisos."""
    salida = StringIO()
    with pytest.raises(SystemExit) as salida_sistema:
        call_command("verificar_esquema", "--json", "--estricto", stdout=salida)

    assert salida_sistema.value.code == 1
    informe = json.loads(salida.getvalue())
    assert informe["bloqueantes"] == 0
    assert informe["avisos"] >= 1
    assert informe["apto"] is False
