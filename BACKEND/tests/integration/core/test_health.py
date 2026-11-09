"""El endpoint de salud no exige autenticación ni toca la base de datos."""
from django.test import Client


def test_health_responde_200_sin_base_de_datos():
    respuesta = Client().get("/api/v1/health/")

    assert respuesta.status_code == 200
    assert respuesta.json() == {"status": "ok"}
