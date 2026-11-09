"""
Códigos de permiso que gobiernan el módulo de reportes (contrato C-3, D-07:
`[modulo].[accion]`). Un único lugar para los códigos: ni las vistas ni el
dominio repiten literales sueltos.

Los códigos existen en el seed del backend
(`apps/identidad/management/commands/seed_permisos.py`).
"""

PERMISO_VER_REPORTES = 'reportes.ver'
PERMISO_GENERAR_PDF = 'reportes.generar_pdf'
PERMISO_GENERAR_EXCEL = 'reportes.generar_excel'
PERMISO_ESTADISTICAS = 'reportes.estadisticas'

# Filtros de estructura organizativa (dependencia, dirección general, dirección
# de línea y coordinación). Son datos organizacionales, no del trabajador, y su
# consulta exige `organizacion.ver`: sin ese permiso el reporte no debe dejar
# segmentar la plantilla por unidad.
PERMISO_ESTRUCTURA_ORGANIZATIVA = 'organizacion.ver'
