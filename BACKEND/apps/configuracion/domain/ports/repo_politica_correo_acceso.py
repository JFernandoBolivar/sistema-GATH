"""Puerto del repositorio de la Política de Correo de Acceso (A7). Sin Django."""
from typing import Protocol, Sequence

from apps.configuracion.domain.correo_acceso import PoliticaCorreoAcceso


class RepoPoliticaCorreoAcceso(Protocol):
    def obtener_politica(self) -> PoliticaCorreoAcceso:
        """Política vigente o la de por defecto si aún no hay fila."""
        ...

    def actualizar_politica(
        self, datos: dict, actor_id: int | None = None,
    ) -> tuple[PoliticaCorreoAcceso, PoliticaCorreoAcceso]:
        """Devuelve (anterior, nueva) tras persistir los campos enviados."""
        ...

    def listar_trabajadores_por_grupo(self, grupo: str) -> Sequence:
        """Trabajadores del grupo (activos, pasivos o todos) con sus correos."""
        ...

    def correo_en_uso_por_otro(self, cedula: str, correo: str) -> bool:
        ...

    def aplicar_correo_a_empleado(self, cedula: str, nuevo_correo: str) -> None:
        ...
