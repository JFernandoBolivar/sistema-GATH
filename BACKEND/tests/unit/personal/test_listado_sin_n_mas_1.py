"""El mapper del listado lee `nacionalidad`: debe venir con select_related (era 1 query por empleado, ~11 s para 870)."""
import inspect

from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM


def test_listar_empleados_precarga_nacionalidad():
    fuente = inspect.getsource(RepoPersonalORM.listar_empleados)
    assert "select_related('sexoid', 'estadoCivil', 'nacionalidad')" in fuente
