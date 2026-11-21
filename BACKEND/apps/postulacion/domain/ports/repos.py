"""Puertos de persistencia y de lectura externa del módulo postulacion. Sin Django."""
from contextlib import AbstractContextManager
from typing import Callable, Protocol

from apps.postulacion.domain.entities.bandeja import FilaBandeja, FiltrosBandeja, PropuestaCatalogo
from apps.postulacion.domain.entities.credencial import CredencialPostulante
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import EmpleadoPrevio, Postulante, TransicionRegistrada
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
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

    # --- test psicofísico (uno por expediente) ---
    def obtener_psicofisico(self, expediente_id: str, bloquear: bool = False) -> ResultadoPsicofisico | None: ...

    def guardar_psicofisico(self, resultado: ResultadoPsicofisico) -> ResultadoPsicofisico:
        """Crea o reemplaza el resultado del expediente (uno solo)."""
        ...

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
