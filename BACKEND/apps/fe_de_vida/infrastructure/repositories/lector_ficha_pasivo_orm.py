"""
Ficha del pasivo para la revisión de Bienestar (solo lectura): reutiliza el portal del trabajador de
autogestión (mismo contrato `empleado` / `familiares` / `datos_complementarios` que `mi-expediente`) y
entrega solo lo que el evaluador necesita, sin salud, formación, carnets ni foto.
"""
from apps.autogestion.infrastructure.repositories.repo_portal_trabajador_orm import RepoPortalTrabajadorORM
from apps.familiares.presentation.serializers.familiares_serializers import FamiliarSerializer
from apps.personal.presentation.serializers.personal_serializers import EmpleadoSerializer
from core.domain.exceptions import NotFoundError

CAMPOS_EMPLEADO = (
    'cedula', 'nombres', 'apellidos', 'nombre_completo', 'sexo_nombre', 'fecha_nacimiento', 'correo',
    'telefono_movil', 'telefono_habitacion', 'datos_vivienda', 'contacto_emergencia', 'antecedentes', 'asignaciones',
)
CAMPOS_ASIGNACION = (
    'id', 'denominacion_cargo', 'denominacion_cargo_especifico', 'tipo_nomina', 'dependencia', 'direccion_general',
    'direccion_linea', 'coordinacion', 'estatus',
)
CAMPOS_FAMILIAR = (
    'id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'cedula_familiar',
    'parentesco_id', 'parentesco_nombre', 'fecha_nacimiento', 'sexo_nombre',
)


def _recortar(origen: dict, campos: tuple[str, ...]) -> dict:
    return {c: origen.get(c) for c in campos}


class LectorFichaPasivoORM:
    def ficha(self, cedula: str) -> dict:
        portal = RepoPortalTrabajadorORM()
        empleado = portal.obtener_empleado(cedula)
        if empleado is None:
            raise NotFoundError("No existe el expediente del trabajador.")
        datos = dict(EmpleadoSerializer(empleado).data)
        recortado = _recortar(datos, CAMPOS_EMPLEADO)
        recortado['asignaciones'] = [_recortar(dict(a), CAMPOS_ASIGNACION) for a in datos.get('asignaciones') or []]
        complementarios = portal.obtener_datos_complementarios(cedula)
        return {
            'empleado': recortado,
            'familiares': [
                _recortar(dict(f), CAMPOS_FAMILIAR) for f in FamiliarSerializer(portal.listar_familiares(cedula), many=True).data
            ],
            'datos_complementarios': {
                'correo_alternativo': getattr(complementarios, 'correo_alternativo', None),
                'tiene_hijos': getattr(complementarios, 'tiene_hijos', None),
            },
        }
