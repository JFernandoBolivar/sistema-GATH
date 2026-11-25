"""
Casos de uso M-1: flujo de ingreso configurable gestionado desde Captación. Sin Django.

Cuando `captacion.requiere_presupuesto` es False, Captación (permiso `abrir_expediente`) reserva el
puesto (reutilizando `reservar_puesto` con `desde_captacion=True`) y genera el Punto de Cuenta de
ingreso. Si además `captacion.requiere_direccion_general` es False, Captación registra la aprobación
(con la fecha de la firma en papel y el PDF firmado escaneado opcional) y la máquina pasa a APROBADO.

Cuando solo `captacion.requiere_direccion_general` es False (y Presupuesto sí está en el sistema),
Captación registra la aprobación del expediente que ya llegó EN_DIRECCION_GENERAL.

Historial explícito (no es un asiento de transición sino un tipo especial en datos_extra):
  «Aprobado fuera del sistema; registrado por <nombre> el <fecha_registro>; firma del <fecha_firma>».

PDF firmado escaneado: clave opaca, hasta 10 MB, PDF; se puede adjuntar después si no se tenía al
registrar la aprobación. Las descargas van por `respuesta_archivo` con bitácora (H-3).
"""
import logging
from dataclasses import dataclass, replace
from datetime import date, datetime
from zoneinfo import ZoneInfo

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente
from apps.postulacion.application.use_cases.punto_cuenta_ingreso import QuienActua, emitir_punto_cuenta_de_reserva
from apps.postulacion.application.use_cases.reservas import _exigir_en_captacion
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.punto_cuenta_ingreso import (
    FIRMADO,
    PuntoCuentaEmitido,
    PuntoCuentaIngreso,
    punto_cuenta_listo,
)
from apps.postulacion.domain.entities.reserva import ReservaPuesto
from apps.postulacion.domain.errores import ConflictoConCodigo
from apps.postulacion.domain.ports.repos import EmisorPuntoCuenta, PuestosVacantes, RepoPostulacion
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente as E
from core.domain.exceptions import NotFoundError, ValidationError
from core.domain.ports import FileStorage, LectorConfiguracion, Notificador

PREFIJO_CLAVE_PDF_FIRMADO = 'postulacion/punto_cuenta_firmado'
ZONA_NEGOCIO = ZoneInfo('America/Caracas')   # «hoy» y las fechas del historial son las del país, no las de UTC
logger = logging.getLogger('gath.postulacion')


def _borrar_si_existe(almacen: FileStorage, clave: str) -> None:
    try:
        almacen.eliminar(clave)
    except Exception:  # noqa: BLE001 - limpiar un huérfano nunca debe tapar el error original
        logger.warning('No se pudo borrar el PDF firmado huérfano %s', clave)



@dataclass(frozen=True)
class PdfSubido:
    """PDF firmado escaneado subido desde el formulario."""

    contenido: bytes
    mime: str
    clave: str
    sha256: str


def _exigir_punto_cuenta_emitido(punto: PuntoCuentaIngreso | None, reserva: ReservaPuesto | None) -> PuntoCuentaIngreso:
    """El Punto de Cuenta debe estar emitido (EMITIDO) y para el puesto reservado actual."""
    if not punto_cuenta_listo(punto, reserva):
        raise ConflictoConCodigo(
            'El Punto de Cuenta de ingreso aún no se generó (o el puesto reservado cambió). '
            'Genérelo primero para imprimirlo y firmarlo.',
            codigo='PUNTO_CUENTA_NO_GENERADO',
        )
    return punto  # type: ignore[return-value]


def _exigir_sin_aprobacion_previa(punto: PuntoCuentaIngreso) -> None:
    if punto.estado == FIRMADO:
        raise ConflictoConCodigo(
            'El ingreso ya fue aprobado. Para modificar la aprobación, comuníquese con el administrador.',
            codigo='APROBACION_YA_REGISTRADA',
        )


