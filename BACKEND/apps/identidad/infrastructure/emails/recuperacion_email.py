"""
Servicio de envío de correo institucional para recuperación de contraseña (CONATEL).
"""
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger('security_backend')


def enviar_correo_recuperacion(destinatario: str, nombre_completo: str, enlace: str) -> None:
    """Envía un correo institucional con el enlace y token de recuperación de contraseña."""
    asunto = "[GATH - CONATEL] Solicitud de Restablecimiento de Contraseña"
    remitente = settings.DEFAULT_FROM_EMAIL

    texto_plano = f"""
Estimado(a) {nombre_completo},

Hemos recibido una solicitud para restablecer la contraseña de su cuenta en el Sistema GATH (Gestión y Administración de Talento Humano - CONATEL).

Para crear una nueva contraseña, por favor acceda al siguiente enlace:
{enlace}

IMPORTANTE:
- Este enlace es de un solo uso y expirará automáticamente en 15 minutos.
- Si usted no realizó esta solicitud, puede desestimar este mensaje. Su cuenta permanecerá segura y su contraseña actual no será modificada.

Atentamente,
Oficina de Gestión Humana
Comisión Nacional de Telecomunicaciones (CONATEL)
""".strip()

    html_content = f"""
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Restablecimiento de Contraseña - GATH CONATEL</title>
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 30px 10px; color: #1e293b;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
    <!-- Header -->
    <tr>
      <td style="background-color: #0d3268; padding: 24px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px;">GATH · CONATEL</h1>
        <p style="color: #93c5fd; margin: 4px 0 0 0; font-size: 12px;">Gestión y Administración de Talento Humano</p>
      </td>
    </tr>
    <!-- Contenido -->
    <tr>
      <td style="padding: 32px 30px;">
        <h2 style="color: #0f172a; font-size: 18px; margin-top: 0; font-weight: 700;">Solicitud de Restablecimiento de Contraseña</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Estimado(a) <strong>{nombre_completo}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Hemos recibido una solicitud para restablecer la contraseña de acceso a su cuenta en el Sistema Institucional GATH.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Para ingresar una nueva contraseña, por favor haga clic en el siguiente botón:
        </p>
        <!-- Botón -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 28px auto;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #1a56db;">
              <a href="{enlace}" target="_blank" style="font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 12px 28px; display: inline-block; border-radius: 8px;">
                Restablecer Contraseña
              </a>
            </td>
          </tr>
        </table>
        <!-- Aviso de expiración -->
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 24px 0;">
          <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">
            ⏱ Este enlace es válido únicamente durante 15 minutos y se desactivará tras su primer uso.
          </p>
        </div>
        <p style="font-size: 12px; line-height: 1.5; color: #64748b;">
          Si tiene problemas con el botón, copie y pegue la siguiente dirección en la barra de su navegador:<br>
          <a href="{enlace}" style="color: #1a56db; word-break: break-all;">{enlace}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="font-size: 12px; line-height: 1.5; color: #94a3b8;">
          Si usted no solicitó este cambio de clave, por favor desestime este mensaje. Su contraseña actual no ha sido modificada y sus credenciales continúan seguras.
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 16px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 11px; margin: 0;">
          Comisión Nacional de Telecomunicaciones (CONATEL) · República Bolivariana de Venezuela
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
""".strip()

    msg = EmailMultiAlternatives(
        subject=asunto,
        body=texto_plano,
        from_email=remitente,
        to=[destinatario],
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send(fail_silently=False)
    logger.info("Correo de restablecimiento de contraseña enviado a %s", destinatario)
