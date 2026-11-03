"""Endpoint de salud para el healthcheck de Docker/compose.

No consulta la base de datos ni exige autenticación: solo confirma que el
proceso atiende peticiones HTTP. No expone versión, entorno ni datos internos.
"""
from django.http import JsonResponse


def health(request):
    return JsonResponse({"status": "ok"})
