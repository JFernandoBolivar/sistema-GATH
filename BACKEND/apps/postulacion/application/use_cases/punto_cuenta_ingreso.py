"""
Emisión del Punto de Cuenta de ingreso para el puesto reservado de un expediente (E-5, M-1). Sin Django.

La comparten Presupuesto (al enviar a Dirección General, con la constancia presupuestaria) y Captación (cuando Presupuesto no
está en el sistema, sin constancia). Se ejecuta DENTRO de la transacción de quien invoca; el llamador descarta el PDF
(`emisor.descartar`) de los `emitidos` si esa transacción se revierte.
"""
from dataclasses import dataclass, replace
from datetime import datetime

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.punto_cuenta_ingreso import (
    EMITIDO,
    PuntoCuentaEmitido,
    PuntoCuentaIngreso,
    SolicitudPuntoCuentaIngreso,
)
from apps.postulacion.domain.entities.reserva import ReservaPuesto
from apps.postulacion.domain.errores import ConflictoConCodigo
from apps.postulacion.domain.ports.repos import EmisorPuntoCuenta, PuestosVacantes, RepoPostulacion


@dataclass(frozen=True)
class QuienActua:
    """El usuario que actúa, para la constancia y el Punto de Cuenta (cédula, nombre y id de cuenta)."""

    cedula: str
    nombre: str
    usuario_id: int | None = None


def emitir_punto_cuenta_de_reserva(
    repo: RepoPostulacion, puestos: PuestosVacantes, emisor: EmisorPuntoCuenta, *, previo: ExpedientePostulacion,
    reserva: ReservaPuesto, referencia_constancia: str, quien: QuienActua, ahora: datetime,
    vence_reserva: datetime | None, emitidos: list[PuntoCuentaEmitido],
) -> dict:
    """Genera el PDF y el registro del Punto de Cuenta (estado EMITIDO) para el puesto de la reserva y, si se indica, fija el
    vencimiento de la reserva. Devuelve los datos que se suman al asiento del historial."""
    puesto = puestos.obtener_puesto(reserva.puesto_id)
    postulante = repo.obtener_postulante(previo.postulante_id)
    if puesto is None or postulante is None:
        raise ConflictoConCodigo("El puesto reservado o el postulante ya no existen.", codigo='PUESTO_NO_ENCONTRADO')
    emitido = emisor.emitir_ingreso(SolicitudPuntoCuentaIngreso(
        expediente_numero=previo.numero, postulante_cedula=postulante.cedula,
        postulante_nombre=f'{postulante.nombres} {postulante.apellidos}'.strip(), puesto_id=puesto.id,
        puesto_codigo=puesto.codigo, cargo_nombre=puesto.cargo_nombre, dependencia_id=puesto.dependencia_id,
        dependencia_nombre=puesto.dependencia_nombre, direccion_general_id=puesto.direccion_general_id,
        direccion_general_nombre=puesto.direccion_general_nombre, direccion_linea_id=puesto.direccion_linea_id,
        direccion_linea_nombre=puesto.direccion_linea_nombre, referencia_constancia=referencia_constancia,
        emitido_por_cedula=quien.cedula, emitido_por_nombre=quien.nombre, emitido_por_usuario_id=quien.usuario_id,
        ahora=ahora,
    ))
    emitidos.append(emitido)
    repo.guardar_punto_cuenta_ingreso(PuntoCuentaIngreso(
        expediente_id=previo.id, punto_cuenta_id=emitido.punto_cuenta_id, numero=emitido.numero,
        pdf_clave=emitido.pdf_clave, estado=EMITIDO, puesto_id=puesto.id,
        referencia_constancia=referencia_constancia, emitido_por=quien.cedula, emitido_el=ahora,
    ))
    # La reserva vence igual que el expediente (lo fija el efecto de la transición): quien decide recibe el plazo completo,
    # y la tarea programada y la guarda de asignación leen la misma fecha.
    if vence_reserva is not None:
        repo.guardar_reserva(replace(reserva, vence_el=vence_reserva))
    return {
        'punto_cuenta': {'id': emitido.punto_cuenta_id, 'numero': emitido.numero},
        'puesto_id': puesto.id, 'referencia_constancia': referencia_constancia,
    }
