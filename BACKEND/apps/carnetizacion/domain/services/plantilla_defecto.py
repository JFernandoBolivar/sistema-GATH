"""
Definición canónica por capas de plantillas por defecto (O44 - E3, E7).
Basado en el prototipo canónico en mm con soporte de dos caras y reglas de color.
Reglas de color: criterio configurable (nómina, cargo, oficina, nivel, otro, único)
con valor de respaldo y Funcionario azul marino (#1f3a5f) inicial.
Textos corregidos: Adscrito, Gestión, pérdida, lugar.
"""
from typing import Any

# Nombre estable con el que se siembra la maqueta heredada. La migración 0017 y la
# siembra en caliente comprueban por este nombre para no duplicarla.
NOMBRE_PLANTILLA_LEGACY = 'Plantilla heredada (LEGACY)'

# Constantes de la maqueta heredada: el PDF antiguo dibujaba la foto, el QR y los
# datos personales con estas medidas sobre una imagen de fondo a sangre.
_LEGACY_ANCHO_MM = 54.0
_LEGACY_ALTO_MM = 85.6
_LEGACY_FUENTE_PT = 7.0
_MM_A_PT = 72.0 / 25.4


def _y_caja_texto_legacy(y_base_mm: float, alto_caja_mm: float = 3.0) -> float:
    """Coordenada superior de una caja cuyo texto queda en la línea base heredada.

    El motor centra una línea con `y_pt + (h_pt - fuente) / 2 + 0.5`; se despeja
    la `y` para que la línea base coincida con la que usaba el renderizador fijo.
    """
    desplazamiento_mm = (
        (alto_caja_mm / 2)
        + (_LEGACY_FUENTE_PT / 2 - 0.5) / _MM_A_PT
    )
    return round(_LEGACY_ALTO_MM - y_base_mm - desplazamiento_mm, 4)


def _elementos_fondo_legacy_vectorial() -> list[dict[str, Any]]:
    """Fondo de respaldo cuando la instalación no conserva la imagen heredada.

    Reproduce los rasgos estables de la maqueta (marco institucional, cintillos y
    pie) sin datos personales. Si la migración encuentra la imagen original, esta
    se incrusta y este respaldo no se usa.
    """
    return [
        {'id': 'legacy-marco', 'tipo': 'rect', 'nombre': 'Marco institucional', 'x': 0, 'y': 0, 'w': 54, 'h': 85.6, 'props': {'fill': '#ffffff', 'stroke': '#0033a0', 'sw': 1.2}},
        {'id': 'legacy-marco-int', 'tipo': 'rect', 'nombre': 'Marco interior', 'x': 1.2, 'y': 1.2, 'w': 51.6, 'h': 83.2, 'props': {'fill': '#ffffff', 'stroke': '#ffd100', 'sw': 0.8}},
        {'id': 'legacy-cinta-roja', 'tipo': 'rect', 'nombre': 'Cinta roja superior', 'x': 0, 'y': 0, 'w': 54, 'h': 2.2, 'props': {'fill': '#d9121f'}},
        {'id': 'legacy-cinta-azul', 'tipo': 'rect', 'nombre': 'Cinta azul superior', 'x': 0, 'y': 2.2, 'w': 54, 'h': 11.8, 'props': {'fill': '#0033a0'}},
        {'id': 'legacy-cinta-amarilla', 'tipo': 'rect', 'nombre': 'Cinta amarilla', 'x': 0, 'y': 14, 'w': 54, 'h': 0.8, 'props': {'fill': '#ffd100'}},
        {'id': 'legacy-logo', 'tipo': 'image', 'nombre': 'Logo institucional', 'x': 4, 'y': 4.2, 'w': 25, 'h': 7, 'props': {'label': 'LOGO', 'asset': 'logo01.png'}},
        {'id': 'legacy-pie', 'tipo': 'rect', 'nombre': 'Pie institucional', 'x': 0, 'y': 78, 'w': 54, 'h': 7.6, 'props': {'fill': '#f3f4f6'}},
        {'id': 'legacy-pie-rojo', 'tipo': 'rect', 'nombre': 'Acento del pie', 'x': 3, 'y': 80, 'w': 1.2, 'h': 3.6, 'props': {'fill': '#d9121f'}},
        {'id': 'legacy-pie-texto', 'tipo': 'text', 'nombre': 'Pie institucional', 'texto': 'GOBIERNO BOLIVARIANO DE VENEZUELA\nMin. del Poder Popular para la Comunicación y la Información', 'x': 6, 'y': 79.5, 'w': 44, 'h': 5.5, 'fontSize': 3.4, 'bold': True, 'color': '#111827'},
    ]


