"""Firma por clic de conformidad con evidencia (F-1; el flujo de pantalla es F-6)."""
import hashlib
from datetime import datetime, timezone

from apps.documentos.application.use_cases.generar_documento import TEXTO_CONFORMIDAD
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

TIPOS_FIRMANTE = ('postulante', 'conatel')


def firmar_documento(
    repo_plantillas, repo_documentos, almacen, *, documento_id: str, firmante_tipo: str, firmante_id: str,
    ip: str, user_agent: str, acepta: bool,
):
    documento = repo_documentos.obtener_generado(documento_id)
    if documento is None:
        raise NotFoundError('El documento no existe.')
    if firmante_tipo not in TIPOS_FIRMANTE:
        raise ValidationError('Tipo de firmante no permitido.', campo='firmante_tipo')
    if not acepta:
        raise ValidationError('Debe aceptar y declarar para firmar.', campo='acepto')

    version = next((v for v in repo_plantillas.versiones(documento.plantilla_id) if v.id == documento.version_id), None)
    if version is None:
        raise NotFoundError('La versión de la plantilla del documento no existe.')
    meta = version.metadatos
    if not meta.get('requiere_firma_clic'):
        raise ConflictError('Este documento no requiere firma por clic.')
    if meta.get('firmante') not in ('ambos', firmante_tipo):
        raise ConflictError('Este firmante no corresponde a este documento.')
    if any(f.firmante_tipo == firmante_tipo and f.firmante_id == str(firmante_id) for f in repo_documentos.firmas_de(documento_id)):
        raise ConflictError('Este firmante ya firmó el documento.')

    # La huella firmada es la del archivo tal como está guardado: si fue alterado, no se firma.
    sha_actual = hashlib.sha256(almacen.descargar(documento.pdf_clave)).hexdigest()
    if sha_actual != documento.pdf_sha256:
        raise ConflictError('El archivo del documento no coincide con su huella: no se puede firmar.')

    return repo_documentos.guardar_firma({
        'documento_id': documento_id, 'firmante_tipo': firmante_tipo, 'firmante_id': str(firmante_id),
        'firmado_en': datetime.now(timezone.utc), 'ip': ip or '', 'user_agent': (user_agent or '')[:400],
        'sha256_firmado': sha_actual,
        'texto_conformidad': TEXTO_CONFORMIDAD.format(nombre=meta.get('nombre', ''), version=version.numero),
    })
