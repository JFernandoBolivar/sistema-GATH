"""IP real del cliente para auditoría y seguridad (detrás de proxies de confianza).

La misma regla que usa DRF para el throttling (`NUM_PROXIES`): con N proxies de
confianza se toma el salto N contando desde el final de `X-Forwarded-For`. Sin
proxies configurados se usa `REMOTE_ADDR` y no se confía en la cabecera, que el
cliente puede falsificar.
"""
from django.conf import settings


def ip_del_cliente(request) -> str | None:
    """IP del cliente según los proxies de confianza; `None` si no se puede resolver."""
    remota = request.META.get('REMOTE_ADDR') or None
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    try:
        # Mismo valor que usa DRF: REST_FRAMEWORK['NUM_PROXIES'] (DJANGO_NUM_PROXIES).
        proxies = int((getattr(settings, 'REST_FRAMEWORK', {}) or {}).get('NUM_PROXIES') or 0)
    except (TypeError, ValueError):
        proxies = 0
    if proxies <= 0 or not xff:
        return remota
    saltos = [salto.strip() for salto in xff.split(',') if salto.strip()]
    if not saltos:
        return remota
    return saltos[-min(proxies, len(saltos))]
