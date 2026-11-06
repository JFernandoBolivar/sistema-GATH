"""
Repositorios ORM del catálogo de secciones autogestionables y de la tabla complementaria (B13).
"""
from apps.autogestion.domain.entities.solicitud_actualizacion import DatosComplementarios, SeccionAutogestionable
from apps.autogestion.infrastructure.mappers.mapper_solicitudes import (
    complementarios_a_entidad,
    seccion_a_entidad,
)
from apps.autogestion.infrastructure.models.actualizacion_models import (
    DatosComplementariosTrabajadorModel,
    SeccionAutogestionableModel,
)


class RepoSeccionesORM:
    def listar(self, solo_activas: bool = True) -> list[SeccionAutogestionable]:
        qs = SeccionAutogestionableModel.objects.all()
        if solo_activas:
            qs = qs.filter(activa=True)
        return [seccion_a_entidad(m) for m in qs]

    def obtener(self, codigo: str) -> SeccionAutogestionable | None:
        m = SeccionAutogestionableModel.objects.filter(codigo=codigo).first()
        return seccion_a_entidad(m) if m else None

    def guardar(self, seccion: SeccionAutogestionable) -> SeccionAutogestionable:
        m, _ = SeccionAutogestionableModel.objects.update_or_create(
            codigo=seccion.codigo,
            defaults={'nombre': seccion.nombre, 'requiere_soporte': seccion.requiere_soporte, 'activa': seccion.activa},
        )
        return seccion_a_entidad(m)


class RepoDatosComplementariosORM:
    def obtener(self, cedula: str) -> DatosComplementarios | None:
        m = DatosComplementariosTrabajadorModel.objects.filter(cedula=cedula).first()
        return complementarios_a_entidad(m) if m else None

    def guardar(self, cedula: str, campos: dict, actor_cedula: str) -> DatosComplementarios:
        validos = {k: v for k, v in campos.items() if k in ('correo_alternativo', 'tiene_hijos')}
        alt_propuesto = (validos.get('correo_alternativo') or '').strip().lower()
        actual_obj = DatosComplementariosTrabajadorModel.objects.filter(cedula=cedula).first()
        correo_actual = (actual_obj.correo_alternativo or '').strip().lower() if actual_obj else ''
        if alt_propuesto and alt_propuesto != correo_actual:
            from apps.personal.infrastructure.models.personal_models import EmployeeModel
            propio = EmployeeModel.objects.filter(cedulaidentidad=cedula).values_list('correo', flat=True).first()
            if propio and propio.strip().lower() == alt_propuesto:
                from core.domain.exceptions import BusinessRuleError
                raise BusinessRuleError("El correo alternativo debe ser distinto del institucional.", campo="correo_alternativo")
            if EmployeeModel.objects.filter(correo__iexact=alt_propuesto).exists():
                from core.domain.exceptions import BusinessRuleError
                raise BusinessRuleError("El correo alternativo ya está en uso como correo institucional.", campo="correo_alternativo")
            if DatosComplementariosTrabajadorModel.objects.filter(correo_alternativo__iexact=alt_propuesto).exclude(cedula=cedula).exists():
                from core.domain.exceptions import BusinessRuleError
                raise BusinessRuleError("El correo alternativo ya está en uso por otro trabajador.", campo="correo_alternativo")

        m, _ = DatosComplementariosTrabajadorModel.objects.update_or_create(
            cedula=cedula, defaults={**validos, 'actualizado_por': actor_cedula},
        )
        return complementarios_a_entidad(m)