def plantilla_defecto_heredada(imagen_data_url: str | None = None) -> dict[str, Any]:
    """Maqueta heredada (v1 · LEGACY): imagen de fondo y capas variables encima.

    Conserva el comportamiento del PDF fijo anterior: una sola cara, fondo a sangre,
    QR de 12 mm abajo a la izquierda, foto de 20 × 24 mm centrada, nombre y cédula
    debajo. `imagen_data_url` permite incrustar la imagen que tenía `CarnetTemplate`
    sin depender del almacén de medios ni de una ruta local.
    """
    fondo: list[dict[str, Any]] = []
    if imagen_data_url:
        fondo.append({
            'id': 'legacy-fondo',
            'tipo': 'image',
            'nombre': 'Fondo heredado',
            'x': 0,
            'y': 0,
            'w': _LEGACY_ANCHO_MM,
            'h': _LEGACY_ALTO_MM,
            'props': {'data': imagen_data_url, 'preserveAspectRatio': False},
        })
    else:
        fondo.extend(_elementos_fondo_legacy_vectorial())

    anverso = fondo + [
        {'id': 'legacy-foto', 'tipo': 'photo', 'nombre': 'Foto del titular', 'x': 17, 'y': 15.6, 'w': 20, 'h': 24, 'props': {'fill': '#e5e7eb'}},
        {'id': 'legacy-qr', 'tipo': 'qr', 'nombre': 'Código QR seguro', 'x': 4, 'y': 65.6, 'w': 12, 'h': 12, 'props': {'fill': '#111827'}},
        {'id': 'legacy-nombre', 'tipo': 'field', 'campo': 'nombre_completo', 'nombre': 'Nombre completo', 'x': 0.8, 'y': _y_caja_texto_legacy(43.0), 'w': 52.4, 'h': 3, 'fontSize': 7, 'bold': True, 'align': 'center', 'upper': True, 'color': '#000000'},
        {'id': 'legacy-cedula', 'tipo': 'field', 'campo': 'cedula', 'nombre': 'Cédula de identidad', 'x': 0.8, 'y': _y_caja_texto_legacy(38.5), 'w': 52.4, 'h': 3, 'fontSize': 7, 'bold': False, 'align': 'center', 'prefijo': 'C.I: ', 'color': '#000000'},
    ]

    return {
        'origen': 'CarnetTemplate',
        'legacy': True,
        'caras': ['anverso'],
        'orientacion': 'vertical',
        'dimensiones': {'ancho_mm': _LEGACY_ANCHO_MM, 'alto_mm': _LEGACY_ALTO_MM},
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
        'reglas': {
            'criterio': 'legacy',
            'primario': '#0033a0',
            'acento': '#ffd100',
            'texto': '#000000',
            'respaldo': {'primario': '#0033a0', 'acento': '#ffd100', 'texto': '#000000'},
            'valores': {},
        },
        'anverso': anverso,
        'reverso': [],
    }


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
            'primario': '#14284b',   # Azul marino institucional (Alto Nivel / Funcionario)
            'acento': '#c8102e',     # Rojo institucional
            'texto': '#ffffff',
            'respaldo': {
                'primario': '#14284b',
                'acento': '#c8102e',
                'texto': '#ffffff',
            },
            'valores': {
                'FUNCIONARIO': {'primario': '#14284b', 'acento': '#c8102e', 'texto': '#ffffff'},
                'ALTO_NIVEL': {'primario': '#14284b', 'acento': '#c8102e', 'texto': '#ffffff'},
                'EMPLEADO_FIJO': {'primario': '#14284b', 'acento': '#c8102e', 'texto': '#ffffff'},
                'CONTRATADO': {'primario': '#f2b705', 'acento': '#14284b', 'texto': '#14284b'},
                'OBRERO_FIJO': {'primario': '#b3122b', 'acento': '#14284b', 'texto': '#ffffff'},
                'OBRERO_CONTRATADO': {'primario': '#b3122b', 'acento': '#14284b', 'texto': '#ffffff'},
                'HONORARIOS_PROFESIONALES': {'primario': '#2a6f6a', 'acento': '#14284b', 'texto': '#ffffff'},
                'COMISION_SERVICIO': {'primario': '#4b5f8a', 'acento': '#14284b', 'texto': '#ffffff'},
                'PASANTE': {'primario': '#6b7686', 'acento': '#14284b', 'texto': '#ffffff'},
                'JUBILADO': {'primario': '#ffffff', 'acento': '#14284b', 'texto': '#14284b'},
                'PENSIONADO': {'primario': '#ffffff', 'acento': '#14284b', 'texto': '#14284b'},
            },
        },
        'anverso': [
            {'id': 'f-sup', 'tipo': 'rect', 'nombre': 'Franja superior', 'x': 0, 'y': 0, 'w': 54, 'h': 14, 'props': {'fill': p}},
            {'id': 'ac-sup', 'tipo': 'diagr', 'nombre': 'Acento superior', 'x': 40, 'y': 0, 'w': 14, 'h': 8, 'props': {'fill': a}},
            {'id': 'logo-placa', 'tipo': 'rect', 'nombre': 'Placa del logo', 'x': 3, 'y': 3, 'w': 27, 'h': 9, 'props': {'fill': '#ffffff', 'rad': 1}},
            {'id': 'logo', 'tipo': 'image', 'nombre': 'Logo institucional', 'x': 4, 'y': 4, 'w': 25, 'h': 7, 'props': {'label': 'LOGO', 'fill': t, 'asset': 'logo01.png'}},
            {'id': 'divisor', 'tipo': 'rect', 'nombre': 'Divisor de foto', 'x': 20, 'y': 17, 'w': 0.4, 'h': 25, 'props': {'fill': '#d1d5db'}},
            {'id': 'foto', 'tipo': 'photo', 'nombre': 'Foto del titular', 'x': 22, 'y': 18, 'w': 27, 'h': 24, 'props': {'fill': '#e5e7eb', 'radius': 1}},
            {'id': 'nombre', 'tipo': 'field', 'campo': 'nombre_completo', 'nombre': 'Nombre completo', 'x': 5, 'y': 44, 'w': 46, 'h': 6, 'fontSize': 9.5, 'bold': True, 'align': 'left'},
            {'id': 'cedula', 'tipo': 'field', 'campo': 'cedula', 'nombre': 'Cédula de identidad', 'x': 5, 'y': 49.5, 'w': 46, 'h': 4.5, 'fontSize': 8, 'bold': True, 'align': 'left'},
            {'id': 'cargo', 'tipo': 'field', 'campo': 'cargo', 'nombre': 'Cargo', 'x': 5, 'y': 54, 'w': 46, 'h': 4.5, 'fontSize': 8, 'bold': True, 'align': 'left'},
            {'id': 'linea-sep', 'tipo': 'line', 'nombre': 'Línea decorativa', 'x': 5, 'y': 58.5, 'w': 39, 'h': 0.5, 'props': {'fill': a}},
            {'id': 'oficina', 'tipo': 'field', 'campo': 'departamento', 'nombre': 'Oficina de adscripción', 'x': 5, 'y': 59.5, 'w': 35.5, 'h': 4.5, 'fontSize': 5.2, 'bold': True, 'align': 'left', 'color': '#374151'},
            {'id': 'qr', 'tipo': 'qr', 'nombre': 'Código QR seguro', 'x': 41.5, 'y': 60.5, 'w': 9.5, 'h': 9.5, 'props': {'fill': '#111827'}},
            {'id': 'f-inf', 'tipo': 'diag', 'nombre': 'Franja inferior', 'x': 0, 'y': 72, 'w': 36, 'h': 13.6, 'props': {'fill': p}},
            {'id': 'ac-inf', 'tipo': 'diagr', 'nombre': 'Acento inferior', 'x': 28, 'y': 72, 'w': 26, 'h': 13.6, 'props': {'fill': a}},
            {'id': 'ministerio', 'tipo': 'text', 'nombre': 'Ministerio', 'texto': 'MINISTERIO DEL PODER POPULAR PARA LA\nCOMUNICACIÓN E INFORMACIÓN', 'x': 3, 'y': 75, 'w': 27, 'h': 8, 'fontSize': 3.4, 'bold': True, 'color': t},
            {'id': 'firma', 'tipo': 'image', 'nombre': 'Firma de autoridad', 'x': 36, 'y': 74.5, 'w': 15, 'h': 6, 'props': {'label': 'FIRMA', 'fill': t}},
            {'id': 'cargo-firmante', 'tipo': 'text', 'nombre': 'Cargo del firmante', 'texto': 'Director General', 'x': 34, 'y': 81, 'w': 18, 'h': 3, 'fontSize': 4, 'bold': True, 'align': 'center', 'color': t},
        ],
        'reverso': [
            {'id': 'rev-sup', 'tipo': 'rect', 'nombre': 'Franja superior reverso', 'x': 0, 'y': 0, 'w': 54, 'h': 7, 'props': {'fill': p}},
            {'id': 'rev-ac', 'tipo': 'diagr', 'nombre': 'Acento reverso', 'x': 44, 'y': 0, 'w': 10, 'h': 7, 'props': {'fill': a}},
            {'id': 'rev-normas', 'tipo': 'text', 'nombre': 'Normas de uso', 'texto': '•  Este carnet es de uso exclusivo para\n   el personal que labora en Conatel.\n\n•  Debe ser utilizado en un lugar visible.\n\n•  Es intransferible.\n\n•  En caso de extravío o pérdida, debe\n   consignarse en la Oficina de Protección\n   y Seguridad Integral de Conatel.', 'x': 6, 'y': 10, 'w': 42, 'h': 27, 'fontSize': 5.2},
            {'id': 'rev-linea', 'tipo': 'line', 'nombre': 'Línea divisoria', 'x': 9, 'y': 38, 'w': 36, 'h': 0.5, 'props': {'fill': a}},
            {'id': 'rev-punto-1', 'tipo': 'circle', 'nombre': 'Punto inicial', 'x': 8, 'y': 37.4, 'w': 1.2, 'h': 1.2, 'props': {'fill': a}},
            {'id': 'rev-punto-2', 'tipo': 'circle', 'nombre': 'Punto final', 'x': 45, 'y': 37.4, 'w': 1.2, 'h': 1.2, 'props': {'fill': a}},
            {'id': 'rev-box-adsc', 'tipo': 'rect', 'nombre': 'Fondo de adscripción', 'x': 8, 'y': 41, 'w': 38, 'h': 10, 'props': {'fill': '#f1f5f9', 'rad': 1.5}},
            {'id': 'rev-lbl-adsc', 'tipo': 'text', 'nombre': 'Título adscripción', 'texto': 'ADSCRITO A LA UNIDAD DE:', 'x': 9, 'y': 42, 'w': 36, 'h': 3, 'fontSize': 4.6, 'bold': True, 'align': 'center'},
            {'id': 'rev-val-adsc', 'tipo': 'field', 'campo': 'departamento', 'nombre': 'Unidad de adscripción', 'x': 9, 'y': 45, 'w': 36, 'h': 4.5, 'fontSize': 5.2, 'bold': True, 'align': 'center'},
            {'id': 'rev-qr', 'tipo': 'qr', 'nombre': 'QR de verificación', 'x': 19, 'y': 53, 'w': 16, 'h': 16, 'props': {'fill': '#111827'}},
            {'id': 'rev-firma', 'tipo': 'image', 'nombre': 'Firma reverso', 'x': 16, 'y': 72, 'w': 22, 'h': 7, 'props': {'label': 'FIRMA', 'fill': p}},
            {'id': 'rev-linea-firma', 'tipo': 'signline', 'nombre': 'Línea de firma', 'x': 13, 'y': 79.5, 'w': 28, 'h': 0.3, 'props': {'fill': p}},
            {'id': 'rev-cargo-firmante', 'tipo': 'text', 'nombre': 'Cargo autorizante', 'texto': 'Director General', 'x': 7, 'y': 80.5, 'w': 40, 'h': 3, 'fontSize': 5.5, 'bold': True, 'align': 'center', 'color': p},
            {'id': 'rev-entidad', 'tipo': 'text', 'nombre': 'Entidad', 'texto': 'Comisión Nacional de Telecomunicaciones', 'x': 7, 'y': 83.5, 'w': 40, 'h': 2.5, 'fontSize': 4, 'bold': False, 'align': 'center', 'color': '#4b5563'},
        ],
    }


