"""
Definición canónica por capas de plantillas por defecto (O44 - E3, E7).
Basado en el prototipo canónico en mm con soporte de dos caras y reglas de color.
Reglas de color: criterio configurable (nómina, cargo, oficina, nivel, otro, único)
con valor de respaldo y Funcionario azul marino (#1f3a5f) inicial.
Textos corregidos: Adscrito, Gestión, pérdida, lugar.
"""
from typing import Any


def plantilla_defecto_trabajador() -> dict[str, Any]:
    """Plantilla institucional estándar de trabajador (54 x 85.6 mm, dos caras)."""
    p = 'rule:primario'
    a = 'rule:acento'
    t = 'rule:texto'
    return {
        'orientacion': 'vertical',
        'dimensiones': {'ancho_mm': 54.0, 'alto_mm': 85.6},
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
        'reglas': {
            'criterio': 'nomina',
            'primario': '#1f3a5f',   # Azul marino institucional (Funcionario)
            'acento': '#1273bd',     # Azul acento
            'texto': '#ffffff',      # Blanco
            'respaldo': {
                'primario': '#1f3a5f',
                'acento': '#1273bd',
                'texto': '#ffffff',
            },
            'valores': {
                'FUNCIONARIO': {'primario': '#1f3a5f', 'acento': '#1273bd', 'texto': '#ffffff'},
                'ALTO_NIVEL': {'primario': '#1f3a5f', 'acento': '#1273bd', 'texto': '#ffffff'},
                'EMPLEADO_FIJO': {'primario': '#16264a', 'acento': '#1273bd', 'texto': '#ffffff'},
                'CONTRATADO': {'primario': '#c79a12', 'acento': '#16264a', 'texto': '#ffffff'},
                'OBRERO_FIJO': {'primario': '#b3121b', 'acento': '#16264a', 'texto': '#ffffff'},
                'OBRERO_CONTRATADO': {'primario': '#b3121b', 'acento': '#16264a', 'texto': '#ffffff'},
                'HONORARIOS_PROFESIONALES': {'primario': '#2a6f6a', 'acento': '#16264a', 'texto': '#ffffff'},
                'COMISION_SERVICIO': {'primario': '#4b5f8a', 'acento': '#16264a', 'texto': '#ffffff'},
                'PASANTE': {'primario': '#6b7686', 'acento': '#16264a', 'texto': '#ffffff'},
                'JUBILADO': {'primario': '#1f4e38', 'acento': '#2d7a58', 'texto': '#ffffff'},
                'PENSIONADO': {'primario': '#1f4e38', 'acento': '#2d7a58', 'texto': '#ffffff'},
            },
        },
        'anverso': [
            {'id': 'f-sup', 'tipo': 'diag', 'nombre': 'Franja superior', 'x': 0, 'y': 0, 'w': 45, 'h': 15, 'props': {'fill': p}},
            {'id': 'ac-sup', 'tipo': 'diagr', 'nombre': 'Acento superior', 'x': 36, 'y': 0, 'w': 18, 'h': 8, 'props': {'fill': a}},
            {'id': 'logo', 'tipo': 'image', 'nombre': 'Logo institucional', 'x': 4, 'y': 4, 'w': 22, 'h': 7, 'props': {'label': 'LOGO', 'fill': t}},
            {'id': 'foto', 'tipo': 'photo', 'nombre': 'Foto del titular', 'x': 15, 'y': 18, 'w': 24, 'h': 24, 'props': {'fill': '#d7dbe2', 'radius': 2}},
            {'id': 'nombre', 'tipo': 'field', 'campo': 'nombre_completo', 'nombre': 'Nombre completo', 'x': 5, 'y': 44, 'w': 44, 'h': 6, 'fontSize': 10, 'bold': True, 'align': 'center'},
            {'id': 'cedula', 'tipo': 'field', 'campo': 'cedula', 'nombre': 'Cédula de identidad', 'x': 5, 'y': 50, 'w': 44, 'h': 4.5, 'fontSize': 8, 'bold': True, 'align': 'center'},
            {'id': 'cargo', 'tipo': 'field', 'campo': 'cargo', 'nombre': 'Cargo', 'x': 5, 'y': 54.5, 'w': 44, 'h': 4.5, 'fontSize': 8, 'bold': False, 'align': 'center'},
            {'id': 'linea-sep', 'tipo': 'line', 'nombre': 'Línea decorativa', 'x': 5, 'y': 59.4, 'w': 38, 'h': 0.4, 'props': {'fill': a}},
            {'id': 'oficina', 'tipo': 'field', 'campo': 'departamento', 'nombre': 'Oficina de Gestión Humana', 'x': 5, 'y': 60.5, 'w': 33, 'h': 7, 'fontSize': 6, 'bold': False, 'color': '#4a2030'},
            {'id': 'qr', 'tipo': 'qr', 'nombre': 'Código QR seguro', 'x': 39, 'y': 56, 'w': 12, 'h': 12, 'props': {'fill': '#111827'}},
            {'id': 'f-inf', 'tipo': 'diag', 'nombre': 'Franja inferior', 'x': 0, 'y': 72, 'w': 36, 'h': 13.6, 'props': {'fill': p}},
            {'id': 'ac-inf', 'tipo': 'diagr', 'nombre': 'Acento inferior', 'x': 28, 'y': 72, 'w': 26, 'h': 13.6, 'props': {'fill': a}},
            {'id': 'firma', 'tipo': 'image', 'nombre': 'Firma de autoridad', 'x': 36, 'y': 75, 'w': 15, 'h': 6, 'props': {'label': 'FIRMA', 'fill': t}},
            {'id': 'cargo-firmante', 'tipo': 'text', 'nombre': 'Cargo del firmante', 'texto': 'Director General', 'x': 34, 'y': 81.5, 'w': 18, 'h': 3, 'fontSize': 4, 'bold': True, 'align': 'center', 'color': t},
        ],
        'reverso': [
            {'id': 'rev-sup', 'tipo': 'rect', 'nombre': 'Franja superior reverso', 'x': 0, 'y': 0, 'w': 54, 'h': 7, 'props': {'fill': p}},
            {'id': 'rev-normas', 'tipo': 'text', 'nombre': 'Normas de uso', 'texto': '•  Este carnet es de uso exclusivo del personal.\n•  Debe ser utilizado en un lugar visible.\n•  Es intransferible.\n•  En caso de extravío o pérdida, debe consignarse en la oficina de seguridad.', 'x': 5, 'y': 10, 'w': 44, 'h': 24, 'fontSize': 6},
            {'id': 'rev-box-adsc', 'tipo': 'rect', 'nombre': 'Fondo de adscripción', 'x': 8, 'y': 36, 'w': 38, 'h': 10, 'props': {'fill': '#f1f5f9', 'rad': 1.5}},
            {'id': 'rev-lbl-adsc', 'tipo': 'text', 'nombre': 'Título adscripción', 'texto': 'Adscrito a la unidad de:', 'x': 8, 'y': 37, 'w': 38, 'h': 3.5, 'fontSize': 5.5, 'bold': True, 'align': 'center'},
            {'id': 'rev-val-adsc', 'tipo': 'field', 'campo': 'departamento', 'nombre': 'Unidad de adscripción', 'x': 9, 'y': 40.5, 'w': 36, 'h': 4.5, 'fontSize': 5.5, 'bold': True, 'align': 'center'},
            {'id': 'rev-qr', 'tipo': 'qr', 'nombre': 'QR de verificación', 'x': 18, 'y': 48, 'w': 18, 'h': 18, 'props': {'fill': '#111827'}},
            {'id': 'rev-firma', 'tipo': 'image', 'nombre': 'Firma reverso', 'x': 16, 'y': 67, 'w': 22, 'h': 7.5, 'props': {'label': 'FIRMA', 'fill': '#1f3a5f'}},
            {'id': 'rev-linea-firma', 'tipo': 'signline', 'nombre': 'Línea de firma', 'x': 13, 'y': 75, 'w': 28, 'h': 0.3, 'props': {'fill': '#1f3a5f'}},
            {'id': 'rev-cargo-firmante', 'tipo': 'text', 'nombre': 'Cargo autorizante', 'texto': 'Director General', 'x': 7, 'y': 76, 'w': 40, 'h': 3.5, 'fontSize': 6, 'bold': True, 'align': 'center', 'color': '#1f3a5f'},
        ],
    }


