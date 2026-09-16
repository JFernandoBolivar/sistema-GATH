"""
Test unitario (sin BD) del envelope de error de `EmpleadoFotoView`.

Corrige CRIT-02 de AUDITORIA_CALIDAD_BACKEND_2026-09-15.md: la vista usaba
`ok()` (envelope de éxito, `status: 'success'`) para responder un 400 cuando
no se envía archivo. Este test confirma que ahora usa `fail()` — el sobre C-1
debe reflejar `status: 'error'` en cualquier respuesta con código >= 400.
"""
from rest_framework.test import APIRequestFactory

from apps.personal.presentation.views.personal_views import EmpleadoFotoView


def test_empleado_foto_view_sin_archivo_responde_envelope_de_error():
    factory = APIRequestFactory()
    django_request = factory.post("/api/v1/personal/12345678/foto/", {})
    view = EmpleadoFotoView()
    request = view.initialize_request(django_request)

    response = view.post(request, cedula="12345678")

    assert response.status_code == 400
    assert response.data["status"] == "error"
    assert response.data["message"] == "No se proporcionó ningún archivo"