def plantilla_defecto_pasivo() -> dict[str, Any]:
    """Plantilla institucional estándar de pasivos (pensionados/jubilados)."""
    p = '#ffffff'   # Blanco total para jubilados y pensionados
    a = '#14284b'   # Azul marino para acentos y texto
    t = '#14284b'
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
            {'id': 'borde', 'tipo': 'rect', 'nombre': 'Borde de la credencial', 'x': 0, 'y': 0, 'w': 54, 'h': 85.6, 'props': {'fill': p, 'stroke': a, 'sw': 0.4}},
            {'id': 'f-sup', 'tipo': 'rect', 'nombre': 'Franja superior', 'x': 0, 'y': 0, 'w': 54, 'h': 14, 'props': {'fill': p}},
            {'id': 'ac-sup', 'tipo': 'diagr', 'nombre': 'Acento superior', 'x': 40, 'y': 0, 'w': 14, 'h': 8, 'props': {'fill': a}},
            {'id': 'logo', 'tipo': 'image', 'nombre': 'Logo institucional', 'x': 4, 'y': 4, 'w': 25, 'h': 7, 'props': {'label': 'LOGO', 'fill': t, 'asset': 'logo01.png'}},
            {'id': 'tipo-badge', 'tipo': 'text', 'nombre': 'Etiqueta de pasivo', 'texto': 'PERSONAL JUBILADO / PENSIONADO', 'x': 4, 'y': 12, 'w': 46, 'h': 4, 'fontSize': 4.6, 'bold': True, 'color': a, 'align': 'center'},
            {'id': 'divisor', 'tipo': 'rect', 'nombre': 'Divisor de foto', 'x': 20, 'y': 17, 'w': 0.4, 'h': 25, 'props': {'fill': '#d1d5db'}},
            {'id': 'foto', 'tipo': 'photo', 'nombre': 'Foto del titular', 'x': 22, 'y': 18, 'w': 27, 'h': 24, 'props': {'fill': '#e5e7eb', 'radius': 1}},
            {'id': 'nombre', 'tipo': 'field', 'campo': 'nombre_completo', 'nombre': 'Nombre completo', 'x': 5, 'y': 44, 'w': 46, 'h': 6, 'fontSize': 9.5, 'bold': True, 'align': 'left'},
            {'id': 'cedula', 'tipo': 'field', 'campo': 'cedula', 'nombre': 'Cédula de identidad', 'x': 5, 'y': 49.5, 'w': 46, 'h': 4.5, 'fontSize': 8, 'bold': True, 'align': 'left'},
            {'id': 'condicion', 'tipo': 'text', 'nombre': 'Condición', 'texto': 'Jubilado(a) Institucional', 'x': 5, 'y': 54, 'w': 46, 'h': 4.5, 'fontSize': 8, 'bold': True, 'align': 'left', 'color': a},
            {'id': 'linea-sep', 'tipo': 'line', 'nombre': 'Línea decorativa', 'x': 5, 'y': 58.5, 'w': 39, 'h': 0.5, 'props': {'fill': a}},
            {'id': 'oficina', 'tipo': 'field', 'campo': 'departamento', 'nombre': 'Oficina de adscripción', 'x': 5, 'y': 59.5, 'w': 35.5, 'h': 4.5, 'fontSize': 5.2, 'bold': True, 'align': 'left', 'color': '#374151'},
            {'id': 'qr', 'tipo': 'qr', 'nombre': 'Código QR seguro', 'x': 41.5, 'y': 60.5, 'w': 9.5, 'h': 9.5, 'props': {'fill': '#111827'}},
            {'id': 'f-inf', 'tipo': 'diag', 'nombre': 'Franja inferior', 'x': 0, 'y': 72, 'w': 36, 'h': 13.6, 'props': {'fill': p}},
            {'id': 'ac-inf', 'tipo': 'diagr', 'nombre': 'Acento inferior', 'x': 28, 'y': 72, 'w': 26, 'h': 13.6, 'props': {'fill': a}},
            {'id': 'ministerio', 'tipo': 'text', 'nombre': 'Ministerio', 'texto': 'MINISTERIO DEL PODER POPULAR PARA LA\nCOMUNICACIÓN E INFORMACIÓN', 'x': 3, 'y': 75, 'w': 27, 'h': 8, 'fontSize': 3.4, 'bold': True, 'color': a},
            {'id': 'firma', 'tipo': 'image', 'nombre': 'Firma de autoridad', 'x': 36, 'y': 74.5, 'w': 15, 'h': 6, 'props': {'label': 'FIRMA', 'fill': a}},
            {'id': 'cargo-firmante', 'tipo': 'text', 'nombre': 'Cargo del firmante', 'texto': 'Director General', 'x': 34, 'y': 81, 'w': 18, 'h': 3, 'fontSize': 4, 'bold': True, 'align': 'center', 'color': a},
        ],
        'reverso': [
            {'id': 'borde-rev', 'tipo': 'rect', 'nombre': 'Borde reverso', 'x': 0, 'y': 0, 'w': 54, 'h': 85.6, 'props': {'fill': p, 'stroke': a, 'sw': 0.4}},
            {'id': 'rev-sup', 'tipo': 'rect', 'nombre': 'Franja superior reverso', 'x': 0, 'y': 0, 'w': 54, 'h': 7, 'props': {'fill': p}},
            {'id': 'rev-ac', 'tipo': 'diagr', 'nombre': 'Acento reverso', 'x': 44, 'y': 0, 'w': 10, 'h': 7, 'props': {'fill': a}},
            {'id': 'rev-normas', 'tipo': 'text', 'nombre': 'Indicaciones de pasivos', 'texto': '•  Credencial oficial para personal\n   jubilado y pensionado.\n\n•  Identificación para acceso y\n   beneficios asistenciales.\n\n•  Personal e intransferible.\n\n•  En caso de extravío o pérdida,\n   notificar a la Oficina de Gestión Humana.', 'x': 6, 'y': 10, 'w': 42, 'h': 27, 'fontSize': 5.2},
            {'id': 'rev-linea', 'tipo': 'line', 'nombre': 'Línea divisoria', 'x': 9, 'y': 38, 'w': 36, 'h': 0.5, 'props': {'fill': a}},
            {'id': 'rev-punto-1', 'tipo': 'circle', 'nombre': 'Punto inicial', 'x': 8, 'y': 37.4, 'w': 1.2, 'h': 1.2, 'props': {'fill': a}},
            {'id': 'rev-punto-2', 'tipo': 'circle', 'nombre': 'Punto final', 'x': 45, 'y': 37.4, 'w': 1.2, 'h': 1.2, 'props': {'fill': a}},
            {'id': 'rev-box-adsc', 'tipo': 'rect', 'nombre': 'Fondo de adscripción', 'x': 8, 'y': 41, 'w': 38, 'h': 10, 'props': {'fill': '#f1f5f9', 'rad': 1.5}},
            {'id': 'rev-lbl-adsc', 'tipo': 'text', 'nombre': 'Título adscripción', 'texto': 'ADSCRITO A LA UNIDAD DE:', 'x': 9, 'y': 42, 'w': 36, 'h': 3, 'fontSize': 4.6, 'bold': True, 'align': 'center'},
            {'id': 'rev-val-adsc', 'tipo': 'field', 'campo': 'departamento', 'nombre': 'Unidad de adscripción', 'x': 9, 'y': 45, 'w': 36, 'h': 4.5, 'fontSize': 5.2, 'bold': True, 'align': 'center'},
            {'id': 'rev-qr', 'tipo': 'qr', 'nombre': 'QR de verificación', 'x': 19, 'y': 53, 'w': 16, 'h': 16, 'props': {'fill': '#111827'}},
            {'id': 'rev-firma', 'tipo': 'image', 'nombre': 'Firma reverso', 'x': 16, 'y': 72, 'w': 22, 'h': 7, 'props': {'label': 'FIRMA', 'fill': a}},
            {'id': 'rev-linea-firma', 'tipo': 'signline', 'nombre': 'Línea de firma', 'x': 13, 'y': 79.5, 'w': 28, 'h': 0.3, 'props': {'fill': a}},
            {'id': 'rev-cargo-firmante', 'tipo': 'text', 'nombre': 'Cargo autorizante', 'texto': 'Director General', 'x': 7, 'y': 80.5, 'w': 40, 'h': 3, 'fontSize': 5.5, 'bold': True, 'align': 'center', 'color': a},
            {'id': 'rev-entidad', 'tipo': 'text', 'nombre': 'Entidad', 'texto': 'Comisión Nacional de Telecomunicaciones', 'x': 7, 'y': 83.5, 'w': 40, 'h': 2.5, 'fontSize': 4, 'bold': False, 'align': 'center', 'color': '#4b5563'},
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
            {'id': 'ev-logo', 'tipo': 'image', 'nombre': 'Logo institucional', 'x': 8, 'y': 5, 'w': 30, 'h': 10, 'props': {'label': 'LOGO', 'fill': t, 'asset': 'logo01.png'}},
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

