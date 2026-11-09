"""El mapper del listado lee `nacionalidad`: debe venir con select_related (era 1 query por empleado, ~11 s para 870)."""
import inspect

from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM


def test_listar_empleados_precarga_nacionalidad():
    # El QuerySet se construye en `_filtrar_empleados`, que comparten el
    # listado simple y el paginado.
    fuente = inspect.getsource(RepoPersonalORM._filtrar_empleados)
    assert "select_related('sexoid', 'estadoCivil', 'nacionalidad')" in fuente
