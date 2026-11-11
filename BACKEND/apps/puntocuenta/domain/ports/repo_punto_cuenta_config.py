"""Puertos de persistencia de Punto de Cuenta (A2-01/A2-02). Sin Django."""
from typing import Protocol


class RepoSecuenciaPuntoCuenta(Protocol):
    def siguiente(self, anio: int) -> int:
        """Incrementa atómicamente la secuencia del año y devuelve el nuevo número."""
        ...


class RepoConfiguracionPuntoCuenta(Protocol):
    def actual(self):
        """Configuración vigente (la de mayor versión) o ``None``."""
        ...

    def crear_version(self, campos: dict) -> object:
        """Crea una nueva versión con los campos ya calculados por el caso de uso."""
        ...

    def guardar_generar(self, generar: bool, usuario_id: int | None) -> None:
        """Actualiza el parámetro general ``puntocuenta.generar``."""
        ...