def generar_punto_cuenta_captacion(
    repo: RepoPostulacion, puestos: PuestosVacantes, emisor: EmisorPuntoCuenta, config: LectorConfiguracion, *,
    expediente_id: str, quien: QuienActua, ahora: datetime | None = None, notificador: Notificador | None = None,
) -> dict:
    """
    M-1 (sin Presupuesto en el sistema): Captación genera el Punto de Cuenta de ingreso para
    el puesto reservado.
    - Si `requiere_direccion_general` es True: el expediente avanza a EN_DIRECCION_GENERAL y la reserva
      vence con el plazo del expediente.
    - Si `requiere_direccion_general` es False: el expediente permanece en ENVIADO_CAPTACION y el PDF
      queda listo para imprimir y firmar en papel.

    Exige: expediente ENVIADO_CAPTACION, requiere_presupuesto=False, reserva activa.
    Reutiliza `emitir_punto_cuenta_de_reserva` (igual que Presupuesto en E-5).
    """
    ahora = ahora or ahora_utc()
    emitidos: list[PuntoCuentaEmitido] = []
    try:
        with repo.transaccion():
            exp = obtener_expediente(repo, expediente_id, bloquear=True)
            _exigir_en_captacion(exp, 'generar el Punto de Cuenta')
            reserva = repo.obtener_reserva_activa_de_expediente(exp.id, bloquear=True)
            if reserva is None:
                raise ConflictoConCodigo(
                    'Reserve primero el puesto vacante: no hay una reserva vigente para este expediente.',
                    codigo='PUESTO_RESERVADO_REQUERIDO',
                )
            existente = repo.obtener_punto_cuenta_ingreso(exp.id)
            if punto_cuenta_listo(existente, reserva) and not exp.requiere_direccion_general:
                raise ConflictoConCodigo(
                    'El Punto de Cuenta ya se generó para el puesto reservado. Descárguelo para imprimirlo.',
                    codigo='PUNTO_CUENTA_YA_GENERADO',
                )

            vence_reserva = None
            if exp.requiere_direccion_general:
                actor = Actor(cedula=quien.cedula, permisos=frozenset({'postulacion.abrir_expediente'}))
                exp_nuevo, _ = aplicar_transicion_expediente(
                    repo, config, expediente_id=exp.id, destino=E.EN_DIRECCION_GENERAL, actor=actor, ahora=ahora,
                    notificador=notificador,
                )
                vence_reserva = exp_nuevo.reserva_vence_el or reserva.vence_el

            resultado = emitir_punto_cuenta_de_reserva(
                repo, puestos, emisor, previo=exp, reserva=reserva, referencia_constancia='',
                quien=quien, ahora=ahora, vence_reserva=vence_reserva, emitidos=emitidos,
            )
    except Exception:
        for e in emitidos:
            emisor.descartar(e.punto_cuenta_id, e.pdf_clave)
        raise
    return resultado


def _aplicar_aprobacion_fuera_sistema(
    repo: RepoPostulacion, config: LectorConfiguracion, almacen: FileStorage, *, exp: ExpedientePostulacion,
    punto: PuntoCuentaIngreso, reserva: ReservaPuesto | None, fecha_firma: date, quien: QuienActua,
    ahora: datetime, pdf: PdfSubido | None, notificador: Notificador | None = None,
) -> tuple[ExpedientePostulacion, PuntoCuentaIngreso]:
    """
    Registra la aprobación firmada fuera del sistema: pasa el Punto de Cuenta a FIRMADO, guarda la
    fecha de la firma y el PDF escaneado opcional, y ejecuta la transición del expediente a APROBADO.
    """
    mensaje = (
        f'Aprobado fuera del sistema; registrado por {quien.nombre} el '
        f'{ahora.astimezone(ZONA_NEGOCIO).strftime("%d/%m/%Y")}; firma del {fecha_firma.strftime("%d/%m/%Y")}.'
    )
    actor = Actor(cedula=quien.cedula, permisos=frozenset({'postulacion.abrir_expediente'}))
    # La transición va PRIMERO: su guarda «Punto de Cuenta generado» lee el punto aún EMITIDO.
    exp_nuevo, _ = aplicar_transicion_expediente(
        repo, config, expediente_id=exp.id, destino=E.APROBADO, actor=actor, ahora=ahora,
        motivo=mensaje, notificador=notificador,
        datos_extra={
            'origen': 'captacion',
            'tipo': 'APROBACION_FUERA_SISTEMA',
            'fecha_firma': fecha_firma.isoformat(),
            'registrado_por': quien.nombre,
            'registrado_el': ahora.isoformat(),
            'mensaje': mensaje,
        },
    )
    # Sin Presupuesto ni Dirección General la reserva (hecha en Captación) cuenta desde la aprobación: se alinea con el expediente.
    if exp_nuevo.reserva_vence_el is not None and reserva is not None:
        repo.guardar_reserva(replace(reserva, vence_el=exp_nuevo.reserva_vence_el))
    if pdf is not None:
        almacen.subir(pdf.clave, pdf.contenido, pdf.mime)
    nuevo_punto = replace(
        punto, estado=FIRMADO, aprobado_fuera_sistema=True,
        fecha_firma=fecha_firma, registrado_por_nombre=quien.nombre,
        decidido_por=quien.cedula, decidido_el=ahora,
        **(
            {'pdf_firmado_clave': pdf.clave, 'pdf_firmado_sha256': pdf.sha256, 'pdf_firmado_tamano': len(pdf.contenido)}
            if pdf else {}
        ),
    )
    repo.guardar_punto_cuenta_ingreso(nuevo_punto)
    return exp_nuevo, nuevo_punto


