"""Bindings de permisos de la fe de vida: códigos `fe_de_vida.*` (nunca nombres de rol) y condición PASIVO."""
from rest_framework.permissions import IsAuthenticated

from apps.fe_de_vida.domain.value_objects.estados import CONDICION_PASIVO
from core.presentation.permissions import HasPermission, RequiereCondicion

SOLICITAR = 'fe_de_vida.solicitar'
VER_PROPIA = 'fe_de_vida.ver_propia'
REVISAR = 'fe_de_vida.revisar'
CHECK_ANALISTA = 'fe_de_vida.check_analista'
CHECK_ADMINISTRADORA = 'fe_de_vida.check_administradora'
APROBAR_DIRECTO = 'fe_de_vida.aprobar_directo'
VER_EVIDENCIA = 'fe_de_vida.ver_evidencia'
VERIFICAR_CONSTANCIA = 'fe_de_vida.verificar_constancia'
VER_PANEL = 'fe_de_vida.ver_panel'
GESTIONAR_PROCESOS = 'fe_de_vida.gestionar_procesos'
PRORROGAR = 'fe_de_vida.prorrogar'
VER_COBERTURA = 'fe_de_vida.ver_cobertura'


def permisos_pasivo(codigo: str) -> list:
    """Acciones del pasivo: sesión + permiso + condición PASIVO (calculada en el servidor)."""
    return [IsAuthenticated, HasPermission(codigo), RequiereCondicion(CONDICION_PASIVO)]


def permisos_bienestar(*codigos: str) -> list:
    """Acciones de Bienestar: sesión + cualquiera de los permisos indicados."""
    permiso = HasPermission(codigos[0])
    for codigo in codigos[1:]:
        permiso = permiso | HasPermission(codigo)
    return [IsAuthenticated, permiso]
