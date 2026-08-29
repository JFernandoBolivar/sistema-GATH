"""
Caso de uso `registrar_usuario` (alta de cuenta).

Cierra CRIT-05: en el legado (`USER/views/user_views.py::register_view`) este
alta es `AllowAny` sin ninguna verificación de permiso, así que cualquiera
—incluso sin sesión— podía crearse una cuenta propia con el rol que
quisiera (incluido `ADMINISTRADOR`). Aquí el cierre real ocurre en la vista
(`IsAuthenticated` + `HasPermission('identidad.crear_usuarios')`, B3.2); este
caso de uso solo impone la regla de negocio de unicidad: una cédula no puede
tener dos cuentas. Puro: recibe el puerto por inyección (B4/B21).
"""
from apps.identidad.application.dtos.cuenta_dto import RegistrarCuentaDTO
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from core.domain.exceptions import ConflictError


def registrar_usuario(repo: RepoCuentas, dto: RegistrarCuentaDTO) -> Cuenta:
    """Da de alta una cuenta nueva. Rechaza cédulas que ya poseen una (409)."""
    if repo.existe_cuenta_para_cedula(dto.cedula):
        raise ConflictError(
            f"El empleado con cédula '{dto.cedula}' ya posee una cuenta de usuario."
        )
    return repo.crear(
        cedula=dto.cedula,
        password=dto.password,
        departamento_id=dto.departamento_id,
        rol_id=dto.rol_id,
    )
