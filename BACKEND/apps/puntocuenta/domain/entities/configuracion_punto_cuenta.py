"""Configuración vigente del Punto de Cuenta como entidad de dominio (puro, sin Django)."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ConfiguracionPuntoCuenta:
    """Versión vigente de la plantilla y los procesos habilitados del punto de cuenta.

    El adaptador ORM la construye desde la fila; `application` nunca ve el modelo.
    """

    procesos_habilitados: dict = field(default_factory=dict)
    titulo: str = ''
    encabezado: str = ''
    cuerpo: str = ''
    firmas: list = field(default_factory=list)
    mostrar_nivel: bool = True
    plantillas_procesos: dict = field(default_factory=dict)
    version: int = 1
    actualizado_por_id: int | None = None
