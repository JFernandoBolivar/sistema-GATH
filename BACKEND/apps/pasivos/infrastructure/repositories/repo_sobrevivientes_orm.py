"""
Repositorio ORM del alta de pensionados por sobrevivencia (C20; D-09).

Supuestos (el legado `RAC/services/egreso_services.py` no está en el repo):
  - "Fallecido" = el titular tiene un `EmployeeEgresado` cuyo motivo
    (`TipoMovimiento.movimiento`) contiene "FALLEC".
  - El `Employee` del beneficiario toma cédula, nombres, apellidos, fecha de
    nacimiento y sexo del `Employeefamily`; nacionalidad por defecto del modelo.
  - Se copian perfil de salud (con alergias/patologías/discapacidades), perfil
    físico y formación académica del familiar. La formación complementaria no
    tiene vínculo a familiares y no se copia.
  - La asignación PASIVO hereda denominación de cargo/organismo de la última
    asignación del titular (o de su `CargoEgresado`). No existe columna de
    "tipo de pensión" en el esquema legado: el vínculo con el titular y el tipo
    `PENSION_SOBREVIVIENTE` se guardan en `AsigTrabajo.observaciones`.
  - Idempotencia por cédula del familiar: si ya es pasivo no se duplica; si es
    un empleado con otra condición se rechaza con `ConflictError`.
"""
from django.db import transaction

