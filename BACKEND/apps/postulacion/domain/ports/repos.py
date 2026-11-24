"""Puertos de persistencia y de lectura externa del módulo postulacion. Sin Django."""
from contextlib import AbstractContextManager
from typing import Callable, Protocol

from datetime import date, datetime

from apps.postulacion.domain.entities.bandeja import FilaBandeja, FiltrosBandeja, PropuestaCatalogo
from apps.postulacion.domain.entities.constancia import ConstanciaPresupuestaria
from apps.postulacion.domain.entities.credencial import CredencialPostulante
from apps.postulacion.domain.entities.enlace_activacion import EnlaceActivacion
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.promocion import ResultadoPromocion, SolicitudPromocion
from apps.postulacion.domain.entities.postulante import EmpleadoPrevio, Postulante, TransicionRegistrada
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.entities.punto_cuenta_ingreso import (
    PuntoCuentaEmitido,
    PuntoCuentaIngreso,
    SolicitudPuntoCuentaIngreso,
)
from apps.postulacion.domain.entities.reserva import ReservaPuesto
from apps.postulacion.domain.entities.vacantes import FiltroVacantes, PuestoVacante
from core.domain.paginacion import Paginacion


class RepoPostulacion(Protocol):
    def transaccion(self) -> AbstractContextManager:
        """Bloque atómico: todo lo que ocurra dentro se confirma o se revierte junto."""
        ...

    def al_confirmar(self, accion: Callable[[], None]) -> None:
        """Ejecuta `accion` DESPUÉS de confirmar la transacción vigente (y nunca si se revierte)."""
        ...

    def obtener_postulante_por_cedula(self, cedula: str, bloquear: bool = False) -> Postulante | None: ...

    def crear_postulante(self, postulante: Postulante) -> Postulante: ...

    def guardar_postulante(self, postulante: Postulante) -> Postulante:
        """Actualiza nombres, apellidos, correo y teléfono (la cédula no cambia)."""
        ...

    def vincular_empleado(self, postulante_id: str, employee_cedula: str) -> Postulante: ...

    def obtener_postulante(self, postulante_id: str) -> Postulante | None: ...

    def tiene_expediente_abierto(self, postulante_id: str) -> bool: ...

    def crear_expediente(self, expediente: ExpedientePostulacion) -> ExpedientePostulacion:
        """Asigna el número `EXP-AAAA-NNNNN`. Lanza `ConflictError` si ya hay un expediente abierto."""
        ...

    def obtener_expediente(self, expediente_id: str, bloquear: bool = False) -> ExpedientePostulacion | None: ...

    def guardar_expediente(self, expediente: ExpedientePostulacion) -> ExpedientePostulacion: ...

    def registrar_transicion(self, transicion: TransicionRegistrada) -> TransicionRegistrada: ...

    def listar_transiciones(self, expediente_id: str) -> list[TransicionRegistrada]: ...

    def listar_bandeja(self, filtros: FiltrosBandeja, paginacion: Paginacion) -> tuple[list[FilaBandeja], int]:
        """Página de la bandeja y el total. Orden: pendientes de Captación primero y luego los más antiguos."""
        ...

    # --- vencimientos del sistema (E-7) ---
    def listar_ids_con_ventana_vencida(self, ahora: datetime) -> list[str]:
        """Expedientes PRE_REGISTRADO o EN_CAPTURA cuya ventana venció."""
        ...

    def listar_ids_con_diferido_vencido(self, ahora: datetime) -> list[str]:
        """Expedientes DIFERIDO_PRESUPUESTO cuya espera (`diferido_vence_el`) venció."""
        ...

    def listar_ids_con_contacto_atrasado(self, limite: datetime) -> list[str]:
        """Expedientes en CONSOLIDANDO con el contacto al postulante pendiente desde antes de `limite` (G-1)."""
        ...

    # --- test psicofísico (uno por expediente) ---
    def obtener_psicofisico(self, expediente_id: str, bloquear: bool = False) -> ResultadoPsicofisico | None: ...

    def guardar_psicofisico(self, resultado: ResultadoPsicofisico) -> ResultadoPsicofisico:
        """Crea o reemplaza el resultado del expediente (uno solo)."""
        ...

    # --- reserva de puesto (E-2): una ACTIVA por puesto y una por expediente ---
    def obtener_reserva_activa_de_expediente(self, expediente_id: str, bloquear: bool = False) -> ReservaPuesto | None: ...

    def obtener_reserva_activa_de_puesto(self, puesto_id: int, bloquear: bool = False) -> ReservaPuesto | None: ...

    def crear_reserva(self, reserva: ReservaPuesto) -> ReservaPuesto:
        """Lanza `ConflictoConCodigo` (PUESTO_RESERVADO) si el constraint de una ACTIVA por puesto/expediente salta."""
        ...

    def guardar_reserva(self, reserva: ReservaPuesto) -> ReservaPuesto:
        """Actualiza estado, vencimiento, motivo y fecha de cierre de una reserva existente."""
        ...

    def listar_reservas_vencidas(self, ahora: datetime) -> list[ReservaPuesto]:
        """Reservas ACTIVAS con `vence_el` anterior a `ahora`."""
        ...

    def reservas_activas_de(self, expediente_ids: list[str]) -> dict[str, ReservaPuesto]: ...

    # --- constancia presupuestaria (E-3): una por expediente ---
    def obtener_constancia(self, expediente_id: str, bloquear: bool = False) -> ConstanciaPresupuestaria | None: ...

    def guardar_constancia(self, constancia: ConstanciaPresupuestaria) -> ConstanciaPresupuestaria:
        """Crea o reemplaza la constancia del expediente (una sola)."""
        ...

    def constancias_de(self, expediente_ids: list[str]) -> dict[str, ConstanciaPresupuestaria]: ...

    # --- Punto de Cuenta de ingreso (E-5): uno por expediente ---
    def obtener_punto_cuenta_ingreso(self, expediente_id: str, bloquear: bool = False) -> PuntoCuentaIngreso | None: ...

    def guardar_punto_cuenta_ingreso(self, enlace: PuntoCuentaIngreso) -> PuntoCuentaIngreso:
        """Crea o reemplaza el enlace del expediente (uno solo)."""
        ...

    def puntos_cuenta_de(self, expediente_ids: list[str]) -> dict[str, PuntoCuentaIngreso]: ...

    # --- credencial del postulante (una por expediente) ---
    def obtener_credencial_por_usuario(self, usuario: str) -> CredencialPostulante | None:
        """La credencial no revocada del expediente ABIERTO de esa cédula, o None."""
        ...

    def obtener_credencial_de_expediente(
        self, expediente_id: str, bloquear: bool = False,
    ) -> CredencialPostulante | None: ...

    def guardar_credencial(self, credencial: CredencialPostulante) -> CredencialPostulante:
        """Crea o reemplaza la credencial del expediente (una sola por expediente)."""
        ...

    # --- enlace de activación del postulante (D-10): solo el hash del token ---
    def crear_enlace_activacion(self, enlace: EnlaceActivacion) -> EnlaceActivacion: ...

    def obtener_enlace_por_hash(self, token_hash: str, bloquear: bool = False) -> EnlaceActivacion | None: ...

    def guardar_enlace_activacion(self, enlace: EnlaceActivacion) -> EnlaceActivacion:
        """Actualiza intentos, uso y revocación de un enlace existente."""
        ...

    def revocar_enlaces_pendientes(self, expediente_id: str) -> int:
        """Anula los enlaces sin usar del expediente (reenvío o entrega en persona). Devuelve cuántos."""
        ...

    def ultimo_enlace_de_expediente(self, expediente_id: str) -> EnlaceActivacion | None: ...


