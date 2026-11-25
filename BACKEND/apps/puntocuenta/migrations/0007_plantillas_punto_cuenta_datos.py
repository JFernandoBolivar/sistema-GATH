"""N-2: datos. Convierte la configuración de textos del Punto de Cuenta en plantillas del diseñador.

Por cada proceso de `PROCESOS_POR_DEFECTO` se crea UNA plantilla publicada (versión 1) y activa, con el
mismo contenido que producía el generador anterior: título/numeración, remisión, asunto, exposición,
propuesta, base legal, decisión, observaciones y las mismas firmas. La resolución de textos replica
la del generador retirado (plantilla general + defectos por proceso + plantilla personalizada del
proceso) y queda congelada aquí, a propósito: una migración no debe depender de código que cambie.

Variables: `{nombre}` pasa a `{nombre_completo}` (la del catálogo); el resto conserva su nombre.
Si la configuración ocultaba el nivel (`mostrar_nivel` falso), `{origen}` y `{destino}` pasan a los
campos propios `origen_sin_nivel`/`destino_sin_nivel`. El texto del ingreso por postulación con o sin
constancia presupuestaria se resuelve con el campo propio `frase_reserva`.

Idempotente: no toca un proceso que ya tenga plantilla activa ni un código ya existente. Al retroceder
no se borra nada (las plantillas pueden tener documentos generados).
"""
import hashlib
import json
import re

from django.db import migrations

# ───────────────────────── valores por defecto (congelados del generador retirado) ─────────────────────────

PRESENTADO_A = 'Director(a) General de la Comisión Nacional de Telecomunicaciones'
CARGO_PRESENTADO_A = 'Director(a) General'
PRESENTADO_POR = 'Director(a) General de Gestión Humana'
CARGO_PRESENTADO_POR = 'Director(a) General de Gestión Humana'
UNIDAD = 'Dirección General de Gestión Humana'
ASUNTO = 'Notificación y solicitud de aprobación para movimiento de personal de {nombre} (C.I. {cedula}).'
EXPOSICION = (
    'Por medio del presente punto de cuenta, se somete a su consideración el movimiento de personal del funcionario '
    '{nombre}, titular de la cédula de identidad N.º {cedula}, en el cargo {cargo}.\n\n'
    'Dicho movimiento corresponde a {motivo}, trasladándose desde {origen} hacia {destino}, con fecha {fecha}.'
)
PROPUESTA = (
    'En atención a lo expuesto, se propone muy respetuosamente a la Máxima Autoridad autorizar el traslado y '
    'asignación del funcionario {nombre} a la unidad {destino} en el cargo de {cargo_destino}.'
)
BASE_LEGAL = (
    'De conformidad con lo dispuesto en el Estatuto de la Función Pública, el Reglamento Interno '
    'de la Comisión Nacional de Telecomunicaciones y demás normativa aplicable.'
)
FIRMAS = [{'cargo': 'Director(a) General de Gestión Humana', 'nombre': ''}]

INGRESO_POSTULACION = {
    'asunto': 'Solicitud de aprobación del ingreso de {nombre} (C.I. {cedula}) al cargo de {cargo}.',
    'exposicion': (
        'Por medio del presente punto de cuenta, se somete a su digna consideración el ingreso del ciudadano(a) '
        '{nombre}, titular de la cédula de identidad N.º {cedula}, para desempeñar el cargo de {cargo}, '
        'código {codigo_cargo}, adscrito a {destino}.\n\n'
        'El puesto fue reservado para este ingreso y la disponibilidad presupuestaria quedó declarada con la '
        'referencia {referencia_constancia}. El presente punto de cuenta es emitido por {emitido_por} con fecha {fecha_larga}.'
    ),
    'propuesta': (
        'En atención a lo expuesto, se propone muy respetuosamente a la Máxima Autoridad aprobar el ingreso de '
        '{nombre} en el cargo de {cargo_destino} (código {codigo_cargo}) de la unidad {destino}.'
    ),
}
# Con o sin constancia presupuestaria, el texto por defecto del ingreso se escribe una sola vez.
EXPOSICION_INGRESO_PLANTILLA = (
    'Por medio del presente punto de cuenta, se somete a su digna consideración el ingreso del ciudadano(a) '
    '{nombre}, titular de la cédula de identidad N.º {cedula}, para desempeñar el cargo de {cargo}, '
    'código {codigo_cargo}, adscrito a {destino}.\n\n'
    '{propio.frase_reserva} El presente punto de cuenta es emitido por {emitido_por} con fecha {fecha_larga}.'
)

