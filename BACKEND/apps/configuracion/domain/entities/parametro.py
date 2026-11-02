"""Entidades del dominio de parámetros del sistema (D9). Sin Django."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ParametroSistema:
    clave: str
    etiqueta: str
    descripcion: str
    grupo: str
    tipo: str
    valor: str
    defecto: str
    minimo: int | None
    maximo: int | None
    actualizado_por_id: int | None = None
    actualizado_en: str | None = None


@dataclass(frozen=True)
class CambioParametro:
    fecha: str
    actor_cedula: str
    valor_previo: str
    valor_nuevo: str
    resultado: str = 'SUCCESS'
