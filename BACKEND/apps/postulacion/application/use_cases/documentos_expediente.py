"""
Documentos digitales del expediente (F-4, F-5, F-6). Sin Django: todo el trabajo de las plantillas lo hace el puerto
`DocumentosDelExpediente`; aquí se aplican las reglas de acceso de postulación.

Postulante: Zero-IDOR igual que la Ventana 2 (expediente y cédula SIEMPRE de la sesión) y solo en CONSOLIDANDO con la ventana
vigente. Captación: lee cualquier expediente con el permiso de la bandeja.
"""
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente
from apps.postulacion.application.use_cases.mi_expediente import _propio
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.application.use_cases.ventana2 import exigir_ventana2
from apps.postulacion.domain.ports.repos import DocumentosDelExpediente, RepoPostulacion
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import NotFoundError
from core.domain.ports import LectorConfiguracion


def _acceso_postulante(repo: RepoPostulacion, expediente_id: str, cedula: str, ahora: datetime):
    exp = obtener_expediente(repo, expediente_id)
    _propio(repo, exp, cedula)
    exigir_ventana2(exp, ahora)
    return exp


def listar_mis_documentos(
    repo: RepoPostulacion, documentos: DocumentosDelExpediente, *, expediente_id: str, cedula: str,
    ahora: datetime | None = None,
) -> list[dict]:
    exp = _acceso_postulante(repo, expediente_id, cedula, ahora or ahora_utc())
    return documentos.listar(exp.id)


def guardar_mis_campos(
    repo: RepoPostulacion, config: LectorConfiguracion, documentos: DocumentosDelExpediente, *, expediente_id: str,
    cedula: str, codigo: str, valores: dict, ahora: datetime | None = None,
) -> dict:
    """Guarda los campos propios de UN documento. Si estaba firmado, la firma queda sin efecto (`firma_invalidada`)."""
    ahora = ahora or ahora_utc()
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        _propio(repo, exp, cedula)
        exigir_ventana2(exp, ahora)
        # Como el resto de la Ventana 2: editar renueva la actividad (autotransición sin asiento en el historial).
        aplicar_transicion_expediente(
            repo, config, expediente_id=exp.id, destino=EstadoExpediente.CONSOLIDANDO, actor=Actor.postulante(cedula), ahora=ahora,
        )
        return documentos.guardar_campos(exp.id, codigo, valores)


def ver_mi_planilla(
    repo: RepoPostulacion, documentos: DocumentosDelExpediente, *, expediente_id: str, cedula: str, codigo: str,
    ahora: datetime | None = None,
) -> bytes:
    exp = _acceso_postulante(repo, expediente_id, cedula, ahora or ahora_utc())
    return documentos.vista_previa(exp.id, codigo)


def firmar_mi_documento(
    repo: RepoPostulacion, documentos: DocumentosDelExpediente, *, expediente_id: str, cedula: str, codigo: str,
    ip: str, user_agent: str, acepta: bool, ahora: datetime | None = None,
) -> dict:
    """Firma por clic de conformidad con evidencia (C-5): el postulante solo firma lo de SU expediente."""
    ahora = ahora or ahora_utc()
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        _propio(repo, exp, cedula)
        exigir_ventana2(exp, ahora)
        return documentos.firmar(exp.id, codigo, cedula=cedula, ip=ip, user_agent=user_agent, acepta=acepta)


def mi_documento_firmado(
    repo: RepoPostulacion, documentos: DocumentosDelExpediente, *, expediente_id: str, cedula: str, codigo: str,
    ahora: datetime | None = None,
) -> tuple[str, str]:
    exp = _acceso_postulante(repo, expediente_id, cedula, ahora or ahora_utc())
    firmado = documentos.clave_firmado(exp.id, codigo)
    if firmado is None:
        raise NotFoundError('Todavía no tiene este documento firmado.')
    return firmado


# ------------------------------------------------------------------------------------------------ Captación
def documentos_para_captacion(repo: RepoPostulacion, documentos: DocumentosDelExpediente, *, expediente_id: str) -> list[dict]:
    """Los documentos del expediente (Ventana 2 y, ya contratado, los de contratación) con su estado y la evidencia de firma."""
    exp = obtener_expediente(repo, expediente_id)
    return documentos.listar(exp.id, con_contratacion=True)


def documento_para_captacion(
    repo: RepoPostulacion, documentos: DocumentosDelExpediente, *, expediente_id: str, codigo: str,
) -> tuple[str, str] | bytes:
    """
    Qué mostrar de un documento: `(clave, documento_id)` del PDF firmado vigente (se sirve del almacén) o, si no hay uno, los
    BYTES de la vista actual con los datos de hoy (sin firmar). Para un documento ya generado al contratar, el generado.
    """
    exp = obtener_expediente(repo, expediente_id)
    item = next((d for d in documentos.listar(exp.id, con_contratacion=True) if d['codigo'] == codigo), None)
    if item is None:
        raise NotFoundError('El documento no existe en este expediente.')
    firmado = documentos.clave_firmado(exp.id, codigo)
    if firmado is not None:
        return firmado
    return documentos.vista_previa(exp.id, codigo)
