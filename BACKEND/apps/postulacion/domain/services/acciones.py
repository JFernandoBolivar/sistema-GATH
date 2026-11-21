"""
Acciones que el usuario de Captación puede ejecutar sobre un expediente (D-7). Sin Django.

Salen de la máquina de estados (transiciones legales desde el estado actual) y de los permisos del usuario, para
que el frontend no repita reglas. Solo se listan las del flujo de Captación (`PARES_CAPTACION`); las de
Presupuesto, Dirección General y asignación tienen sus propios endpoints.

Una acción lleva `bloqueada` + `motivo_bloqueo` cuando una guarda que NO depende de lo que el usuario escriba no se
cumple hoy (p. ej. el psicofísico obligatorio sin registrar). Las guardas que sí dependen de la entrada (motivo,
cargo y oficina) se avisan con `requiere_motivo` y `requiere_propuesta`.
"""
from dataclasses import dataclass

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.services.maquina_estados import (
    Guarda,
    Hechos,
    guarda_incumplida,
    transiciones_desde,
)
from apps.postulacion.domain.value_objects.estados import EstadoExpediente

E = EstadoExpediente

# (origen, destino) -> etiqueta. Es la lista cerrada de lo que Captación hace por el endpoint de transición.
PARES_CAPTACION: dict[tuple[EstadoExpediente, EstadoExpediente], str] = {
    (E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS): 'Devolver con observaciones',
    (E.ENVIADO_CAPTACION, E.RECHAZADO_CAPTACION): 'Rechazar',
    (E.ENVIADO_CAPTACION, E.EN_PRESUPUESTO): 'Abrir hacia Presupuesto',
    (E.EN_CORRECCION_CARGO, E.EN_PRESUPUESTO): 'Reabrir hacia Presupuesto',
    (E.APROBADO, E.CONSOLIDANDO): 'Reabrir la Ventana 2',
    (E.EN_REVISION_FINAL, E.CONSOLIDANDO): 'Observar faltantes',
    (E.EN_REVISION_FINAL, E.LISTO_PARA_ASIGNAR): 'Conforme',
}

_GUARDAS_DE_ENTRADA = (Guarda.MOTIVO_OBLIGATORIO, Guarda.CARGO_Y_OFICINA)


@dataclass(frozen=True)
class AccionDisponible:
    destino: str
    etiqueta: str
    requiere_motivo: bool
    requiere_propuesta: bool
    bloqueada: bool = False
    motivo_bloqueo: str = ''
    sugerida: bool = False


def es_par_de_captacion(origen: EstadoExpediente, destino: EstadoExpediente) -> bool:
    return (origen, destino) in PARES_CAPTACION


def acciones_disponibles(
    exp: ExpedientePostulacion, permisos: frozenset[str], hechos: Hechos, psicofisico: ResultadoPsicofisico | None,
) -> list[AccionDisponible]:
    if exp.es_terminal:
        return []
    acciones = []
    for t in transiciones_desde(exp.estado):
        etiqueta = PARES_CAPTACION.get((t.origen, t.destino))
        if etiqueta is None or not any(p in permisos for p in t.permisos):
            continue
        bloqueo = next(
            (m for g in t.guardas if g not in _GUARDAS_DE_ENTRADA if (m := guarda_incumplida(g, hechos))), None,
        )
        acciones.append(AccionDisponible(
            destino=t.destino.value, etiqueta=etiqueta,
            requiere_motivo=Guarda.MOTIVO_OBLIGATORIO in t.guardas,
            requiere_propuesta=Guarda.CARGO_Y_OFICINA in t.guardas,
            bloqueada=bloqueo is not None, motivo_bloqueo=bloqueo or '',
            # Un resultado NO_APTO no bloquea nada: solo orienta hacia el rechazo (decisión de Captación).
            sugerida=bool(psicofisico and psicofisico.sugiere_rechazo and t.destino == E.RECHAZADO_CAPTACION),
        ))
    return acciones
