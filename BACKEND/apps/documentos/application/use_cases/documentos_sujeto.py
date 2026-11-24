"""
Documentos de un sujeto (el expediente del postulante): estado, campos propios, vista previa, firma por clic y
contratación (F-4, F-5, F-6). Sin Django.

El sujeto se identifica por `(sujeto_tipo, sujeto_id)`, sin FK a otra app. Los datos conocidos los entrega el
`ProveedorDatosDocumento` (la implementación real vive en `postulacion.infrastructure`).

Estado de un documento para el sujeto (`estado`):
  * `pendiente_datos`    — faltan campos propios obligatorios.
  * `listo_para_revisar` — datos completos; falta la firma (si la requiere el postulante) o no requiere firma.
  * `firmado`            — hay una firma por clic cuya huella de datos coincide con los datos de HOY.
  * `generado`           — documento de «contratación» ya generado al contratar.

La firma NO se guarda como un estado: se compara la huella (sha256) de los datos firmados contra la de los datos de hoy.
Si el postulante cambia un campo propio, un dato de su Ventana 2 o la plantilla se publica de nuevo, la huella cambia y la
firma deja de valer sola (`firma_invalidada`); hay que firmar otra vez, lo que genera un documento nuevo con otro sha256.
"""
from datetime import date

from apps.documentos.application.use_cases.firmar_documento import firmar_documento
from apps.documentos.application.use_cases.generar_documento import (
    TEXTO_CONFORMIDAD,
    generar_documento,
    valores_propios_para_render,
)
from apps.documentos.application.use_cases.gestionar_plantillas import contexto_de_render
from apps.documentos.domain.services.variables_documento import datos_de_hoy, enmascarar_ip, huella_datos
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

SUJETO_EXPEDIENTE = 'expediente_postulacion'
FIRMANTE_POSTULANTE = 'postulante'

PENDIENTE_DATOS = 'pendiente_datos'
LISTO_PARA_REVISAR = 'listo_para_revisar'
FIRMADO = 'firmado'
GENERADO = 'generado'


def _vacio(valor) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


def firma_del_postulante_requerida(version) -> bool:
    meta = version.metadatos
    return bool(meta.get('requiere_firma_clic')) and meta.get('firmante') in ('postulante', 'ambos')


def _aplicables(repo_plantillas, momento: str) -> list:
    """`[(plantilla, ultima_version)]` de las plantillas ACTIVAS y publicadas con ese momento."""
    salida = []
    for p in repo_plantillas.listar():
        if p.activa and p.ultima_version and p.momento == momento:
            version = repo_plantillas.ultima_version(p.id)
            if version is not None:
                salida.append((p, version))
    return salida


def _plantilla_por_codigo(repo_plantillas, codigo: str, momento: str):
    p = repo_plantillas.obtener_por_codigo(codigo)
    if p is None or not p.activa or not p.ultima_version or p.momento != momento:
        raise NotFoundError('El documento no existe o no aplica en esta etapa.')
    return p, repo_plantillas.ultima_version(p.id)


def _firma_de(repo_documentos, documento) -> object | None:
    return next((f for f in repo_documentos.firmas_de(documento.id) if f.firmante_tipo == FIRMANTE_POSTULANTE), None)


def _dict_firma(firma, documento) -> dict:
    return {
        'firmado_en': firma.firmado_en.isoformat(), 'ip_enmascarada': enmascarar_ip(firma.ip),
        'sha256': firma.sha256_firmado, 'texto_conformidad': firma.texto_conformidad,
        'documento_id': documento.id, 'version': documento.version_numero,
    }