ETIQUETAS = {
    'ingreso_postulacion': 'ingreso por postulación',
    'cambio_oficina': 'cambio de oficina',
    'cambio_nivel': 'cambio de nivel',
    'cambio_division': 'cambio de división',
    'cambio_cargo_misma_oficina': 'cambio de cargo en la misma oficina',
    'egreso_activo': 'egreso de personal activo',
    'pase_a_pasivo': 'pase a pasivo',
    'encargaduria_prestamo': 'encargaduría o préstamo de cargo',
    'cambio_estatus': 'cambio de estatus',
}
PROCESOS = tuple(ETIQUETAS)

_FLAGS = (
    'incluir_presentado_a', 'incluir_presentado_por', 'incluir_asunto', 'incluir_exposicion', 'incluir_propuesta',
    'incluir_base_legal', 'incluir_decision', 'incluir_observaciones', 'incluir_tabla_resumen', 'incluir_firmas',
)
_TEXTOS = (
    'presentado_a', 'cargo_presentado_a', 'presentado_por', 'cargo_presentado_por', 'unidad', 'asunto',
    'exposicion', 'propuesta', 'base_legal', 'observaciones_texto',
)
LINEA_GUIA = '_' * 84


# ───────────────────────── resolución de textos (réplica del generador anterior) ─────────────────────────

def configuracion_efectiva(fila) -> dict:
    """Lo que devolvía `obtener_configuracion_activa` (sin la parte de variables de ayuda)."""
    if fila is None:
        return {
            'titulo': 'PUNTO DE CUENTA',
            'encabezado': 'Para su conocimiento y fines pertinentes, se notifica el siguiente movimiento de personal:',
            'cuerpo': (
                'Por medio del presente punto de cuenta, se deja constancia del movimiento del funcionario '
                '{nombre}, titular de la cédula de identidad N.º {cedula}, en el cargo {cargo}. '
                'Movimiento desde {origen} hacia {destino}, con fecha {fecha} y motivo {motivo}, '
                'bajo el Punto de Cuenta N.º {numero}.'
            ),
            'presentado_a': PRESENTADO_A, 'cargo_presentado_a': CARGO_PRESENTADO_A, 'presentado_por': PRESENTADO_POR,
            'cargo_presentado_por': CARGO_PRESENTADO_POR, 'unidad': UNIDAD, 'asunto': ASUNTO,
            'exposicion': EXPOSICION, 'propuesta': PROPUESTA, 'base_legal': BASE_LEGAL, 'observaciones_texto': '',
            **{f: f != 'incluir_tabla_resumen' for f in _FLAGS},
            'firmas': list(FIRMAS), 'mostrar_nivel': True, 'plantillas_procesos': {},
        }
    plantillas = dict(getattr(fila, 'plantillas_procesos', None) or {})
    gen = plantillas.get('general') or {}
    cfg = {
        'titulo': fila.titulo or 'PUNTO DE CUENTA',
        'encabezado': fila.encabezado if fila.encabezado is not None else '',
        'cuerpo': fila.cuerpo if fila.cuerpo is not None else '',
        'presentado_a': gen.get('presentado_a', PRESENTADO_A),
        'cargo_presentado_a': gen.get('cargo_presentado_a', CARGO_PRESENTADO_A),
        'presentado_por': gen.get('presentado_por', PRESENTADO_POR),
        'cargo_presentado_por': gen.get('cargo_presentado_por', CARGO_PRESENTADO_POR),
        'unidad': gen.get('unidad', UNIDAD),
        'asunto': gen.get('asunto') if 'asunto' in gen else (fila.encabezado or ASUNTO),
        'exposicion': gen.get('exposicion') if 'exposicion' in gen else (fila.cuerpo or EXPOSICION),
        'propuesta': gen.get('propuesta') if 'propuesta' in gen else PROPUESTA,
        'base_legal': gen.get('base_legal') if 'base_legal' in gen else BASE_LEGAL,
        'observaciones_texto': gen.get('observaciones_texto', ''),
        'firmas': list(fila.firmas) if fila.firmas is not None else list(FIRMAS),
        'mostrar_nivel': bool(fila.mostrar_nivel),
        'plantillas_procesos': plantillas,
    }
    for f in _FLAGS:
        cfg[f] = bool(gen.get(f, f != 'incluir_tabla_resumen'))
    return cfg