def plantilla_defecto_pasivo() -> dict[str, Any]:
    """Plantilla institucional estándar de pasivos (pensionados/jubilados)."""
    p = '#1f4e38'   # Verde oscuro institucional pasivos
    a = '#2d7a58'
    t = '#ffffff'
    return {
        'orientacion': 'vertical',
        'dimensiones': {'ancho_mm': 54.0, 'alto_mm': 85.6},
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
        'reglas': {
            'criterio': 'unico',
            'primario': p,
            'acento': a,
            'texto': t,
            'respaldo': {
                'primario': p,
                'acento': a,
                'texto': t,
            },
            'valores': {},
        },
        'anverso': [
            {'id': 'f-sup', 'tipo': 'diag', 'nombre': 'Franja superior', 'x': 0, 'y': 0, 'w': 45, 'h': 15, 'props': {'fill': p}},
            {'id': 'ac-sup', 'tipo': 'diagr', 'nombre': 'Acento superior', 'x': 36, 'y': 0, 'w': 18, 'h': 8, 'props': {'fill': a}},
            {'id': 'logo', 'tipo': 'image', 'nombre': 'Logo institucional', 'x': 4, 'y': 4, 'w': 22, 'h': 7, 'props': {'label': 'LOGO', 'fill': t}},
            {'id': 'tipo-badge', 'tipo': 'text', 'nombre': 'Etiqueta de pasivo', 'texto': 'PERSONAL JUBILADO / PENSIONADO', 'x': 4, 'y': 12, 'w': 46, 'h': 4, 'fontSize': 5, 'bold': True, 'color': '#ffffff', 'align': 'center'},
            {'id': 'foto', 'tipo': 'photo', 'nombre': 'Foto del titular', 'x': 15, 'y': 18, 'w': 24, 'h': 24, 'props': {'fill': '#d7dbe2', 'radius': 2}},
            {'id': 'nombre', 'tipo': 'field', 'campo': 'nombre_completo', 'nombre': 'Nombre completo', 'x': 5, 'y': 44, 'w': 44, 'h': 6, 'fontSize': 10, 'bold': True, 'align': 'center'},
            {'id': 'cedula', 'tipo': 'field', 'campo': 'cedula', 'nombre': 'Cédula de identidad', 'x': 5, 'y': 50, 'w': 44, 'h': 4.5, 'fontSize': 8, 'bold': True, 'align': 'center'},
            {'id': 'condicion', 'tipo': 'text', 'nombre': 'Condición', 'texto': 'Jubilado(a) Institucional', 'x': 5, 'y': 54.5, 'w': 44, 'h': 4.5, 'fontSize': 7.5, 'bold': False, 'align': 'center'},
            {'id': 'linea-sep', 'tipo': 'line', 'nombre': 'Línea decorativa', 'x': 5, 'y': 59.4, 'w': 38, 'h': 0.4, 'props': {'fill': a}},
            {'id': 'qr', 'tipo': 'qr', 'nombre': 'Código QR seguro', 'x': 39, 'y': 56, 'w': 12, 'h': 12, 'props': {'fill': '#111827'}},
            {'id': 'f-inf', 'tipo': 'diag', 'nombre': 'Franja inferior', 'x': 0, 'y': 72, 'w': 36, 'h': 13.6, 'props': {'fill': p}},
            {'id': 'ac-inf', 'tipo': 'diagr', 'nombre': 'Acento inferior', 'x': 28, 'y': 72, 'w': 26, 'h': 13.6, 'props': {'fill': a}},
            {'id': 'firma', 'tipo': 'image', 'nombre': 'Firma de autoridad', 'x': 36, 'y': 75, 'w': 15, 'h': 6, 'props': {'label': 'FIRMA', 'fill': t}},
            {'id': 'cargo-firmante', 'tipo': 'text', 'nombre': 'Cargo del firmante', 'texto': 'Director General', 'x': 34, 'y': 81.5, 'w': 18, 'h': 3, 'fontSize': 4, 'bold': True, 'align': 'center', 'color': t},
        ],
        'reverso': [
            {'id': 'rev-sup', 'tipo': 'rect', 'nombre': 'Franja superior', 'x': 0, 'y': 0, 'w': 54, 'h': 7, 'props': {'fill': p}},
            {'id': 'rev-normas', 'tipo': 'text', 'nombre': 'Indicaciones de pasivos', 'texto': '•  Credencial oficial para personal jubilado y pensionado.\n•  Identificación para acceso y beneficios asistenciales.\n•  Personal e intransferible.\n•  En caso de extravío o pérdida, notificar a la Oficina de Gestión Humana.', 'x': 5, 'y': 10, 'w': 44, 'h': 26, 'fontSize': 6},
            {'id': 'rev-qr', 'tipo': 'qr', 'nombre': 'QR de verificación', 'x': 18, 'y': 44, 'w': 18, 'h': 18, 'props': {'fill': '#111827'}},
            {'id': 'rev-firma', 'tipo': 'image', 'nombre': 'Firma reverso', 'x': 16, 'y': 67, 'w': 22, 'h': 7.5, 'props': {'label': 'FIRMA', 'fill': p}},
            {'id': 'rev-linea-firma', 'tipo': 'signline', 'nombre': 'Línea de firma', 'x': 13, 'y': 75, 'w': 28, 'h': 0.3, 'props': {'fill': p}},
            {'id': 'rev-cargo-firmante', 'tipo': 'text', 'nombre': 'Cargo autorizante', 'texto': 'Director General', 'x': 7, 'y': 76, 'w': 40, 'h': 3.5, 'fontSize': 6, 'bold': True, 'align': 'center', 'color': p},
        ],
    }


