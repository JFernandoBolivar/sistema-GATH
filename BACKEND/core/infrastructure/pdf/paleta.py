"""Paleta cromática institucional de CONATEL para los reportes y documentos PDF (O25).

Centraliza los colores corporativos:
- Azules institucionales (#0B4A9E, #0A2F66, #1A237E, #E8EEF8)
- Amarillo / ámbar de acento (#D97706, #F59E0B) para alertas y faltantes (NUNCA rojo en gráficos)
- Escala de grises sobria para textos, bordes y fondos suaves

Prohibido el uso de valores hexadecimales aislados en los generadores de PDF.
"""
from reportlab.lib import colors

# ── Valores hexadecimales institucionales ──
HEX_AZUL_CONATEL = '#0B4A9E'
HEX_AZUL_OSCURO = '#0A2F66'
HEX_AZUL_INTERMEDIO = '#1A237E'
HEX_AZUL_CLARO = '#E8EEF8'

HEX_AMARILLO_ACENTO = '#D97706'
HEX_AMARILLO_DORADO = '#F59E0B'
HEX_AMARILLO_SUAVE = '#FEF3C7'

HEX_NEGRO = '#111827'
HEX_GRIS_TEXTO = '#374151'
HEX_GRIS_MUTED = '#6B7280'
HEX_GRIS_BORDE = '#D5DAE3'
HEX_GRIS_FONDO = '#F7F9FC'
HEX_BLANCO = '#FFFFFF'

# ── Objetos HexColor de ReportLab ──
AZUL_CONATEL = colors.HexColor(HEX_AZUL_CONATEL)
AZUL_OSCURO = colors.HexColor(HEX_AZUL_OSCURO)
AZUL_INTERMEDIO = colors.HexColor(HEX_AZUL_INTERMEDIO)
AZUL_CLARO = colors.HexColor(HEX_AZUL_CLARO)

AMARILLO_ACENTO = colors.HexColor(HEX_AMARILLO_ACENTO)
AMARILLO_DORADO = colors.HexColor(HEX_AMARILLO_DORADO)
AMARILLO_SUAVE = colors.HexColor(HEX_AMARILLO_SUAVE)

NEGRO = colors.HexColor(HEX_NEGRO)
GRIS_TEXTO = colors.HexColor(HEX_GRIS_TEXTO)
GRIS_MUTED = colors.HexColor(HEX_GRIS_MUTED)
GRIS_BORDE = colors.HexColor(HEX_GRIS_BORDE)
GRIS_FONDO = colors.HexColor(HEX_GRIS_FONDO)
BLANCO = colors.white

# ── Alias semánticos para gráficos y reportes (REGLA O25: CERO ROJO) ──
COLOR_RESPONDIDOS = AZUL_CONATEL
COLOR_FALTANTES = AMARILLO_ACENTO
COLOR_BARRAS_ESTADO = AZUL_INTERMEDIO
COLOR_TITULO = AZUL_OSCURO
COLOR_SUBTITULO = GRIS_MUTED
COLOR_LINEA_DIVISORIA = GRIS_BORDE
COLOR_TABLA_ENCABEZADO_FONDO = AZUL_INTERMEDIO
COLOR_TABLA_ENCABEZADO_TEXTO = BLANCO
COLOR_TABLA_FILA_PAR = GRIS_FONDO
COLOR_TABLA_BORDE = GRIS_BORDE