from apps.cargos.domain import events
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.organizacion.infrastructure.models.organizacion_models import DireccionGeneralModel
from apps.pasivos.domain.entities.sobreviviente import (
    FamiliarBeneficiario,
    ResultadoAltaSobreviviente,
)
from apps.pasivos.infrastructure.codigo_pasivo import generar_codigo_pasivo
from apps.pasivos.infrastructure.models.pasivo_models import (
    CargoEgresadoModel,
    EmployeeEgresadoModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    FormacionAcademicaModel,
    PerfilFisicoModel,
    PerfilSaludAlergias,
    PerfilSaludDiscapacidad,
    PerfilSaludModel,
    PerfilSaludPatologia,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError


def _unir(*partes: str | None) -> str:
    return ' '.join(p.strip() for p in partes if p and p.strip())


class RepoSobrevivientesORM:
    def resolver_tipo_nomina_sobrevivencia(self, tipo_nomina_id: int | None) -> int:
        if tipo_nomina_id is None:
            nomina = TipoNominaModel.objects.filter(nomina__icontains='SOBREVIV').order_by('pk').first()
            if not nomina:
                raise ValidationError(
                    'No existe en el catálogo una nómina de pensionados por sobrevivencia.')
            return nomina.pk
        nomina = TipoNominaModel.objects.filter(pk=tipo_nomina_id).first()
        if not nomina:
            raise NotFoundError(f'Tipo de nómina {tipo_nomina_id} no encontrado.')
        if 'SOBREVIV' not in nomina.nomina.upper():
            raise ValidationError(
                f'La nómina "{nomina.nomina}" no es de pensión por sobrevivencia.')
        return nomina.pk

    def titular_fallecido(self, cedula_titular: str) -> bool:
        return EmployeeEgresadoModel.objects.filter(
            employee_id=cedula_titular, motivo_egreso__movimiento__icontains='fallec'
        ).exists()

    def listar_familiares_beneficiarios(
        self, cedula_titular: str, familiar_ids: tuple[int, ...] | None = None
    ) -> list[FamiliarBeneficiario]:
        qs = EmployeefamilyModel.objects.filter(employeecedula_id=cedula_titular)
        qs = qs.filter(pk__in=familiar_ids) if familiar_ids else qs.filter(heredero=True)
        return [
            FamiliarBeneficiario(
                id=f.pk,
                cedula=(f.cedulaFamiliar or '').strip() or None,
                nombres=_unir(f.primer_nombre, f.segundo_nombre),
                apellidos=_unir(f.primer_apellido, f.segundo_apellido),
                heredero=f.heredero,
            )
            for f in qs.order_by('pk')
        ]

    @transaction.atomic
    def crear_pasivo_sobreviviente(
        self,
        cedula_titular: str,
        familiar_id: int,
        tipo_nomina_id: int,
        usuario_id: int | None = None,
    ) -> ResultadoAltaSobreviviente:
        familiar = EmployeefamilyModel.objects.filter(
            pk=familiar_id, employeecedula_id=cedula_titular
        ).first()
        if not familiar:
            raise NotFoundError(f'Familiar {familiar_id} no pertenece al titular {cedula_titular}.')
        cedula = (familiar.cedulaFamiliar or '').strip()
        if not cedula:
            raise ValidationError('El familiar no tiene cédula registrada.')
        nombre = _unir(familiar.primer_nombre, familiar.segundo_nombre,
                       familiar.primer_apellido, familiar.segundo_apellido)

        existente = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if existente:
            asig = AsigTrabajoModel.objects.filter(
                employee=existente, Tipo_personal__tipo_personal__iexact='PASIVO'
            ).first()
            if asig:
                return ResultadoAltaSobreviviente(cedula, nombre, False, asig.codigo)
            raise ConflictError(
                f'La cédula {cedula} ya existe como empleado sin condición pasiva; '
                'resuélvalo manualmente antes de dar de alta la pensión.'
            )

        try:
            tipo_nomina = TipoNominaModel.objects.get(pk=tipo_nomina_id)
            estatus_activo = EstatusModel.objects.get(estatus__iexact='ACTIVO')
            tipo_pasivo = TipoPersonalModel.objects.get(tipo_personal__iexact='PASIVO')
        except TipoNominaModel.DoesNotExist as exc:
            raise NotFoundError(f'Tipo de nómina {tipo_nomina_id} no encontrado.') from exc
        except (EstatusModel.DoesNotExist, TipoPersonalModel.DoesNotExist) as exc:
            raise ValidationError(f'Error de configuración de catálogos: {exc}') from exc

        base = self._cargo_base_del_titular(cedula_titular)

        empleado = EmployeeModel.objects.create(
            cedulaidentidad=cedula,
            nombres=_unir(familiar.primer_nombre, familiar.segundo_nombre),
            apellidos=_unir(familiar.primer_apellido, familiar.segundo_apellido),
            fecha_nacimiento=familiar.fechanacimiento,
            sexoid=familiar.sexo,
        )
        self._copiar_perfiles(familiar, empleado)

        dg = DireccionGeneralModel.objects.filter(
            direccion_general__iexact='OFICINA DE GESTION HUMANA'
        ).first()
        asig = AsigTrabajoModel.objects.create(
            employee=empleado,
            codigo=generar_codigo_pasivo(tipo_nomina),
            denominacioncargoid=base['denominacioncargoid'],
            denominacioncargoespecificoid=base['denominacioncargoespecificoid'],
            tiponominaid=tipo_nomina,
            estatusid=estatus_activo,
            Tipo_personal=tipo_pasivo,
            Dependencia=dg.dependenciaId if dg else None,
            DireccionGeneral=dg,
            OrganismoAdscritoid=base['OrganismoAdscritoid'],
            observaciones=f'Titular fallecido: {cedula_titular}. Parentesco: {familiar.parentesco}.',
        )
        # Movimiento en el historial del beneficiario (apps.movimientos lo
        # registra por el receiver del evento). Motivo: "PENSION POR
        # SOBREVIVIENTE" del catálogo TipoMovimiento (None si no existe).
        if usuario_id is not None:
            motivo = TipoMovimientoModel.objects.filter(
                movimiento__icontains='PENSION POR SOBREVIV').order_by('pk').first()
            events.cargo_movimiento_ejecutado.send(
                sender=RepoSobrevivientesORM,
                cargo_id=asig.pk,
                cedula=cedula,
                tipo_movimiento='INGRESO',
                motivo_id=motivo.pk if motivo else None,
                usuario_id=usuario_id,
            )
        return ResultadoAltaSobreviviente(cedula, nombre, True, asig.codigo)

    def _cargo_base_del_titular(self, cedula_titular: str) -> dict:
        asig = (
            AsigTrabajoModel.objects.filter(employee_id=cedula_titular)
            .order_by('-fecha_actualizacion').first()
        )
        if asig:
            return {
                'denominacioncargoid': asig.denominacioncargoid,
                'denominacioncargoespecificoid': asig.denominacioncargoespecificoid,
                'OrganismoAdscritoid': asig.OrganismoAdscritoid,
            }
        egr = (
            CargoEgresadoModel.objects.filter(egreso__employee_id=cedula_titular)
            .order_by('-pk').first()
        )
        if not egr:
            raise ValidationError('El titular no tiene cargo ni historial de cargo para heredar.')
        return {
            'denominacioncargoid': egr.denominacioncargoid,
            'denominacioncargoespecificoid': egr.denominacioncargoespecificoid,
            'OrganismoAdscritoid': egr.organismoAdscritoId,
        }

    def _copiar_perfiles(self, familiar: EmployeefamilyModel, empleado: EmployeeModel) -> None:
        for ps in PerfilSaludModel.objects.filter(familiar=familiar):
            nuevo = PerfilSaludModel.objects.create(empleado=empleado, grupo_sanguineo=ps.grupo_sanguineo)
            for r in PerfilSaludAlergias.objects.filter(perfil_salud=ps):
                PerfilSaludAlergias.objects.create(perfil_salud=nuevo, alergias_id=r.alergias_id)
            for r in PerfilSaludPatologia.objects.filter(perfil_salud=ps):
                PerfilSaludPatologia.objects.create(
                    perfil_salud=nuevo, patologias_cronicas_id=r.patologias_cronicas_id)
            for r in PerfilSaludDiscapacidad.objects.filter(perfil_salud=ps):
                PerfilSaludDiscapacidad.objects.create(
                    perfil_salud=nuevo, discapacidades_id=r.discapacidades_id)
        for pf in PerfilFisicoModel.objects.filter(familiar=familiar):
            PerfilFisicoModel.objects.create(
                empleado=empleado, tallaCamisa=pf.tallaCamisa, tallaPantalon=pf.tallaPantalon,
                tallaZapatos=pf.tallaZapatos, tallaChaqueta=pf.tallaChaqueta,
            )
        for fa in FormacionAcademicaModel.objects.filter(familiar=familiar):
            FormacionAcademicaModel.objects.create(
                empleado=empleado, nivel_academico=fa.nivel_academico, carrera=fa.carrera,
                mencion=fa.mencion, institucion=fa.institucion,
            )