def plantilla_defecto_evento() -> dict[str, Any]:
    """Plantilla de gafete institucional para eventos e invitados (90 x 130 mm, dos caras)."""
    p = 'rule:primario'
    a = 'rule:acento'
    t = 'rule:texto'
    return {
        'orientacion': 'vertical',
        'dimensiones': {'ancho_mm': 90.0, 'alto_mm': 130.0},
        'ancho_mm': 90.0,
        'alto_mm': 130.0,
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
        'reglas': {
            'criterio': 'categoria',
            'primario': '#0B4A9E',
            'acento': '#F59E0B',
            'texto': '#ffffff',
            'respaldo': {
                'primario': '#0B4A9E',
                'acento': '#F59E0B',
                'texto': '#ffffff',
            },
            'valores': {
                'Invitado especial': {'primario': '#0B4A9E', 'acento': '#F59E0B', 'texto': '#ffffff'},
                'Autoridad': {'primario': '#1E3A8A', 'acento': '#D97706', 'texto': '#ffffff'},
                'Prensa': {'primario': '#047857', 'acento': '#10B981', 'texto': '#ffffff'},
                'Staff': {'primario': '#374151', 'acento': '#6B7280', 'texto': '#ffffff'},
                'Asistente': {'primario': '#0284C7', 'acento': '#38BDF8', 'texto': '#ffffff'},
            },
        },
        'anverso': [
            {'id': 'ev-sup', 'tipo': 'rect', 'nombre': 'Fondo superior', 'x': 0, 'y': 0, 'w': 90, 'h': 34, 'props': {'fill': p}},
            {'id': 'ev-logo', 'tipo': 'image', 'nombre': 'Logo institucional', 'x': 8, 'y': 5, 'w': 30, 'h': 10, 'props': {'label': 'LOGO', 'fill': t}},
            {'id': 'ev-nombre', 'tipo': 'field', 'campo': 'nombre_evento', 'nombre': 'Nombre del evento', 'x': 8, 'y': 17, 'w': 74, 'h': 14, 'fontSize': 14, 'bold': True, 'color': t},
            {'id': 'asist-nombre', 'tipo': 'field', 'campo': 'nombre_completo', 'nombre': 'Nombre del asistente', 'x': 8, 'y': 38, 'w': 74, 'h': 16, 'fontSize': 14, 'bold': True, 'align': 'center'},
            {'id': 'asist-org', 'tipo': 'field', 'campo': 'organizacion', 'nombre': 'Organización', 'x': 8, 'y': 56, 'w': 74, 'h': 8, 'fontSize': 9, 'bold': False, 'align': 'center', 'color': '#4B5563'},
            {'id': 'ev-banda-cat', 'tipo': 'rect', 'nombre': 'Banda de categoría', 'x': 0, 'y': 68, 'w': 90, 'h': 14, 'props': {'fill': a}},
            {'id': 'asist-cat', 'tipo': 'field', 'campo': 'categoria', 'nombre': 'Categoría', 'x': 8, 'y': 70, 'w': 74, 'h': 10, 'fontSize': 12, 'bold': True, 'align': 'center', 'color': t},
            {'id': 'ev-qr', 'tipo': 'qr', 'nombre': 'Código QR', 'x': 8, 'y': 88, 'w': 28, 'h': 28, 'props': {'fill': '#111827'}},
            {'id': 'ev-fecha', 'tipo': 'field', 'campo': 'fecha_evento', 'nombre': 'Fecha del evento', 'x': 40, 'y': 90, 'w': 44, 'h': 6, 'fontSize': 8, 'bold': True},
            {'id': 'ev-zona', 'tipo': 'field', 'campo': 'zona', 'nombre': 'Zona de acceso', 'x': 40, 'y': 98, 'w': 44, 'h': 6, 'fontSize': 8, 'bold': False},
            {'id': 'ev-mesa', 'tipo': 'field', 'campo': 'mesa', 'nombre': 'Mesa o asiento', 'x': 40, 'y': 106, 'w': 44, 'h': 6, 'fontSize': 8, 'bold': False},
            {'id': 'ev-codigo', 'tipo': 'field', 'campo': 'codigo_credencial', 'nombre': 'Código de credencial', 'x': 40, 'y': 114, 'w': 44, 'h': 5, 'fontSize': 7, 'bold': False, 'color': '#6B7280'},
        ],
        'reverso': [
            {'id': 'rev-ev-sup', 'tipo': 'rect', 'nombre': 'Fondo superior reverso', 'x': 0, 'y': 0, 'w': 90, 'h': 14, 'props': {'fill': p}},
            {'id': 'rev-ev-normas', 'tipo': 'text', 'nombre': 'Indicaciones de acceso', 'texto': '•  Presente esta credencial obligatoriamente al ingresar.\n•  Es personal e intransferible.\n•  Consérvela en lugar visible durante todo el desarrollo del evento.\n•  El código QR es único y valida su autorización de acceso.', 'x': 8, 'y': 22, 'w': 74, 'h': 35, 'fontSize': 8},
            {'id': 'rev-ev-qr', 'tipo': 'qr', 'nombre': 'Código QR reverso', 'x': 30, 'y': 70, 'w': 30, 'h': 30, 'props': {'fill': '#111827'}},
            {'id': 'rev-ev-pie', 'tipo': 'text', 'nombre': 'Pie institucional', 'texto': 'Comisión Nacional de Telecomunicaciones — CONATEL', 'x': 8, 'y': 112, 'w': 74, 'h': 6, 'fontSize': 7, 'bold': True, 'align': 'center', 'color': '#4B5563'},
        ],
    }