class HasheadorClaves(Protocol):
    """Hash de contraseñas con el hasher del framework; la contraseña jamás se guarda ni se registra en claro."""

    def hashear(self, clave: str) -> str: ...

    def verificar(self, clave: str, clave_hash: str) -> bool: ...

    def verificar_ficticio(self, clave: str) -> None:
        """Gasta lo mismo que `verificar` cuando la cédula no existe (tiempo constante, sin enumeración)."""
        ...


class BuscadorEmpleados(Protocol):
    def por_cedula(self, cedula: str) -> EmpleadoPrevio | None:
        """El `Employee` existente con esa cédula (reingreso, C-1), o None."""
        ...


class CatalogoPropuesta(Protocol):
    """Lectura de los catálogos de cargos, nómina y organización (tablas heredadas, sin FK desde las nuevas)."""

    def errores_de_propuesta(self, ids: PropuestaCatalogo) -> dict[str, str]:
        """`{campo: mensaje}` de los ids que no existen o no encajan en la jerarquía; vacío si todo es válido."""
        ...

    def nombres_de_propuesta(self, ids: PropuestaCatalogo) -> dict[str, str]:
        """`{cargo, cargo_especifico, tipo_nomina, dependencia, direccion_general, direccion_linea, coordinacion}` con
        el nombre de cada id presente (para mostrar la propuesta en Presupuesto)."""
        ...


