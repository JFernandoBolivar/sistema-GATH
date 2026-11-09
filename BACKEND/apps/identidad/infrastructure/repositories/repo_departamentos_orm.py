"""
Repositorio ORM de departamentos (catálogo administrativo, D-09/B21).

Implementa el puerto `domain/ports/repo_departamentos.py` sobre
`DepartamentoModel` (`db_table='USER_departaments'`, R7).
"""
from apps.identidad.domain.entities.departamento import Departamento
from apps.identidad.infrastructure.models.cuenta_models import DepartamentoModel


class RepoDepartamentosORM:
    """Lectura del catálogo de departamentos (`USER_departaments`)."""

    def listar(self) -> list[Departamento]:
        return [
            Departamento(
                id=fila.pk,
                nombre=fila.nombre_departamento,
                descripcion=fila.descripcion_departamento or '',
            )
            for fila in DepartamentoModel.objects.all()
        ]
