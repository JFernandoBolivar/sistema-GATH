"""
Resuelve destinatarios por PERMISO (no por nombre de rol) y el correo principal de una persona.

Adaptador de infraestructura: lee las tablas de identidad (matriz rol -> permiso, ajustes individuales,
cuentas) y de personal (correo). La regla de evaluación es la misma de `HasPermission`
(deny explícito > allow, con comodines `*` y `modulo.*`, vía `patrones_candidatos`).
"""
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.services.evaluador_permisos import patrones_candidatos
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.permiso_model import RolPermisoModel
from apps.identidad.infrastructure.models.usuario_permiso_model import UsuarioPermisoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class ResolutorDestinatariosORM:
    def cedulas_con_permiso(self, codigo_permiso: str) -> list[str]:
        codigo = codigo_permiso.strip().lower()
        candidatos = patrones_candidatos(codigo)
        roles = set(RolPermisoModel.objects.filter(permiso__codigo__in=candidatos).values_list('rol_id', flat=True))
        ajustes = {
            a.cedula: PoliticaAcceso.desde_dict(a.permisos_custom or {})
            for a in UsuarioPermisoModel.objects.exclude(permisos_custom={})
        }
        por_ajuste = {c for c, p in ajustes.items() if not p.allow.isdisjoint(candidatos)}
        activas = CuentaModel.objects.filter(is_active=True)
        por_rol = set(activas.filter(rol_id__in=roles).values_list('cedula_id', flat=True))
        extra = set(activas.filter(cedula_id__in=por_ajuste).values_list('cedula_id', flat=True))
        elegibles = []
        for cedula in sorted(por_rol | extra):
            politica = ajustes.get(cedula)
            if politica is not None and not politica.deny.isdisjoint(candidatos):
                continue  # denegación individual explícita
            elegibles.append(str(cedula))
        return elegibles

    def correo_de(self, cedula: str) -> str:
        correo = EmployeeModel.objects.filter(cedulaidentidad=cedula).values_list('correo', flat=True).first()
        return (correo or '').strip()