def resolver_secciones(config: dict, proceso: str) -> dict:
    plantillas = config.get('plantillas_procesos') or {}
    gen = plantillas.get('general') if isinstance(plantillas.get('general'), dict) else {}
    encabezado_gen = config.get('encabezado') or ''
    cuerpo_gen = config.get('cuerpo') or ''
    base = {
        'presentado_a': config.get('presentado_a') or gen.get('presentado_a') or PRESENTADO_A,
        'cargo_presentado_a': config.get('cargo_presentado_a') or gen.get('cargo_presentado_a') or CARGO_PRESENTADO_A,
        'presentado_por': config.get('presentado_por') or gen.get('presentado_por') or PRESENTADO_POR,
        'cargo_presentado_por': config.get('cargo_presentado_por') or gen.get('cargo_presentado_por') or CARGO_PRESENTADO_POR,
        'unidad': config.get('unidad') or gen.get('unidad') or UNIDAD,
        'asunto': config.get('asunto') or gen.get('asunto') or encabezado_gen or ASUNTO,
        'exposicion': config.get('exposicion') or gen.get('exposicion') or cuerpo_gen or EXPOSICION,
        'propuesta': config.get('propuesta') or gen.get('propuesta') or PROPUESTA,
        'base_legal': config.get('base_legal') or gen.get('base_legal') or BASE_LEGAL,
        'observaciones_texto': config.get('observaciones_texto') or gen.get('observaciones_texto') or '',
    }
    for f in _FLAGS:
        base[f] = config.get(f, gen.get(f, f != 'incluir_tabla_resumen'))
    if proceso == 'ingreso_postulacion':
        base.update(INGRESO_POSTULACION)
    propia = plantillas.get(proceso)
    if isinstance(propia, dict) and propia.get('personalizado'):
        resultado = dict(base)
        for clave, valor in propia.items():
            if clave == 'personalizado':
                continue
            if valor is not None and valor != '' or isinstance(valor, bool):
                resultado[clave] = valor
        if propia.get('encabezado') and not propia.get('asunto'):
            resultado['asunto'] = propia['encabezado']
        if propia.get('cuerpo') and not propia.get('exposicion'):
            resultado['exposicion'] = propia['cuerpo']
        base = resultado
    # Las firmas específicas del proceso se respetan aunque el resto de textos herede la configuración general.
    if isinstance(propia, dict) and isinstance(propia.get('firmas'), list):
        base['firmas'] = propia['firmas']
    return base


# ───────────────────────── construcción de la definición ─────────────────────────

class _Constructor:
    def __init__(self, mostrar_nivel: bool):
        self.mostrar_nivel = mostrar_nivel
        self.bloques: list[dict] = []
        self.propios: dict[str, dict] = {}

    def texto(self, valor: str) -> str:
        """Variables de la configuración antigua → variables del catálogo (o campos propios)."""
        valor = (valor or '').replace('{nombre}', '{nombre_completo}')
        if not self.mostrar_nivel:
            for clave in ('origen', 'destino'):
                if '{' + clave + '}' in valor:
                    valor = valor.replace('{' + clave + '}', '{propio.' + clave + '_sin_nivel}')
                    self.propio(clave + '_sin_nivel', clave.capitalize() + ' sin el nivel',
                                'Ubicación sin el nivel entre paréntesis (la completa el Punto de Cuenta).')
        if '{propio.frase_reserva}' in valor:
            self.propio('frase_reserva', 'Frase de la reserva del puesto',
                        'Dice que el puesto fue reservado y, si hay constancia presupuestaria, su referencia '
                        '(la completa el Punto de Cuenta).')
        return valor

    def propio(self, clave: str, etiqueta: str, ayuda: str) -> None:
        self.propios.setdefault(clave, {'clave': clave, 'etiqueta': etiqueta, 'tipo': 'texto',
                                        'obligatorio': False, 'ayuda': ayuda})

    def _id(self) -> str:
        return f'b{len(self.bloques) + 1}'

    def seccion(self, titulo: str) -> None:
        self.bloques.append({'id': self._id(), 'tipo': 'seccion', 'titulo': titulo})

    def parrafo(self, texto: str, alineacion: str = 'justificado') -> None:
        # El diseñador admite 4000 caracteres por párrafo; se divide sin alterar el texto normalizado.
        while len(texto) > 3500:
            corte = texto.rfind(' ', 0, 3500) or 3500
            self.bloques.append({'id': self._id(), 'tipo': 'parrafo', 'texto': texto[:corte], 'alineacion': alineacion})
            texto = texto[corte:].lstrip()
        self.bloques.append({'id': self._id(), 'tipo': 'parrafo', 'texto': texto, 'alineacion': alineacion})

    def parrafos(self, texto: str, alineacion: str = 'justificado') -> None:
        for bloque in (texto or '').split('\n\n'):
            if bloque.strip():
                self.parrafo(self.texto(bloque.strip()), alineacion)

    def fila(self, celdas: list[tuple[str, str, int]]) -> None:
        self.bloques.append({'id': self._id(), 'tipo': 'fila_campos', 'alto_mm': 10, 'celdas': [
            {'etiqueta': e, 'variable': v, 'ancho': a} for e, v, a in celdas]})