def _item(plantilla, version, base: dict, valores: dict, generados: list, repo_documentos) -> dict:
    """Estado de UN documento. `base` son los datos del proveedor (sin foto) y `generados` los del sujeto, del más nuevo al más viejo."""
    campos = version.campos_propios
    valores = valores or {}
    faltan = [c['etiqueta'] for c in campos if c.get('obligatorio') and _vacio(valores.get(c['clave']))]
    try:
        propios = valores_propios_para_render(campos, valores, estricto=False)
    except ValidationError as e:   # un valor guardado que la versión nueva ya no admite (p. ej. una opción retirada)
        propios = {}
        faltan.append(str(e))
    huella = huella_datos({**base, **propios}, version.id)
    requiere = firma_del_postulante_requerida(version)

    firmado = None
    invalida = False
    if requiere:
        for d in (g for g in generados if g.plantilla_id == plantilla.id):
            firma = _firma_de(repo_documentos, d)
            if firma is None:
                continue
            if d.huella_datos == huella:
                firmado = (d, firma)
                break
            invalida = True
    if firmado:
        estado = FIRMADO
    elif faltan:
        estado = PENDIENTE_DATOS
    else:
        estado = LISTO_PARA_REVISAR
    return {
        'plantilla_id': plantilla.id, 'codigo': plantilla.codigo, 'nombre': plantilla.nombre,
        'descripcion': plantilla.descripcion, 'momento': plantilla.momento, 'version': version.numero,
        'firmante': plantilla.firmante, 'requiere_firma': requiere,
        'campos_propios': campos, 'valores': {c['clave']: valores.get(c['clave'], '') for c in campos},
        'faltan': faltan, 'estado': estado, 'firma_invalidada': bool(invalida and not firmado),
        'documento_id': firmado[0].id if firmado else None,
        'firma': _dict_firma(firmado[1], firmado[0]) if firmado else None,
        'texto_conformidad': TEXTO_CONFORMIDAD.format(nombre=plantilla.nombre, version=version.numero) if requiere else '',
    }


def _item_generado(plantilla, version, documento) -> dict:
    return {
        'plantilla_id': plantilla.id, 'codigo': plantilla.codigo, 'nombre': plantilla.nombre,
        'descripcion': plantilla.descripcion, 'momento': plantilla.momento, 'version': documento.version_numero,
        'firmante': plantilla.firmante, 'requiere_firma': False, 'campos_propios': [], 'valores': {}, 'faltan': [],
        'estado': GENERADO, 'firma_invalidada': False, 'documento_id': documento.id, 'firma': None,
        'texto_conformidad': '', 'trabajador_cedula': documento.trabajador_cedula,
        'generado_en': documento.generado_en.isoformat() if documento.generado_en else None,
    }


def listar_documentos(
    repo_plantillas, repo_documentos, proveedor, *, sujeto_tipo: str, sujeto_id: str, momentos=('ventana2',),
) -> list[dict]:
    """
    Los documentos que aplican al sujeto con su estado. Los de momento `ventana2` salen siempre (plantillas activas y
    publicadas); los de `contratacion` solo cuando ya se generaron al contratar.
    """
    generados = repo_documentos.listar_generados(sujeto_tipo, str(sujeto_id))
    valores = repo_documentos.valores_de(sujeto_tipo, str(sujeto_id))
    base = None
    salida: list[dict] = []
    for momento in momentos:
        for plantilla, version in _aplicables(repo_plantillas, momento):
            if momento == 'contratacion':
                doc = next((g for g in generados if g.plantilla_id == plantilla.id and g.trabajador_cedula), None)
                if doc is not None:
                    salida.append(_item_generado(plantilla, version, doc))
                continue
            if base is None:
                base = proveedor.datos_de(sujeto_tipo, str(sujeto_id), con_foto=False) or {}
            salida.append(_item(plantilla, version, base, valores.get(plantilla.id), generados, repo_documentos))
    return salida


def _un_documento(repo_plantillas, repo_documentos, proveedor, *, sujeto_tipo, sujeto_id, codigo, momento) -> dict:
    plantilla, version = _plantilla_por_codigo(repo_plantillas, codigo, momento)
    base = proveedor.datos_de(sujeto_tipo, str(sujeto_id), con_foto=False) or {}
    return _item(
        plantilla, version, base, repo_documentos.valores_de(sujeto_tipo, str(sujeto_id)).get(plantilla.id),
        repo_documentos.listar_generados(sujeto_tipo, str(sujeto_id)), repo_documentos,
    )


def obtener_documento(repo_plantillas, repo_documentos, proveedor, *, sujeto_tipo, sujeto_id, codigo, momento='ventana2') -> dict:
    return _un_documento(repo_plantillas, repo_documentos, proveedor, sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id,
                         codigo=codigo, momento=momento)


