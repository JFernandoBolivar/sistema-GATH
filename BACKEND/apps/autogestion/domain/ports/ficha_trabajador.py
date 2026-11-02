"""
Puertos hacia los datos reales del trabajador (módulos `personal` y `familiares`).

Autogestión no importa esos módulos (B16): declara aquí lo que necesita y la infraestructura
lo implementa sobre los repositorios de ellos. Las tablas del trabajador son legadas: solo se
escriben al aprobar, vía `AplicadorCambios`.
"""
from typing import Any, Protocol

from apps.autogestion.domain.entities.solicitud_actualizacion import CambioPropuesto, SoporteDocumental


class LectorFicha(Protocol):
    def valor_actual(self, cedula: str, entidad: str, entidad_id: str | None, campo: str) -> Any:
        """Valor vigente en la ficha (None si no existe). Para CREAR se usa `campo='*'` -> None."""
        ...

    def pertenece_al_trabajador(self, cedula: str, entidad: str, entidad_id: str | None) -> bool:
        """Zero-IDOR: el registro `entidad_id` (familiar, formación, contacto) es de esta cédula."""
        ...

    def existe_registro_unico(self, cedula: str, entidad: str) -> bool:
        """Para `datos_vivienda`: si ya existe el registro del trabajador (MODIFICAR) o hay que CREAR."""
        ...

    def validar_referencias(self, valores: dict) -> None:
        """Lanza `ValidationError` si algún `*_id` no existe en su catálogo."""
        ...


class AplicadorCambios(Protocol):
    def aplicar(self, cedula: str, cambios: list[CambioPropuesto], soportes: list[SoporteDocumental], actor_cedula: str) -> None:
        """
        Escribe SOLO los cambios aprobados en los datos reales. Debe invocarse dentro de la
        transacción de la decisión (todo o nada) y tomar el lock de la fila del trabajador.
        """
        ...
