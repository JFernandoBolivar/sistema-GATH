"""
Permisos del módulo de movimientos (contrato C-3, D-07). Un único lugar para
los códigos: las vistas y los avisos no repiten literales sueltos.
"""

PERMISO_VER = 'movimientos.ver'
PERMISO_EXPORTAR_PDF = 'movimientos.exportar_pdf'
PERMISO_EXPORTAR_EXCEL = 'movimientos.exportar_excel'

# Quién recibe los avisos de movimientos de personal (RRHH y Bienestar). Es un
# permiso propio para no notificar a cualquier cuenta con acceso a personal.
PERMISO_AVISOS_MOVIMIENTOS = 'personal.recibir_avisos_movimientos'
