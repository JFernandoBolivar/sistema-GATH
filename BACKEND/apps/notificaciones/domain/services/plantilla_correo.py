"""
Plantilla del correo transaccional de GATH: texto plano + HTML simple, en español, con aviso de
correo automático. Pura: recibe los datos y devuelve (texto, html). El HTML escapa todo dato.
"""
from html import escape

AVISO_AUTOMATICO = (
    'Este es un correo automático del sistema GATH de CONATEL. Por favor no responda a este mensaje.'
)
PIE = 'Comisión Nacional de Telecomunicaciones (CONATEL)'
SALUDO = 'Estimado(a) usuario(a):'
FIRMA = 'Gestión Humana — CONATEL'


def render_correo(titulo: str, mensaje: str, enlace_absoluto: str = '') -> tuple[str, str]:
    lineas_texto = [titulo, '', SALUDO, '', mensaje]
    if enlace_absoluto:
        lineas_texto += ['', f'Ingrese al sistema para ver el detalle: {enlace_absoluto}']
    lineas_texto += ['', 'Atentamente,', FIRMA, '', '--', PIE, AVISO_AUTOMATICO]
    texto = '\n'.join(lineas_texto)

    parrafos = ''.join(f'<p style="margin:0 0 12px">{escape(p)}</p>' for p in mensaje.split('\n') if p.strip())
    boton = (
        f'<p style="margin:16px 0"><a href="{escape(enlace_absoluto, quote=True)}" '
        'style="background:#1d4ed8;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none">'
        'Ver en GATH</a></p>'
    ) if enlace_absoluto else ''
    html = (
        '<!doctype html><html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#111827;'
        'max-width:560px;margin:0 auto;padding:16px">'
        f'<h2 style="font-size:18px;margin:0 0 16px">{escape(titulo)}</h2><p style="margin:0 0 12px">{escape(SALUDO)}</p>{parrafos}{boton}'
        f'<p style="margin:16px 0 0">Atentamente,<br><strong>{escape(FIRMA)}</strong></p>'
        '<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">'
        f'<p style="font-size:12px;color:#6b7280;margin:0">{escape(PIE)}<br>{escape(AVISO_AUTOMATICO)}</p>'
        '</body></html>'
    )
    return texto, html
