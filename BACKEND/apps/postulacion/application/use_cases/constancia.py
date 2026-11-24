"""
Constancia presupuestaria (E-3, C-2). Sin Django.

El sistema NO calcula la disponibilidad: registra que quien tiene el permiso `postulacion.declarar_disponibilidad` la
declaró, con su nombre, la referencia (partida u oficio) y, opcionalmente, el PDF de respaldo. Una por expediente:
declarar de nuevo CORRIGE la anterior (y reemplaza el adjunto si llega uno nuevo; si no llega, se conserva).
"""
import hashlib
from dataclasses import dataclass
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente, texto_normalizado
from apps.postulacion.application.use_cases.psicofisico import InformeSubido, _borrar_si_existe
from apps.postulacion.domain.entities.constancia import ConstanciaPresupuestaria
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.errores import ConflictoConCodigo, ValidacionConCodigo
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.ports import FileStorage

MAX_REFERENCIA = 100
MAX_OBSERVACIONES = 2000
PREFIJO_CLAVE_CONSTANCIA = 'postulacion/constancia'


@dataclass(frozen=True)
class DeclaranteConstancia:
    cedula: str
    nombre: str


def declarar_disponibilidad(
    repo: RepoPostulacion, almacen: FileStorage, *, expediente_id: str, referencia: str, observaciones: str = '',
    adjunto: InformeSubido | None = None, declarante: DeclaranteConstancia, ahora: datetime | None = None,
) -> tuple[ExpedientePostulacion, ConstanciaPresupuestaria, bool]:
    """Devuelve `(expediente, constancia, es_correccion)`."""
    ahora = ahora or ahora_utc()
    referencia = texto_normalizado(referencia, "La referencia (partida u oficio)", maximo=MAX_REFERENCIA)
    observaciones = texto_normalizado(observaciones, "Las observaciones", maximo=MAX_OBSERVACIONES, obligatorio=False)
    if not (declarante.cedula or '').strip():
        raise ValidacionConCodigo("No se pudo identificar a quien declara.", codigo='DECLARANTE_INVALIDO')

    clave_nueva = adjunto.clave if adjunto else ''
    previa_clave = ''
    try:
        with repo.transaccion():
            exp = obtener_expediente(repo, expediente_id, bloquear=True)
            if exp.estado != EstadoExpediente.EN_PRESUPUESTO:
                raise ConflictoConCodigo(
                    f"El expediente está en {exp.estado.value}: la disponibilidad solo se declara mientras está en "
                    "Presupuesto (EN_PRESUPUESTO).", codigo='CONSTANCIA_NO_EDITABLE',
                )
            previa = repo.obtener_constancia(exp.id, bloquear=True)
            nueva = ConstanciaPresupuestaria(
                expediente_id=exp.id, declarado_por_cedula=declarante.cedula, declarado_por_nombre=declarante.nombre,
                referencia=referencia, fecha=ahora, observaciones=observaciones, **_datos_adjunto(adjunto, previa),
            )
            if adjunto is not None:
                almacen.subir(adjunto.clave, adjunto.contenido, adjunto.mime)
            guardada = repo.guardar_constancia(nueva)
            if adjunto is not None and previa is not None and previa.adjunto_clave:
                previa_clave = previa.adjunto_clave
                repo.al_confirmar(lambda: _borrar_si_existe(almacen, previa_clave))
    except Exception:
        if clave_nueva:  # no dejar huérfano el archivo subido si la transacción se revierte
            _borrar_si_existe(almacen, clave_nueva)
        raise
    return exp, guardada, previa is not None


def _datos_adjunto(adjunto: InformeSubido | None, previa: ConstanciaPresupuestaria | None) -> dict:
    if adjunto is not None:
        return {
            'adjunto_clave': adjunto.clave, 'adjunto_sha256': hashlib.sha256(adjunto.contenido).hexdigest(),
            'adjunto_tamano': len(adjunto.contenido),
        }
    if previa is not None:
        return {
            'adjunto_clave': previa.adjunto_clave, 'adjunto_sha256': previa.adjunto_sha256,
            'adjunto_tamano': previa.adjunto_tamano,
        }
    return {}