class PuestosVacantes(Protocol):
    """Lectura de los puestos de trabajo (módulo cargos, tabla heredada): la misma noción de «vacante» de Cargos."""

    def listar_vacantes(self, filtro: FiltroVacantes, paginacion: Paginacion) -> tuple[list[PuestoVacante], int]:
        """Puestos vacantes que cumplen el filtro, SIN los reservados (ACTIVA) por otro expediente."""
        ...

    def obtener_puesto(self, puesto_id: int, bloquear: bool = False) -> PuestoVacante | None:
        """Un puesto por id (con `select_for_update` si `bloquear`), vacante o no; None si no existe."""
        ...


class EmisorPuntoCuenta(Protocol):
    """Genera el Punto de Cuenta de ingreso en `apps.puntocuenta` (correlativo, registro y PDF) y lo guarda en el almacén."""

    def emitir_ingreso(self, datos: SolicitudPuntoCuentaIngreso) -> PuntoCuentaEmitido: ...

    def descartar(self, punto_cuenta_id: str, pdf_clave: str) -> None:
        """Compensación: borra el objeto del almacén si la transacción del expediente se revierte."""
        ...


class CatalogosVentana2(Protocol):
    """Catálogos y comprobaciones de la Ventana 2 contra las tablas de personal, familiares y catálogos (sin FK)."""

    def catalogos(self, estado_id: int | None = None, municipio_id: int | None = None) -> dict:
        """Opciones del formulario. Los municipios solo si llega `estado_id`; las parroquias solo si llega `municipio_id`."""
        ...

    def errores(
        self, datos: dict, *, cedula_titular: str, fecha_nacimiento_titular: date | None, hoy: date, completo: bool,
    ) -> dict[str, str]:
        """
        `{ruta: mensaje}` de lo que no cuadra con los catálogos: ids inexistentes, jerarquía estado > municipio >
        parroquia, parentesco no permitido y (si `completo`) las reglas del familiar (edad, sexo, cédula o hijo sin cédula).
        """
        ...

    def legible(self, datos: dict) -> dict:
        """Los mismos datos con el nombre de cada catálogo junto al id, para que Captación los lea."""
        ...


class PromotorEmpleado(Protocol):
    """
    Da de alta al trabajador desde el expediente: Employee (o el existente en un reingreso), sus datos, su puesto, el
    movimiento INGRESO y su cuenta. Lo implementa `infrastructure` invocando los casos de uso de personal, familiares,
    cargos, movimientos e identidad. NO abre transacción: corre dentro de la del caso de uso (todo o nada).
    """

    def promover(self, solicitud: SolicitudPromocion) -> ResultadoPromocion: ...
