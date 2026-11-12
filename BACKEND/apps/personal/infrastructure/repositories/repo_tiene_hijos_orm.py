"""
Adaptador ORM del puerto `RepoTieneHijos`: reutiliza los datos complementarios de autogestión.
"""
from apps.autogestion.infrastructure.repositories.repo_secciones_complementarios_orm import (
    RepoDatosComplementariosORM,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class RepoTieneHijosORM:
    def __init__(self) -> None:
        self._complementarios = RepoDatosComplementariosORM()

    def existe_trabajador(self, cedula: str) -> bool:
        return EmployeeModel.objects.filter(cedulaidentidad=cedula).exists()

    def obtener(self, cedula: str) -> bool | None:
        datos = self._complementarios.obtener(cedula)
        return datos.tiene_hijos if datos else None

    def guardar(self, cedula: str, valor: bool | None, actor_cedula: str) -> bool | None:
        return self._complementarios.guardar(cedula, {'tiene_hijos': valor}, actor_cedula).tiene_hijos
