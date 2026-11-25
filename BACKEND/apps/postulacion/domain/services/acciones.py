"""
Acciones que el usuario puede ejecutar sobre un expediente en cada bandeja (D-7, E-4, E-6). Sin Django.

Salen de la máquina de estados (transiciones legales desde el estado actual) y de los permisos del usuario, para
que el frontend no repita reglas. Cada bandeja tiene su lista cerrada de pares: `PARES_CAPTACION`,
`PARES_PRESUPUESTO` y `PARES_DIRECCION`; la asignación tiene su propio endpoint.

Una acción lleva `bloqueada` + `motivo_bloqueo` cuando una guarda que NO depende de lo que el usuario escriba no se
cumple hoy (p. ej. el psicofísico obligatorio sin registrar). Las guardas que sí dependen de la entrada (motivo,
cargo y oficina) se avisan con `requiere_motivo` y `requiere_propuesta`.
"""
from dataclasses import dataclass

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.entities.punto_cuenta_ingreso import PuntoCuentaIngreso, punto_cuenta_listo
from apps.postulacion.domain.entities.reserva import ReservaPuesto
from apps.postulacion.domain.services.maquina_estados import (
    Guarda,
    Hechos,
    P_ABRIR_EXPEDIENTE,
    buscar_transicion,
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

# La contratación NO va por el endpoint de transición (tiene el suyo, `asignar/`, con la promoción atómica), pero se
# muestra en el detalle de Captación para que el frontend la dibuje desde `acciones[]` como las demás.
PARES_ASIGNACION: dict[tuple[EstadoExpediente, EstadoExpediente], str] = {
    (E.LISTO_PARA_ASIGNAR, E.CONTRATADO): 'Contratar y asignar puesto',
}

# Lo que Presupuesto hace por el endpoint de transición de `solicitudes/` (E-4).
PARES_PRESUPUESTO: dict[tuple[EstadoExpediente, EstadoExpediente], str] = {
    (E.EN_PRESUPUESTO, E.EN_CORRECCION_CARGO): 'Devolver a Captación (cargo u oficina)',
    (E.EN_PRESUPUESTO, E.DIFERIDO_PRESUPUESTO): 'Diferir por falta de disponibilidad',
    (E.DIFERIDO_PRESUPUESTO, E.EN_PRESUPUESTO): 'Retomar: se liberó la partida',
    (E.EN_PRESUPUESTO, E.EN_DIRECCION_GENERAL): 'Emitir el Punto de Cuenta y enviar a Dirección General',
}

# Lo que Dirección General hace por el endpoint de transición de `ingresos/` (E-6).
PARES_DIRECCION: dict[tuple[EstadoExpediente, EstadoExpediente], str] = {
    (E.EN_DIRECCION_GENERAL, E.APROBADO): 'Aprobar el ingreso',
    (E.EN_DIRECCION_GENERAL, E.RECHAZADO_DIRECCION): 'Rechazar el ingreso',
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
    # M-1: acciones del proceso de ingreso configurable. `codigo` identifica las que NO son una simple transición del
    # endpoint `transicion/` (reservar_puesto, liberar_reserva, generar_punto_cuenta, registrar_aprobacion,
    # adjuntar_punto_cuenta_firmado); `destino` es el estado al que llevan o '' si no cambian el estado.
    codigo: str = ''
    requiere_fecha: bool = False


def es_par_de_captacion(origen: EstadoExpediente, destino: EstadoExpediente) -> bool:
    return (origen, destino) in PARES_CAPTACION


def es_par_de_presupuesto(origen: EstadoExpediente, destino: EstadoExpediente) -> bool:
    return (origen, destino) in PARES_PRESUPUESTO


def es_par_de_direccion(origen: EstadoExpediente, destino: EstadoExpediente) -> bool:
    return (origen, destino) in PARES_DIRECCION


def acciones_disponibles(
    exp: ExpedientePostulacion, permisos: frozenset[str], hechos: Hechos, psicofisico: ResultadoPsicofisico | None = None,
    pares: dict[tuple[EstadoExpediente, EstadoExpediente], str] | None = None,
) -> list[AccionDisponible]:
    pares = PARES_CAPTACION if pares is None else pares
    if exp.es_terminal:
        return []
    acciones = []
    for t in transiciones_desde(exp.estado, exp.requiere_presupuesto, exp.requiere_direccion_general):
        etiqueta = pares.get((t.origen, t.destino))
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


# Códigos de las acciones del proceso de ingreso configurable (M-1).
ACCION_RESERVAR_PUESTO = 'reservar_puesto'
ACCION_LIBERAR_RESERVA = 'liberar_reserva'
ACCION_GENERAR_PUNTO_CUENTA = 'generar_punto_cuenta'
ACCION_REGISTRAR_APROBACION = 'registrar_aprobacion'
ACCION_ADJUNTAR_FIRMADO = 'adjuntar_punto_cuenta_firmado'


def _primer_bloqueo(exp: ExpedientePostulacion, destino: EstadoExpediente, hechos: Hechos) -> str:
    t = buscar_transicion(exp.estado, destino, exp.requiere_presupuesto, exp.requiere_direccion_general)
    if t is None:
        return ''
    return next((m for g in t.guardas if g not in _GUARDAS_DE_ENTRADA if (m := guarda_incumplida(g, hechos))), '') or ''


def acciones_ingreso_configurable(
    exp: ExpedientePostulacion, permisos: frozenset[str], hechos: Hechos, reserva: ReservaPuesto | None,
    punto: PuntoCuentaIngreso | None,
) -> list[AccionDisponible]:
    """
    Acciones de Captación cuando Presupuesto y/o Dirección General no están en el sistema (M-1). Todas usan el permiso
    `postulacion.abrir_expediente`. Sin Presupuesto (ENVIADO_CAPTACION): reservar o cambiar el puesto, liberar la reserva,
    generar el Punto de Cuenta (con Dirección General: lo envía a ella; sin ella: queda para imprimirlo y firmarlo) y, sin
    ninguna de las dos, registrar la aprobación. Con Presupuesto pero sin Dirección General (EN_DIRECCION_GENERAL):
    registrar la aprobación. Con la aprobación registrada sin el PDF firmado: adjuntarlo.
    """
    if P_ABRIR_EXPEDIENTE not in permisos or (exp.es_terminal and exp.estado != E.CONTRATADO):
        return []
    acciones: list[AccionDisponible] = []
    generado = punto_cuenta_listo(punto, reserva)
    if exp.estado == E.ENVIADO_CAPTACION and not exp.requiere_presupuesto:
        bloqueo_cambio = (
            "El Punto de Cuenta ya se generó para el puesto reservado: no se puede cambiar ni liberar la reserva."
            if generado else ''
        )
        acciones.append(AccionDisponible(
            destino='', etiqueta='Cambiar el puesto reservado' if reserva else 'Reservar puesto',
            requiere_motivo=False, requiere_propuesta=False, bloqueada=bool(bloqueo_cambio),
            motivo_bloqueo=bloqueo_cambio, codigo=ACCION_RESERVAR_PUESTO,
        ))
        if reserva is not None:
            acciones.append(AccionDisponible(
                destino='', etiqueta='Liberar la reserva', requiere_motivo=False, requiere_propuesta=False,
                bloqueada=bool(bloqueo_cambio), motivo_bloqueo=bloqueo_cambio, codigo=ACCION_LIBERAR_RESERVA,
            ))
        if exp.requiere_direccion_general:
            acciones.append(AccionDisponible(
                destino=E.EN_DIRECCION_GENERAL.value, etiqueta='Generar el Punto de Cuenta y enviar a Dirección General',
                requiere_motivo=False, requiere_propuesta=False, codigo=ACCION_GENERAR_PUNTO_CUENTA,
                **_bloqueo(_primer_bloqueo(exp, E.EN_DIRECCION_GENERAL, hechos)),
            ))
        else:
            if not generado:
                bloqueo = (
                    guarda_incumplida(Guarda.PSICOFISICO, hechos)
                    or guarda_incumplida(Guarda.PUESTO_RESERVADO_VIGENTE, hechos) or ''
                )
                acciones.append(AccionDisponible(
                    destino='', etiqueta='Generar el Punto de Cuenta', requiere_motivo=False, requiere_propuesta=False,
                    codigo=ACCION_GENERAR_PUNTO_CUENTA, **_bloqueo(bloqueo),
                ))
            acciones.append(AccionDisponible(
                destino=E.APROBADO.value, etiqueta='Registrar la aprobación firmada', requiere_motivo=False,
                requiere_propuesta=False, codigo=ACCION_REGISTRAR_APROBACION, requiere_fecha=True,
                **_bloqueo(_primer_bloqueo(exp, E.APROBADO, hechos)),
            ))
    elif exp.estado == E.EN_DIRECCION_GENERAL and not exp.requiere_direccion_general:
        acciones.append(AccionDisponible(
            destino=E.APROBADO.value, etiqueta='Registrar la aprobación firmada', requiere_motivo=False,
            requiere_propuesta=False, codigo=ACCION_REGISTRAR_APROBACION, requiere_fecha=True,
        ))
    if punto is not None and punto.aprobado_fuera_sistema and not punto.tiene_pdf_firmado:
        acciones.append(AccionDisponible(
            destino='', etiqueta='Adjuntar el Punto de Cuenta firmado', requiere_motivo=False, requiere_propuesta=False,
            codigo=ACCION_ADJUNTAR_FIRMADO,
        ))
    return acciones


def _bloqueo(motivo: str) -> dict:
    return {'bloqueada': bool(motivo), 'motivo_bloqueo': motivo}
