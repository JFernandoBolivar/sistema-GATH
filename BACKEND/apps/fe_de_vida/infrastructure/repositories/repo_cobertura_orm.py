"""Reporte de cobertura (C16): pasivos sin correo o sin cuenta. Activo/pasivo = AsigTrabajo.tipoPersonalId."""
from django.db.models import Exists, OuterRef, Q, Subquery

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.fe_de_vida.domain.entities.filtros import FiltroCobertura
from apps.fe_de_vida.domain.entities.pasivo import PasivoCobertura
from apps.fe_de_vida.domain.value_objects.estados import CONDICION_PASIVO
from apps.fe_de_vida.infrastructure.models.solicitud_models import SolicitudFeDeVidaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


def _asignaciones_pasivas():
    return AsigTrabajoModel.objects.filter(
        employee_id=OuterRef('cedulaidentidad'), Tipo_personal__tipo_personal__iexact=CONDICION_PASIVO,
    )


class RepoCoberturaORM:
    def listar(self, filtro: FiltroCobertura, limite: int, desplazamiento: int):
        pasivas = _asignaciones_pasivas()
        if filtro.tipo_nomina_id:
            pasivas = pasivas.filter(tiponominaid_id=filtro.tipo_nomina_id)
        solicitudes_pasivo = SolicitudFeDeVidaModel.objects.filter(cedula=OuterRef('cedulaidentidad')).order_by('-created_at')
        solicitudes_validadas = SolicitudFeDeVidaModel.objects.filter(
            cedula=OuterRef('cedulaidentidad'), estado=SolicitudFeDeVidaModel.Estado.VALIDADA,
        )
        complementarios = DatosComplementariosTrabajadorModel.objects.filter(cedula=OuterRef('cedulaidentidad'))

        qs = EmployeeModel.objects.filter(Exists(pasivas)).annotate(
            tipo_nomina=Subquery(pasivas.order_by('-fecha_actualizacion').values('tiponominaid__nomina')[:1]),
            canal_fv=Subquery(solicitudes_pasivo.values('canal')[:1]),
            correo_alt=Subquery(complementarios.values('correo_alternativo')[:1]),
            tiene_fv_validada=Exists(solicitudes_validadas),
        )
        sin_correo = (Q(correo__isnull=True) | Q(correo='')) & (Q(correo_alt__isnull=True) | Q(correo_alt=''))
        sin_cuenta = Q(cuenta__isnull=True)
        if filtro.sin_correo or filtro.sin_cuenta:
            if filtro.sin_correo:
                qs = qs.filter(sin_correo)
            if filtro.sin_cuenta:
                qs = qs.filter(sin_cuenta)
        else:
            qs = qs.filter(sin_correo | sin_cuenta)
        if filtro.texto:
            nombre = EmployeeModel.objects.all()
            for palabra in filtro.texto.split():
                nombre = nombre.filter(Q(nombres__icontains=palabra) | Q(apellidos__icontains=palabra))
            qs = qs.filter(Q(cedulaidentidad__icontains=filtro.texto.strip()) | Q(pk__in=nombre.values('pk')))
        qs = qs.order_by('apellidos', 'nombres')
        total = qs.count()
        filas = []
        for e in qs.select_related('cuenta')[desplazamiento:desplazamiento + limite]:
            c_principal = (e.correo or '').strip()
            c_alt = (getattr(e, 'correo_alt', '') or '').strip()
            es_validado = False
            if c_alt:
                if c_principal and c_alt.lower() == c_principal.lower():
                    es_validado = True
                elif getattr(e, 'tiene_fv_validada', False):
                    es_validado = True

            filas.append(
                PasivoCobertura(
                    cedula=e.cedulaidentidad,
                    nombre_completo=f'{e.nombres} {e.apellidos}'.strip(),
                    tipo_nomina=e.tipo_nomina or '',
                    correo=c_principal,
                    tiene_cuenta=hasattr(e, 'cuenta'),
                    canal=getattr(e, 'canal_fv', '') or '',
                    correo_alternativo=c_alt,
                    alternativo_validado=es_validado,
                )
            )
        return filas, total
