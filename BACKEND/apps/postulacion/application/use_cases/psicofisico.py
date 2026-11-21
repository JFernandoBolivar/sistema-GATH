"""
Test psicofísico (D-8, decisión C-6): solo el resultado y el informe PDF; no se guardan las respuestas. Sin Django.

El archivo llega ya validado (tamaño, extensión y firma real) por la capa de presentación; aquí solo se guarda en el
almacén con una clave opaca (sin la cédula) y se registra el resultado, uno por expediente: registrar de nuevo
CORRIGE el anterior (y reemplaza el informe si llega uno nuevo; si no llega, se conserva el que ya había).
"""
import hashlib
import logging
from dataclasses import dataclass
from datetime import date, datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente, texto_normalizado
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.psicofisico import RESULTADOS_PSICOFISICO, ResultadoPsicofisico
from apps.postulacion.domain.errores import ConflictoConCodigo, ValidacionConCodigo
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import NotFoundError
from core.domain.ports import FileStorage

logger = logging.getLogger('gath.postulacion')

E = EstadoExpediente
# El test se registra mientras Captación aún decide: antes de abrir el expediente hacia Presupuesto.
ESTADOS_REGISTRO_PSICOFISICO = frozenset({E.PRE_REGISTRADO, E.EN_CAPTURA, E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS})
MAX_OBSERVACIONES = 2000
PREFIJO_CLAVE_INFORME = 'postulacion/psicofisico'


@dataclass(frozen=True)
class InformeSubido:
    """Informe ya validado por quien invoca: contenido, MIME y la clave opaca generada para el almacén."""

    contenido: bytes
    mime: str
    clave: str


def registrar_psicofisico(
    repo: RepoPostulacion, almacen: FileStorage, *, expediente_id: str, resultado: str, fecha_aplicacion: date,
    observaciones: str = '', informe: InformeSubido | None = None, registrado_por: str, ahora: datetime | None = None,
) -> tuple[ExpedientePostulacion, ResultadoPsicofisico, bool]:
    """Devuelve `(expediente, resultado, es_correccion)`."""
    ahora = ahora or ahora_utc()
    resultado = (resultado or '').strip().upper()
    if resultado not in RESULTADOS_PSICOFISICO:
        raise ValidacionConCodigo(
            f"El resultado debe ser uno de: {', '.join(RESULTADOS_PSICOFISICO)}.", campo='resultado',
            codigo='RESULTADO_INVALIDO',
        )
    if fecha_aplicacion > ahora.date():
        raise ValidacionConCodigo(
            "La fecha de aplicación no puede ser futura.", campo='fecha_aplicacion', codigo='FECHA_INVALIDA',
        )
    observaciones = texto_normalizado(observaciones, "Las observaciones", maximo=MAX_OBSERVACIONES, obligatorio=False)

    clave_nueva = informe.clave if informe else ''
    previa_clave = ''
    try:
        with repo.transaccion():
            exp = obtener_expediente(repo, expediente_id, bloquear=True)
            if exp.estado not in ESTADOS_REGISTRO_PSICOFISICO:
                raise ConflictoConCodigo(
                    f"El expediente está en {exp.estado.value}: el resultado psicofísico ya no se modifica.",
                    codigo='PSICOFISICO_NO_EDITABLE',
                )
            previo = repo.obtener_psicofisico(exp.id, bloquear=True)
            nuevo = ResultadoPsicofisico(
                expediente_id=exp.id, resultado=resultado, fecha_aplicacion=fecha_aplicacion, observaciones=observaciones,
                registrado_por=registrado_por, registrado_el=ahora,
                **_datos_informe(informe, previo),
            )
            if informe is not None:
                almacen.subir(informe.clave, informe.contenido, informe.mime)
            guardado = repo.guardar_psicofisico(nuevo)
            if informe is not None and previo is not None and previo.informe_clave:
                previa_clave = previo.informe_clave
            if previa_clave:  # el objeto anterior se borra solo si todo se confirmó
                repo.al_confirmar(lambda: _borrar_si_existe(almacen, previa_clave))
    except Exception:
        if clave_nueva:  # no dejar huérfano el archivo subido si la transacción se revierte
            _borrar_si_existe(almacen, clave_nueva)
        raise
    return exp, guardado, previo is not None


def _datos_informe(informe: InformeSubido | None, previo: ResultadoPsicofisico | None) -> dict:
    if informe is not None:
        return {
            'informe_clave': informe.clave, 'informe_sha256': hashlib.sha256(informe.contenido).hexdigest(),
            'informe_tamano': len(informe.contenido),
        }
    if previo is not None:
        return {
            'informe_clave': previo.informe_clave, 'informe_sha256': previo.informe_sha256,
            'informe_tamano': previo.informe_tamano,
        }
    return {}


def _borrar_si_existe(almacen: FileStorage, clave: str) -> None:
    try:
        almacen.eliminar(clave)
    except Exception:  # noqa: BLE001 - un objeto huérfano no debe tumbar la operación; queda en el log
        logger.exception('No se pudo borrar el objeto %s del almacén', clave)


def consultar_psicofisico(repo: RepoPostulacion, *, expediente_id: str) -> ResultadoPsicofisico:
    obtener_expediente(repo, expediente_id)
    r = repo.obtener_psicofisico(expediente_id)
    if r is None:
        raise NotFoundError("El expediente no tiene resultado psicofísico registrado.")
    return r


def informe_de(repo: RepoPostulacion, *, expediente_id: str) -> tuple[ResultadoPsicofisico, str]:
    """El resultado y el número del expediente, para servir el PDF; 404 si no hay informe."""
    exp = obtener_expediente(repo, expediente_id)
    r = repo.obtener_psicofisico(exp.id)
    if r is None or not r.tiene_informe:
        raise NotFoundError("El expediente no tiene informe psicofísico.")
    return r, exp.numero