def construir_definicion(secciones: dict, firmas: list, mostrar_nivel: bool) -> tuple[dict, list]:
    c = _Constructor(mostrar_nivel)
    c.parrafo('PUNTO DE CUENTA N.º {numero}', 'izquierda')
    c.parrafo('FECHA: {fecha_larga}', 'derecha')

    if secciones.get('incluir_presentado_a', True):
        linea = 'PRESENTADO A: ' + c.texto(secciones['presentado_a'])
        if (secciones.get('cargo_presentado_a') or '').strip():
            linea += ' — ' + c.texto(secciones['cargo_presentado_a'])
        c.parrafo(linea, 'izquierda')
    if secciones.get('incluir_presentado_por', True):
        linea = 'PRESENTADO POR: ' + c.texto(secciones['presentado_por'])
        if (secciones.get('cargo_presentado_por') or '').strip():
            linea += ' — ' + c.texto(secciones['cargo_presentado_por'])
        c.parrafo(linea, 'izquierda')
        if (secciones.get('unidad') or '').strip():
            c.parrafo('UNIDAD: ' + c.texto(secciones['unidad']), 'izquierda')

    for incluir, titulo, clave in (
        ('incluir_asunto', 'ASUNTO:', 'asunto'),
        ('incluir_exposicion', 'SÍNTESIS / EXPOSICIÓN DE MOTIVOS:', 'exposicion'),
        ('incluir_propuesta', 'PROPUESTA:', 'propuesta'),
        ('incluir_base_legal', 'BASE LEGAL:', 'base_legal'),
    ):
        texto = secciones.get(clave) or ''
        if not secciones.get(incluir, True) or not texto.strip():
            continue
        c.seccion(titulo)
        if clave == 'exposicion' and texto == INGRESO_POSTULACION['exposicion']:
            texto = EXPOSICION_INGRESO_PLANTILLA
        c.parrafos(texto)

    if secciones.get('incluir_tabla_resumen', False):
        for etiqueta, valor in (
            ('Servidor(a) Público(a):', '{nombre_completo} (C.I. {cedula})'),
            ('Cargo / Puesto:', '{cargo}'),
            ('Ubicación de Origen:', '{origen}'),
            ('Ubicación de Destino:', '{destino}'),
            ('Motivo del Movimiento:', '{motivo}'),
        ):
            c.parrafo(f'{etiqueta} {c.texto(valor)}', 'izquierda')

    if secciones.get('incluir_decision', True):
        c.seccion('DECISIÓN DE LA MÁXIMA AUTORIDAD')
        c.parrafo('[  ] APROBADO        [  ] NEGADO        [  ] DIFERIDO        [  ] VISTO', 'centro')

    if secciones.get('incluir_observaciones', True):
        c.seccion('OBSERVACIONES / INSTRUCCIONES:')
        obs = (secciones.get('observaciones_texto') or '').strip()
        c.parrafo(c.texto(obs) if obs else f'{LINEA_GUIA}\n{LINEA_GUIA}', 'justificado' if obs else 'izquierda')

    if secciones.get('incluir_firmas', True):
        firmantes = [{'etiqueta': str(f.get('cargo') or '').strip(),
                      'detalle': str(f.get('nombre') or '').strip()} for f in firmas or [] if isinstance(f, dict)]
        if any(not f['etiqueta'] or len(f['etiqueta']) > 60 or len(f['detalle']) > 70 for f in firmantes):
            # El bloque formal recorta etiquetas largas; los párrafos conservan todo el texto visible.
            for firma in firmantes:
                c.parrafo('____________________________________', 'centro')
                if firma['etiqueta']:
                    c.parrafo(firma['etiqueta'], 'centro')
                if firma['detalle']:
                    c.parrafo(firma['detalle'], 'centro')
        else:
            for i in range(0, len(firmantes), 4):
                c.bloques.append({'id': c._id(), 'tipo': 'firmas', 'firmantes': firmantes[i:i + 4]})

    definicion = {
        'pagina': {'tamano': 'carta', 'orientacion': 'vertical'},
        # Sin título propio: el cintillo institucional ya identifica el documento y la numeración abre el cuerpo.
        'encabezado': {'tipo': 'institucional', 'titulo': '', 'subtitulo': ''},
        'bloques': c.bloques,
    }
    return definicion, list(c.propios.values())