def guardar_campos_propios(
    repo_plantillas, repo_documentos, proveedor, *, sujeto_tipo: str, sujeto_id: str, codigo: str, valores: dict,
    momento: str = 'ventana2',
) -> dict:
    """
    Guarda los campos propios del documento (REEMPLAZA los anteriores). Valida el tipo de cada valor; los obligatorios
    pueden quedar vacíos mientras se llena (se exigen al firmar y al enviar). Devuelve el estado nuevo con
    `firma_invalidada` en verdadero si el documento estaba firmado y este cambio deshizo la firma.
    """
    if not isinstance(valores, dict):
        raise ValidationError('Los valores deben ser un objeto {clave: valor}.', campo='valores')
    plantilla, version = _plantilla_por_codigo(repo_plantillas, codigo, momento)
    conocidas = {c['clave'] for c in version.campos_propios}
    desconocidas = sorted(set(valores) - conocidas)
    if desconocidas:
        raise ValidationError(f"Campos que el documento no tiene: {', '.join(desconocidas)}.", campo='valores')
    valores_propios_para_render(version.campos_propios, valores, estricto=False)   # solo valida los tipos
    antes = _un_documento(repo_plantillas, repo_documentos, proveedor, sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id,
                          codigo=codigo, momento=momento)
    limpio = {}
    for c in version.campos_propios:
        v = valores.get(c['clave'])
        if _vacio(v):
            continue
        limpio[c['clave']] = valores_propios_para_render([c], {c['clave']: v}, estricto=False)['propio.' + c['clave']]
    repo_documentos.guardar_valores(sujeto_tipo, str(sujeto_id), plantilla.id, limpio)
    despues = _un_documento(repo_plantillas, repo_documentos, proveedor, sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id,
                            codigo=codigo, momento=momento)
    despues['firma_invalidada'] = antes['estado'] == FIRMADO and despues['estado'] != FIRMADO
    return despues


def vista_previa(
    repo_plantillas, repo_documentos, proveedor, motor, almacen, *, sujeto_tipo: str, sujeto_id: str, codigo: str,
    momento: str = 'ventana2', hoy: date | None = None,
) -> bytes:
    """PDF con los datos REALES del sujeto y lo que lleva llenado (los obligatorios vacíos salen en blanco). No se guarda."""
    plantilla, version = _plantilla_por_codigo(repo_plantillas, codigo, momento)
    valores = repo_documentos.valores_de(sujeto_tipo, str(sujeto_id)).get(plantilla.id)
    datos = {**datos_de_hoy(hoy), **(proveedor.datos_de(sujeto_tipo, str(sujeto_id)) or {})}
    datos.update(valores_propios_para_render(version.campos_propios, valores, estricto=False))
    contexto = contexto_de_render(almacen, version.modo, version.definicion, version.campos_propios,
                                  version.fondo_clave, version.fondo_paginas)
    return motor.renderizar(contexto, datos)


def firmar_por_clic(
    repo_plantillas, repo_documentos, proveedor, motor, almacen, *, sujeto_tipo: str, sujeto_id: str, codigo: str,
    firmante_id: str, ip: str, user_agent: str, acepta: bool, actor_id: int | None = None, momento: str = 'ventana2',
    hoy: date | None = None,
) -> dict:
    """
    Firma por clic de conformidad (C-5): genera el documento FINAL (snapshot + sha256) con los datos de hoy y registra la
    firma con IP, user-agent, fecha, huella y el texto de conformidad. Si ya hay una firma vigente, 409.
    """
    if not acepta:
        raise ValidationError('Marque la casilla de conformidad para firmar.', campo='acepto')
    plantilla, version = _plantilla_por_codigo(repo_plantillas, codigo, momento)
    if not firma_del_postulante_requerida(version):
        raise ConflictError('Este documento no requiere su firma.')
    actual = _un_documento(repo_plantillas, repo_documentos, proveedor, sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id,
                           codigo=codigo, momento=momento)
    if actual['estado'] == FIRMADO:
        raise ConflictError('Ya firmó este documento. Si cambia algún dato deberá firmarlo de nuevo.')
    if actual['faltan']:
        raise ConflictError(f"Complete los campos obligatorios antes de firmar: {'; '.join(actual['faltan'])}.")
    valores = repo_documentos.valores_de(sujeto_tipo, str(sujeto_id)).get(plantilla.id)
    documento = generar_documento(
        repo_plantillas, repo_documentos, proveedor, motor, almacen, plantilla_id=plantilla.id, sujeto_tipo=sujeto_tipo,
        sujeto_id=str(sujeto_id), actor_id=actor_id, valores_propios=valores, hoy=hoy,
    )
    firmar_documento(
        repo_plantillas, repo_documentos, almacen, documento_id=documento.id, firmante_tipo=FIRMANTE_POSTULANTE,
        firmante_id=str(firmante_id), ip=ip, user_agent=user_agent, acepta=True,
    )
    return _un_documento(repo_plantillas, repo_documentos, proveedor, sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id,
                         codigo=codigo, momento=momento)


