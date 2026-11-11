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

    def contar_registros(self, cedula: str, entidad: str) -> int:
        """Cuántos registros de `entidad` tiene hoy el trabajador (límite de contactos, etc.)."""
        ...

    def validar_referencias(self, valores: dict) -> None:
        """Lanza `ValidationError` si algún `*_id` no existe en su catálogo."""
        ...

    def es_parentesco_hijo(self, parentesco_id) -> bool:
        """Si el parentesco corresponde a un hijo(a): exige partida de nacimiento."""
        ...

    def validar_familiar_alta(self, cedula: str, valores: dict) -> str | None:
        """Alta de familiar: cédula obligatoria salvo hijo(a) menor de 9 años.

        Reutiliza la regla del módulo de familiares (cédula del titular + orden).
        Lanza `ValidationError` con `campo='cedula_familiar'`. **No modifica
        `valores`**: devuelve la cédula que se generará al aprobar (o `None` si el
        familiar trae la suya); la revisión la calcula para mostrarla.
        """
        ...

    def validar_familiar_cambio(self, cedula: str, entidad_id: str, valores: dict) -> None:
        """Valida las reglas del parentesco sobre el estado final de un familiar editado.

        Recibe solo los campos que cambian y completa el resto con el registro actual.
        Lanza `ValidationError` con el campo legible correspondiente.
        """
        ...

    def validar_correo_alternativo(self, cedula: str, correo_alternativo: str) -> None:
        """Valida que el correo alternativo propuesto sea único y distinto del propio institucional."""
        ...

    def es_pais_venezuela(self, pais_id: int | None) -> bool:
        """Si el país indicado es Venezuela (o no se indicó, que equivale al país por defecto)."""
        ...


class AplicadorCambios(Protocol):
    def aplicar(self, cedula: str, cambios: list[CambioPropuesto], soportes: list[SoporteDocumental], actor_cedula: str) -> None:
        """
        Escribe SOLO los cambios aprobados en los datos reales. Debe invocarse dentro de la
        transacción de la decisión (todo o nada) y tomar el lock de la fila del trabajador.
        """
        ...