def _huella(modo, definicion, propios, fondo_sha256, nombre, proceso, firmante, requiere_firma_clic) -> str:
    contenido = {
        'modo': modo, 'definicion': definicion, 'campos_propios': propios, 'fondo_sha256': fondo_sha256,
        'metadatos': {'nombre': nombre, 'proceso': proceso, 'firmante': firmante,
                      'requiere_firma_clic': requiere_firma_clic},
    }
    return hashlib.sha256(json.dumps(contenido, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def codigo_plantilla(proceso: str) -> str:
    return 'PUNTO_CUENTA_' + re.sub(r'[^A-Z0-9]+', '_', proceso.upper())


def crear_plantillas(apps, schema_editor):
    Config = apps.get_model('puntocuenta', 'ConfiguracionPuntoCuentaModel')
    crear_plantillas_de(apps, configuracion_efectiva(Config.objects.order_by('-version').first()))


def crear_plantillas_de(apps, config: dict) -> None:
    """Crea (si faltan) las plantillas publicadas y activas de los procesos a partir de una configuración resuelta."""
    Plantilla = apps.get_model('documentos', 'PlantillaDocumentoModel')
    Version = apps.get_model('documentos', 'VersionPlantillaDocumentoModel')
    for proceso in PROCESOS:
        codigo_proceso = f'punto_cuenta:{proceso}'
        codigo = codigo_plantilla(proceso)
        if Plantilla.objects.filter(proceso=codigo_proceso, activa=True, ultima_version__gt=0).exists():
            continue
        plantilla = Plantilla.objects.filter(codigo=codigo).first()
        if plantilla is not None and plantilla.ultima_version:
            # No se pisa una publicación existente; solo se garantiza una activa para el proceso.
            plantilla.activa = True
            plantilla.save(update_fields=['activa', 'updated_at'])
            continue
        secciones = resolver_secciones(config, proceso)
        definicion, propios = construir_definicion(secciones, secciones.get('firmas', config['firmas']),
                                                   config['mostrar_nivel'])
        nombre = (config.get('titulo') or f'Punto de Cuenta: {ETIQUETAS[proceso]}')[:160]
        descripcion = f'Punto de Cuenta de {ETIQUETAS[proceso]} (convertido de la configuración de textos anterior).'
        if plantilla is None:
            plantilla = Plantilla.objects.create(
                codigo=codigo, nombre=nombre, descripcion=descripcion, modo='formulario', proceso=codigo_proceso,
                firmante='conatel', requiere_firma_clic=False, activa=False, ultima_version=0,
                definicion=definicion, campos_propios=propios,
            )
        else:
            plantilla.nombre = nombre
            plantilla.descripcion = descripcion
            plantilla.modo = 'formulario'
            plantilla.proceso = codigo_proceso
            plantilla.firmante = 'conatel'
            plantilla.requiere_firma_clic = False
            plantilla.definicion = definicion
            plantilla.campos_propios = propios
            plantilla.save()
        Version.objects.get_or_create(
            plantilla=plantilla, numero=1,
            defaults={
                'modo': 'formulario', 'definicion': definicion, 'campos_propios': propios,
                'fondo_clave': '', 'fondo_sha256': '', 'fondo_paginas': [],
                'metadatos': {'codigo': codigo, 'nombre': nombre, 'proceso': codigo_proceso, 'firmante': 'conatel',
                              'requiere_firma_clic': False, 'titulo_configurado': config.get('titulo', ''),
                              'encabezado_configurado': config.get('encabezado', ''),
                              'cuerpo_configurado': config.get('cuerpo', '')},
                'definicion_sha256': _huella(
                    'formulario', definicion, propios, '', nombre, codigo_proceso, 'conatel', False,
                ),
            },
        )
        plantilla.ultima_version = 1
        plantilla.activa = True
        plantilla.save(update_fields=['ultima_version', 'activa', 'updated_at'])


class Migration(migrations.Migration):
    dependencies = [  # noqa: RUF012
        ('puntocuenta', '0006_punto_cuenta_proceso_documento'),
        ('documentos', '0003_catalogo_procesos'),
    ]

    operations = [  # noqa: RUF012
        migrations.RunPython(crear_plantillas, migrations.RunPython.noop),
    ]