def clave_pdf_firmado(
    repo_plantillas, repo_documentos, proveedor, *, sujeto_tipo: str, sujeto_id: str, codigo: str, momento: str = 'ventana2',
) -> tuple[str, str] | None:
    """
    `(clave en el almacén, id del documento)` del PDF a servir: el firmado vigente (Ventana 2) o el ya generado al contratar
    (momento «contratación»). None si no hay (nunca se firmó, o la firma ya no vale porque cambiaron los datos).
    """
    plantilla = repo_plantillas.obtener_por_codigo(codigo)
    if plantilla is not None and plantilla.momento == 'contratacion':
        doc = next((g for g in repo_documentos.listar_generados(sujeto_tipo, str(sujeto_id))
                    if g.plantilla_id == plantilla.id and g.trabajador_cedula), None)
        return (doc.pdf_clave, doc.id) if doc else None
    item = _un_documento(repo_plantillas, repo_documentos, proveedor, sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id,
                         codigo=codigo, momento=momento)
    if item['estado'] != FIRMADO:
        return None
    doc = repo_documentos.obtener_generado(item['documento_id'])
    return (doc.pdf_clave, doc.id) if doc else None


def faltantes_de_documentos(repo_plantillas, repo_documentos, proveedor, *, sujeto_tipo: str, sujeto_id: str) -> list[dict]:
    """Lo que de los documentos de la Ventana 2 impide enviar: `[{seccion: 'documentos', campo, mensaje}]`."""
    faltantes = []
    for it in listar_documentos(repo_plantillas, repo_documentos, proveedor, sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id):
        if it['faltan']:
            mensaje = f"Complete los datos del documento «{it['nombre']}»: {'; '.join(it['faltan'])}."
        elif it['requiere_firma'] and it['estado'] != FIRMADO:
            mensaje = (
                f"Su firma del documento «{it['nombre']}» quedó sin efecto porque cambiaron datos: fírmelo de nuevo."
                if it['firma_invalidada'] else f"Firme el documento «{it['nombre']}»."
            )
        else:
            continue
        faltantes.append({'seccion': 'documentos', 'campo': f"documentos.{it['codigo']}", 'mensaje': mensaje})
    return faltantes


def generar_de_contratacion(
    repo_plantillas, repo_documentos, proveedor, motor, almacen, *, sujeto_tipo: str, sujeto_id: str,
    trabajador_cedula: str, actor_id: int | None, hoy: date | None = None,
) -> int:
    """
    Genera los documentos de momento «contratación» para el trabajador recién contratado (sin firma: queda pendiente). Los
    campos propios obligatorios que nadie llenó salen en blanco. Cualquier error se propaga para que la promoción haga rollback.
    Es idempotente: no repite un documento ya generado para esa plantilla.
    """
    ya = {g.plantilla_id for g in repo_documentos.listar_generados(sujeto_tipo, str(sujeto_id)) if g.trabajador_cedula}
    valores = repo_documentos.valores_de(sujeto_tipo, str(sujeto_id))
    creados = 0
    for plantilla, _version in _aplicables(repo_plantillas, 'contratacion'):
        if plantilla.id in ya:
            continue
        generar_documento(
            repo_plantillas, repo_documentos, proveedor, motor, almacen, plantilla_id=plantilla.id,
            sujeto_tipo=sujeto_tipo, sujeto_id=str(sujeto_id), actor_id=actor_id, valores_propios=valores.get(plantilla.id),
            hoy=hoy, trabajador_cedula=trabajador_cedula, estricto=False,
        )
        creados += 1
    return creados


def vincular_trabajador(repo_documentos, *, sujeto_tipo: str, sujeto_id: str, trabajador_cedula: str) -> int:
    """Deja la cédula del trabajador en los documentos del sujeto, para verlos luego desde su ficha (sin FK cruzada)."""
    return repo_documentos.vincular_trabajador(sujeto_tipo, str(sujeto_id), trabajador_cedula)
