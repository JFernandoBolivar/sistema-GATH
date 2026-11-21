"""Puertos de persistencia y de lectura externa del módulo postulacion. Sin Django."""
from contextlib import AbstractContextManager
from typing import Protocol

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import EmpleadoPrevio, Postulante, TransicionRegistrada


class RepoPostulacion(Protocol):
    def transaccion(self) -> AbstractContextManager:
        """Bloque atómico: todo lo que ocurra dentro se confirma o se revierte junto."""
        ...

    def obtener_postulante_por_cedula(self, cedula: str, bloquear: bool = False) -> Postulante | None: ...

    def crear_postulante(self, postulante: Postulante) -> Postulante: ...

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


class BuscadorEmpleados(Protocol):
    def por_cedula(self, cedula: str) -> EmpleadoPrevio | None:
        """El `Employee` existente con esa cédula (reingreso, C-1), o None."""
        ...
