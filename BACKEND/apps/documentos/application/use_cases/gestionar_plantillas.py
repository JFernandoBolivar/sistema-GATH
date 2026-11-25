"""Casos de uso de las plantillas de documentos: ciclo borrador → publicada, versionado, fondo y vista previa (F-1, F-2)."""
import copy
import hashlib
import json
import uuid

from apps.documentos.domain.entities.documentos import Plantilla, VersionPlantilla
from apps.documentos.domain.services.catalogo_procesos import validar_proceso
from apps.documentos.domain.services.variables_documento import datos_ejemplo
from apps.documentos.domain.value_objects.esquema_documento import (
    definicion_vacia,
    validar_definicion,
    validar_metadatos,
)
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

MAX_BYTES_FONDO = 15 * 1024 * 1024
MAX_BYTES_LOGO = 2 * 1024 * 1024
_FIRMA_PDF = b'%PDF-'
_FIRMAS_LOGO = {b'\x89PNG\r\n\x1a\n': 'png', b'\xff\xd8\xff': 'jpg'}


def huella_borrador(plantilla: Plantilla | dict) -> str:
    """sha256 del contenido versionable (definición, campos propios, fondo y metadatos) de un borrador."""
    g = (lambda k: plantilla[k]) if isinstance(plantilla, dict) else (lambda k: getattr(plantilla, k))
    contenido = {
        'modo': g('modo'), 'definicion': g('definicion'), 'campos_propios': g('campos_propios'),
        'fondo_sha256': g('fondo_sha256'),
        'metadatos': {'nombre': g('nombre'), 'proceso': g('proceso'), 'firmante': g('firmante'),
                      'requiere_firma_clic': g('requiere_firma_clic')},
    }
    return hashlib.sha256(json.dumps(contenido, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _obtener(repo, plantilla_id: str) -> Plantilla:
    plantilla = repo.obtener(plantilla_id)
    if plantilla is None:
        raise NotFoundError('La plantilla no existe.')
    return plantilla


def listar_plantillas(repo) -> list[Plantilla]:
    return repo.listar()


def obtener_plantilla(repo, plantilla_id: str) -> Plantilla:
    return _obtener(repo, plantilla_id)


def crear_plantilla(repo, datos: dict, actor_id: int | None) -> Plantilla:
    modo = datos.get('modo')
    meta = validar_metadatos(datos.get('codigo'), datos.get('nombre'), datos.get('proceso'),
                             datos.get('firmante'), datos.get('requiere_firma_clic', False))
    if repo.obtener_por_codigo(meta['codigo']):
        raise ConflictError(f"Ya existe una plantilla con el código «{meta['codigo']}».", campo='codigo')
    definicion, propios = validar_definicion(modo, datos.get('definicion') or definicion_vacia(modo or ''),
                                             datos.get('campos_propios'), None, meta['proceso'])
    return repo.crear({**meta, 'descripcion': (datos.get('descripcion') or '').strip()[:400], 'modo': modo,
                       'definicion': definicion, 'campos_propios': propios, 'actor_id': actor_id})


def _paginas_fondo_para_validar(plantilla: Plantilla) -> list[dict]:
    return plantilla.fondo_paginas or []


def actualizar_borrador(repo, plantilla_id: str, datos: dict, actor_id: int | None) -> Plantilla:
    plantilla = _obtener(repo, plantilla_id)
    meta = validar_metadatos(datos.get('codigo', plantilla.codigo), datos.get('nombre', plantilla.nombre),
                             datos.get('proceso', plantilla.proceso), datos.get('firmante', plantilla.firmante),
                             datos.get('requiere_firma_clic', plantilla.requiere_firma_clic))
    if plantilla.ultima_version > 0:
        if meta['codigo'] != plantilla.codigo:
            raise ValidationError('El código no se puede cambiar una vez publicada la plantilla.', campo='codigo')
        if meta['proceso'] != plantilla.proceso:
            raise ValidationError('El proceso no se puede cambiar una vez publicada la plantilla.', campo='proceso')
    elif meta['codigo'] != plantilla.codigo and repo.obtener_por_codigo(meta['codigo']):
        raise ConflictError(f"Ya existe una plantilla con el código «{meta['codigo']}».", campo='codigo')
    definicion, propios = validar_definicion(
        plantilla.modo, datos.get('definicion', plantilla.definicion),
        datos.get('campos_propios', plantilla.campos_propios), _paginas_fondo_para_validar(plantilla), meta['proceso'])
    return repo.actualizar_borrador(plantilla_id, {
        **meta, 'descripcion': (datos.get('descripcion', plantilla.descripcion) or '').strip()[:400],
        'definicion': definicion, 'campos_propios': propios, 'actor_id': actor_id,
    })


def publicar(repo, plantilla_id: str, actor_id: int | None) -> VersionPlantilla:
    plantilla = _obtener(repo, plantilla_id)
    definicion, propios = validar_definicion(plantilla.modo, plantilla.definicion, plantilla.campos_propios,
                                             _paginas_fondo_para_validar(plantilla), plantilla.proceso)
    if plantilla.modo == 'formulario' and not definicion['bloques']:
        raise ValidationError('Agregue al menos un bloque antes de publicar.', campo='definicion.bloques')
    if plantilla.modo == 'pdf_overlay':
        if not plantilla.fondo_clave:
            raise ValidationError('Suba el PDF de fondo antes de publicar.', campo='fondo')
        if not definicion['paginas']:
            raise ValidationError('Elija al menos una página del PDF antes de publicar.', campo='definicion.paginas')
    ultima = repo.ultima_version(plantilla_id)
    if ultima and ultima.definicion_sha256 == huella_borrador(plantilla):
        raise ConflictError('No hay cambios por publicar: el borrador es igual a la última versión.')
    return repo.publicar(plantilla_id, actor_id)


def duplicar(repo, plantilla_id: str, actor_id: int | None) -> Plantilla:
    origen = _obtener(repo, plantilla_id)
    base = f'{origen.codigo}_COPIA'[:55]
    codigo, n = base, 1
    while repo.obtener_por_codigo(codigo):
        n += 1
        codigo = f'{base}{n}'
    return repo.crear({
        'codigo': codigo, 'nombre': f'Copia de {origen.nombre}'[:160], 'descripcion': origen.descripcion,
        'modo': origen.modo, 'proceso': origen.proceso, 'firmante': origen.firmante,
        'requiere_firma_clic': origen.requiere_firma_clic,
        'definicion': copy.deepcopy(origen.definicion), 'campos_propios': copy.deepcopy(origen.campos_propios),
        'fondo_clave': origen.fondo_clave, 'fondo_sha256': origen.fondo_sha256,
        'fondo_nombre': origen.fondo_nombre, 'fondo_paginas': copy.deepcopy(origen.fondo_paginas),
        'actor_id': actor_id,
    })


def fijar_activa(repo, plantilla_id: str, activa: bool) -> Plantilla:
    plantilla = _obtener(repo, plantilla_id)
    if activa and plantilla.ultima_version < 1:
        raise ConflictError('Publique la plantilla antes de activarla.')
    return repo.fijar_activa(plantilla_id, activa)


def listar_versiones(repo, plantilla_id: str) -> list[VersionPlantilla]:
    _obtener(repo, plantilla_id)
    return repo.versiones(plantilla_id)


def subir_fondo(repo, almacen, inspector, plantilla_id: str, contenido: bytes, nombre: str, actor_id: int | None) -> Plantilla:
    """Guarda el PDF oficial de fondo (formato de terceros): firma real, máx. 15 MB, clave opaca."""
    plantilla = _obtener(repo, plantilla_id)
    if plantilla.modo != 'pdf_overlay':
        raise ValidationError('Solo las plantillas de formato de terceros llevan PDF de fondo.')
    if not contenido or len(contenido) > MAX_BYTES_FONDO:
        raise ValidationError(f'El PDF debe pesar hasta {MAX_BYTES_FONDO // (1024 * 1024)} MB.', campo='archivo')
    if not contenido.startswith(_FIRMA_PDF):
        raise ValidationError('El contenido del archivo no corresponde a un PDF.', campo='archivo')
    paginas = inspector.inspeccionar(contenido)
    clave = almacen.subir(f'documentos/fondos/{uuid.uuid4().hex}.pdf', contenido, 'application/pdf')
    # Las páginas elegidas que ya no existen en el PDF nuevo se descartan.
    definicion = copy.deepcopy(plantilla.definicion)
    definicion['paginas'] = [p for p in definicion.get('paginas', []) if p['origen'] <= len(paginas)]
    return repo.actualizar_borrador(plantilla_id, {
        'fondo_clave': clave, 'fondo_sha256': hashlib.sha256(contenido).hexdigest(),
        'fondo_nombre': (nombre or 'fondo.pdf')[:200], 'fondo_paginas': paginas,
        'definicion': definicion, 'actor_id': actor_id,
    })


def subir_logo(repo, almacen, plantilla_id: str, contenido: bytes, actor_id: int | None) -> Plantilla:
    plantilla = _obtener(repo, plantilla_id)
    if plantilla.modo != 'formulario':
        raise ValidationError('Solo las plantillas de formulario propio llevan logo.')
    if not contenido or len(contenido) > MAX_BYTES_LOGO:
        raise ValidationError(f'El logo debe pesar hasta {MAX_BYTES_LOGO // (1024 * 1024)} MB.', campo='archivo')
    ext = next((e for firma, e in _FIRMAS_LOGO.items() if contenido.startswith(firma)), None)
    if ext is None:
        raise ValidationError('El logo debe ser una imagen PNG o JPEG.', campo='archivo')
    clave = almacen.subir(f'documentos/logos/{uuid.uuid4().hex}.{ext}', contenido, 'image/png' if ext == 'png' else 'image/jpeg')
    definicion = copy.deepcopy(plantilla.definicion)
    definicion.setdefault('encabezado', {}).update({'tipo': 'logo_propio', 'logo_clave': clave})
    return repo.actualizar_borrador(plantilla_id, {'definicion': definicion, 'actor_id': actor_id})


def contexto_de_render(almacen, modo: str, definicion: dict, campos_propios: list, fondo_clave: str, fondo_paginas: list) -> dict:
    """Arma lo que el motor de PDF necesita (bytes del fondo y del logo ya descargados)."""
    logo = None
    clave_logo = (definicion.get('encabezado') or {}).get('logo_clave') if modo == 'formulario' else ''
    if clave_logo:
        logo = almacen.descargar(clave_logo)
    fondo_pdf = almacen.descargar(fondo_clave) if modo == 'pdf_overlay' and fondo_clave else None
    return {'modo': modo, 'definicion': definicion, 'campos_propios': campos_propios,
            'fondo_pdf': fondo_pdf, 'fondo_paginas': fondo_paginas, 'logo': logo}


def vista_previa(repo, almacen, motor, plantilla_id: str, cambios: dict | None = None) -> bytes:
    """PDF de muestra con datos ficticios; permite previsualizar definición, campos y proceso sin guardar."""
    plantilla = _obtener(repo, plantilla_id)
    cambios = cambios or {}
    proceso = validar_proceso(cambios.get('proceso'), defecto=plantilla.proceso)
    if plantilla.ultima_version > 0 and proceso != plantilla.proceso:
        raise ValidationError('El proceso no se puede cambiar una vez publicada la plantilla.', campo='proceso')
    definicion, propios = validar_definicion(
        plantilla.modo, cambios.get('definicion', plantilla.definicion),
        cambios.get('campos_propios', plantilla.campos_propios), _paginas_fondo_para_validar(plantilla), proceso)
    contexto = contexto_de_render(almacen, plantilla.modo, definicion, propios, plantilla.fondo_clave, plantilla.fondo_paginas)
    contexto['vista_previa'] = True
    return motor.renderizar(contexto, datos_ejemplo(propios, proceso))


def pagina_de_fondo(repo, almacen, motor, plantilla_id: str, numero: int) -> bytes:
    plantilla = _obtener(repo, plantilla_id)
    if not plantilla.fondo_clave:
        raise NotFoundError('La plantilla no tiene PDF de fondo.')
    if not any(p['numero'] == numero for p in plantilla.fondo_paginas):
        raise NotFoundError('La página no existe en el PDF de fondo.')
    return motor.renderizar_pagina_fondo(almacen.descargar(plantilla.fondo_clave), numero)


