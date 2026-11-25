"""Generación de un documento a partir de una plantilla publicada, con snapshot y huella (F-1)."""
import hashlib
import uuid
from datetime import date

from apps.documentos.domain.services.catalogo_procesos import etiqueta_proceso, validar_proceso
from apps.documentos.domain.services.variables_documento import datos_de_hoy, huella_datos
from apps.documentos.domain.value_objects.esquema_documento import validar_definicion, validar_valores_propios
from apps.documentos.application.use_cases.gestionar_plantillas import contexto_de_render
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

TEXTO_CONFORMIDAD = (
    'Declaro que he leído el documento «{nombre}» (versión {version}) y que los datos que contiene son ciertos. '
    'Doy mi conformidad haciendo clic en «Acepto y declaro».'
)


def _snapshot(datos: dict) -> dict:
    """Datos usados, serializables: las imágenes (bytes) se reemplazan por su huella."""
    salida = {}
    for clave, valor in datos.items():
        if isinstance(valor, (bytes, bytearray)):
            salida[clave] = {'sha256': hashlib.sha256(bytes(valor)).hexdigest(), 'bytes': len(valor)}
        else:
            salida[clave] = valor
    return salida


def valores_propios_para_render(campos_propios: list, valores: dict | None, estricto: bool) -> dict:
    """`{propio.clave: valor}`. No estricto: los obligatorios vacíos se aceptan (vista previa mientras se llena); los tipos sí se validan."""
    if estricto:
        return validar_valores_propios(campos_propios, valores)
    return validar_valores_propios([{**c, 'obligatorio': False} for c in campos_propios], valores)


def generar_documento(
    repo_plantillas, repo_documentos, proveedor, motor, almacen, *,
    plantilla_id: str, sujeto_tipo: str, sujeto_id: str, actor_id: int | None,
    valores_propios: dict | None = None, datos_base: dict | None = None, hoy: date | None = None,
    trabajador_cedula: str = '', estricto: bool = True,
):
    plantilla = repo_plantillas.obtener(plantilla_id)
    if plantilla is None:
        raise NotFoundError('La plantilla no existe.')
    version = repo_plantillas.ultima_version(plantilla_id)
    if not plantilla.activa or version is None:
        raise ConflictError('La plantilla no está activa y publicada.')
    if datos_base is not None and not isinstance(datos_base, dict):
        raise ValidationError('Los datos base deben ser un objeto.', campo='datos_base')

    proceso = validar_proceso(version.metadatos.get('proceso') or plantilla.proceso)
    validar_definicion(version.modo, version.definicion, version.campos_propios, version.fondo_paginas, proceso)
    base = datos_base if datos_base is not None else (proveedor.datos_de(sujeto_tipo, sujeto_id) or {})
    datos = {**datos_de_hoy(hoy), **base}
    datos.update(valores_propios_para_render(version.campos_propios, valores_propios, estricto))

    contexto = contexto_de_render(almacen, version.modo, version.definicion, version.campos_propios,
                                  version.fondo_clave, version.fondo_paginas)
    pdf = motor.renderizar(contexto, datos)
    sha = hashlib.sha256(pdf).hexdigest()
    clave = almacen.subir(f'documentos/generados/{uuid.uuid4().hex}.pdf', pdf, 'application/pdf')
    return repo_documentos.guardar_generado({
        'plantilla_id': plantilla_id, 'version_id': version.id, 'sujeto_tipo': sujeto_tipo, 'sujeto_id': str(sujeto_id),
        'datos_snapshot': _snapshot(datos), 'pdf_clave': clave, 'pdf_sha256': sha, 'generado_por_id': actor_id,
        'huella_datos': huella_datos(datos, version.id), 'trabajador_cedula': trabajador_cedula or '',
        'plantilla_codigo': version.metadatos.get('codigo') or plantilla.codigo,
        'plantilla_nombre': version.metadatos.get('nombre') or plantilla.nombre,
        'proceso': proceso, 'proceso_etiqueta': etiqueta_proceso(proceso),
    })


def generar_por_proceso(
    repo_plantillas, repo_documentos, proveedor, motor, almacen, *,
    proceso: str, sujeto_tipo: str, sujeto_id: str, actor_id: int | None,
    valores_propios: dict | None = None, datos_base: dict | None = None, hoy: date | None = None,
    trabajador_cedula: str = '', estricto: bool = True,
):
    """Genera con la plantilla activa/publicada determinista del proceso (Punto de Cuenta)."""
    proceso = validar_proceso(proceso)
    plantilla = repo_plantillas.obtener_activa_por_proceso(proceso)
    if plantilla is None:
        raise NotFoundError(f'No existe una plantilla activa y publicada para el proceso «{proceso}».')
    return generar_documento(
        repo_plantillas, repo_documentos, proveedor, motor, almacen, plantilla_id=plantilla.id,
        sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id, actor_id=actor_id, valores_propios=valores_propios,
        datos_base=datos_base, hoy=hoy, trabajador_cedula=trabajador_cedula, estricto=estricto,
    )
