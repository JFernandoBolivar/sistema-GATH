"""
Envío de correo con el backend configurado en settings (SMTP institucional en producción; consola o
archivo en desarrollo vía DJANGO_EMAIL_BACKEND). No decide nada por su cuenta: si el transporte
falla, lanza la excepción y el caso de uso la convierte en un reintento.
"""
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection

REMITENTE_POR_DEFECTO = 'gath@conatel.gob.ve'


class EnviadorCorreoDjango:
    def enviar(self, *, destinatario, copia_a, asunto, texto, html, adjuntos) -> None:
        remitente = getattr(settings, 'DEFAULT_FROM_EMAIL', '') or REMITENTE_POR_DEFECTO
        correo = EmailMultiAlternatives(
            subject=asunto, body=texto, from_email=remitente, to=[destinatario], cc=list(copia_a),
            connection=get_connection(),
        )
        correo.attach_alternative(html, 'text/html')
        for nombre, contenido, mime in adjuntos:
            correo.attach(nombre, contenido, mime)
        correo.send(fail_silently=False)