def registrar_aprobacion_captacion(
    repo: RepoPostulacion, config: LectorConfiguracion, almacen: FileStorage, *, expediente_id: str,
    fecha_firma: date, quien: QuienActua, pdf: PdfSubido | None = None, ahora: datetime | None = None,
    notificador: Notificador | None = None,
) -> tuple[ExpedientePostulacion, PuntoCuentaIngreso]:
    """
    M-1: registra la aprobación firmada FUERA del sistema y pasa el expediente a APROBADO.

    Válido cuando:
      - requiere_presupuesto=False y requiere_direccion_general=False → estado ENVIADO_CAPTACION
      - requiere_presupuesto=True y requiere_direccion_general=False → estado EN_DIRECCION_GENERAL
        (el Punto de Cuenta fue emitido por Presupuesto; ya tiene reserva y vence_el).

    `fecha_firma`: la del Punto de Cuenta firmado en papel; no puede ser futura.
    `pdf`: el PDF firmado escaneado (opcional; se puede adjuntar después).
    """
    ahora = ahora or ahora_utc()
    hoy = ahora.astimezone(ZONA_NEGOCIO).date()
    if fecha_firma > hoy:
        raise ValidationError('La fecha de la firma no puede ser futura.', campo='fecha_firma')

    try:
        return _registrar_aprobacion(
            repo, config, almacen, expediente_id=expediente_id, fecha_firma=fecha_firma, quien=quien, pdf=pdf,
            ahora=ahora, notificador=notificador,
        )
    except Exception:
        if pdf is not None:   # no dejar huérfano el archivo subido si la transacción se revierte
            _borrar_si_existe(almacen, pdf.clave)
        raise


def _registrar_aprobacion(
    repo: RepoPostulacion, config: LectorConfiguracion, almacen: FileStorage, *, expediente_id: str, fecha_firma: date,
    quien: QuienActua, pdf: PdfSubido | None, ahora: datetime, notificador: Notificador | None,
) -> tuple[ExpedientePostulacion, PuntoCuentaIngreso]:
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        if exp.requiere_direccion_general:
            raise ConflictoConCodigo(
                'Este expediente pasa por la Dirección General en el sistema: la aprobación la registra Dirección General.',
                codigo='EXPEDIENTE_CON_DIRECCION_GENERAL',
            )
        if exp.requiere_presupuesto:
            if exp.estado != E.EN_DIRECCION_GENERAL:
                raise ConflictoConCodigo(
                    f'El expediente está en {exp.estado.value}: la aprobación solo se registra cuando está EN_DIRECCION_GENERAL.',
                    codigo='EXPEDIENTE_NO_EN_DIRECCION_GENERAL',
                )
        else:
            _exigir_en_captacion(exp, 'registrar la aprobación')

        reserva = repo.obtener_reserva_activa_de_expediente(exp.id, bloquear=True)
        punto = repo.obtener_punto_cuenta_ingreso(exp.id, bloquear=True)
        punto = _exigir_punto_cuenta_emitido(punto, reserva)
        _exigir_sin_aprobacion_previa(punto)

        return _aplicar_aprobacion_fuera_sistema(
            repo, config, almacen, exp=exp, punto=punto, reserva=reserva, fecha_firma=fecha_firma,
            quien=quien, ahora=ahora, pdf=pdf, notificador=notificador,
        )


def adjuntar_pdf_firmado(
    repo: RepoPostulacion, almacen: FileStorage, *, expediente_id: str, pdf: PdfSubido,
    ahora: datetime | None = None,
) -> PuntoCuentaIngreso:
    """
    M-1: adjunta el PDF firmado escaneado DESPUÉS de haber registrado la aprobación (si no se tenía al registrarla).
    Solo se puede mientras el Punto de Cuenta esté FIRMADO con `aprobado_fuera_sistema=True` y aún sin PDF.
    """
    ahora = ahora or ahora_utc()
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id)
        punto = repo.obtener_punto_cuenta_ingreso(exp.id, bloquear=True)
        if punto is None:
            raise NotFoundError('El expediente no tiene Punto de Cuenta de ingreso.')
        if not punto.aprobado_fuera_sistema or punto.estado != FIRMADO:
            raise ConflictoConCodigo(
                'Solo se puede adjuntar el PDF firmado cuando la aprobación fue registrada fuera del sistema.',
                codigo='ADJUNTO_NO_PERMITIDO',
            )
        if punto.tiene_pdf_firmado:
            raise ConflictoConCodigo(
                'El Punto de Cuenta ya tiene el PDF firmado adjunto.',
                codigo='PDF_FIRMADO_YA_ADJUNTO',
            )
        almacen.subir(pdf.clave, pdf.contenido, pdf.mime)
        try:
            nuevo = replace(
                punto,
                pdf_firmado_clave=pdf.clave, pdf_firmado_sha256=pdf.sha256,
                pdf_firmado_tamano=len(pdf.contenido),
            )
            return repo.guardar_punto_cuenta_ingreso(nuevo)
        except Exception:
            _borrar_si_existe(almacen, pdf.clave)
            raise


def obtener_pdf_firmado(
    repo: RepoPostulacion, *, expediente_id: str,
) -> tuple[PuntoCuentaIngreso, str]:
    """El Punto de Cuenta con su PDF firmado y el número del expediente, para servir la descarga."""
    exp = obtener_expediente(repo, expediente_id)
    punto = repo.obtener_punto_cuenta_ingreso(exp.id)
    if punto is None or not punto.tiene_pdf_firmado:
        raise NotFoundError('El expediente no tiene el PDF del Punto de Cuenta firmado adjunto.')
    return punto, exp.numero
