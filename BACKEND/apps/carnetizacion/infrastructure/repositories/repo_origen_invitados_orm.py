"""Consulta de trabajadores y credenciales externas registrados para invitarlos a un evento."""
from typing import Any

from django.db.models import Q

from apps.carnetizacion.domain.entities.persona_origen import (
    TIPO_EXTERNO,
    TIPO_TRABAJADOR,
    PersonaOrigen,
)
from apps.carnetizacion.domain.ports.repo_origen_invitados import RepoOrigenInvitadosPort
from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
    CredencialExternaModel,
)
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.catalogos import ESTATUS_ACTIVO, TIPO_PERSONAL_PASIVO


class RepoOrigenInvitadosORM(RepoOrigenInvitadosPort):
    # ─── Trabajadores ───
    @staticmethod
    def _qs_personal(poblacion: str, dependencia_id: int | None, busqueda: str):
        qs = EmployeeModel.objects.all()
        pasivos_asig = AsigTrabajoModel.objects.filter(
            Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO
        ).values('employee_id')
        egresados = EmployeeEgresadoModel.objects.values('employee_id')
        es_pasivo = Q(cedulaidentidad__in=pasivos_asig) | Q(cedulaidentidad__in=egresados)
        if poblacion == 'PASIVOS':
            qs = qs.filter(es_pasivo)
        elif poblacion == 'ACTIVOS':
            activos = AsigTrabajoModel.objects.filter(
                estatusid__estatus__iexact=ESTATUS_ACTIVO
            ).values('employee_id')
            qs = qs.filter(cedulaidentidad__in=activos).exclude(es_pasivo)
        if dependencia_id:
            en_dependencia = AsigTrabajoModel.objects.filter(
                Dependencia_id=dependencia_id
            ).values('employee_id')
            qs = qs.filter(cedulaidentidad__in=en_dependencia)
        term = (busqueda or '').strip()
        if term:
            qs = qs.filter(
                Q(cedulaidentidad__icontains=term)
                | Q(nombres__icontains=term)
                | Q(apellidos__icontains=term)
            )
        return qs.order_by('apellidos', 'nombres', 'pk')

    @staticmethod
    def _a_personas(empleados: list[Any]) -> list[PersonaOrigen]:
        """Arma las filas con una sola consulta de asignaciones (sin N+1)."""
        cedulas = [e.cedulaidentidad for e in empleados]
        asignaciones: dict[str, Any] = {}
        for asig in (
            AsigTrabajoModel.objects.filter(employee_id__in=cedulas)
            .select_related(
                'denominacioncargoid', 'denominacioncargoespecificoid',
                'Dependencia', 'estatusid', 'Tipo_personal',
            )
            .order_by('-pk')
        ):
            previa = asignaciones.get(asig.employee_id)
            vigente = (asig.estatusid.estatus or '').upper() == ESTATUS_ACTIVO if asig.estatusid_id else False
            if previa is None or (vigente and not previa[1]):
                asignaciones[asig.employee_id] = (asig, vigente)
        egresados = set(
            EmployeeEgresadoModel.objects.filter(employee_id__in=cedulas)
            .values_list('employee_id', flat=True)
        )
        personas = []
        for e in empleados:
            asig, vigente = asignaciones.get(e.cedulaidentidad, (None, False))
            cargo = dependencia = ''
            pasivo = e.cedulaidentidad in egresados
            if asig:
                cargo = (
                    (asig.denominacioncargoespecificoid.cargo if asig.denominacioncargoespecificoid_id else '')
                    or (asig.denominacioncargoid.cargo if asig.denominacioncargoid_id else '')
                )
                dependencia = asig.Dependencia.dependencia if asig.Dependencia_id else ''
                if asig.Tipo_personal_id and (
                    asig.Tipo_personal.tipo_personal or ''
                ).upper() == TIPO_PERSONAL_PASIVO.upper():
                    pasivo = True
            personas.append(PersonaOrigen(
                tipo=TIPO_TRABAJADOR,
                clave=str(e.cedulaidentidad),
                nombre=f"{e.nombres} {e.apellidos}".strip(),
                documento=str(e.cedulaidentidad),
                empleado_id=e.pk,
                cargo=cargo,
                dependencia=dependencia,
                condicion='Pasivo' if pasivo else ('Activo' if vigente else 'Sin asignación vigente'),
                foto_cedula=str(e.cedulaidentidad) if e.profile else '',
                correo=(e.correo or '').strip(),
                organizacion=dependencia,
            ))
        return personas

    def buscar_personal(self, poblacion, dependencia_id, busqueda, offset, limite):
        qs = self._qs_personal(poblacion, dependencia_id, busqueda)
        total = qs.count()
        return self._a_personas(list(qs[offset:offset + limite])), total

    def cedulas_personal(self, poblacion, dependencia_id, busqueda, tope):
        qs = self._qs_personal(poblacion, dependencia_id, busqueda)
        return list(qs.values_list('cedulaidentidad', flat=True)[:tope])

    def resolver_personal(self, cedulas, poblacion, dependencia_id, tope):
        if cedulas:
            qs = EmployeeModel.objects.filter(cedulaidentidad__in=cedulas[:tope]).order_by('pk')
        else:
            qs = self._qs_personal(poblacion, dependencia_id, '')
        return self._a_personas(list(qs[:tope]))

    # ─── Externos ───
    @staticmethod
    def _qs_externos(busqueda: str):
        qs = CredencialExternaModel.objects.select_related('tipo_credencial').order_by('nombre', 'pk')
        term = (busqueda or '').strip()
        if term:
            qs = qs.filter(
                Q(nombre__icontains=term) | Q(documento__icontains=term) | Q(empresa__icontains=term)
            )
        return qs

    @staticmethod
    def _a_externos(filas) -> list[PersonaOrigen]:
        return [
            PersonaOrigen(
                tipo=TIPO_EXTERNO,
                clave=str(c.pk),
                nombre=c.nombre,
                documento=c.documento,
                empleado_id=None,
                cargo=c.tipo_credencial.nombre if c.tipo_credencial_id else '',
                dependencia=c.empresa,
                condicion=c.get_estado_display(),
                correo=c.correo,
                organizacion=c.empresa,
            )
            for c in filas
        ]

    def buscar_externos(self, busqueda, offset, limite):
        qs = self._qs_externos(busqueda)
        return self._a_externos(qs[offset:offset + limite]), qs.count()

    def ids_externos(self, busqueda, tope):
        return [str(i) for i in self._qs_externos(busqueda).values_list('pk', flat=True)[:tope]]

    def resolver_externos(self, ids, tope):
        qs = self._qs_externos('').filter(pk__in=ids[:tope])
        return self._a_externos(qs)
