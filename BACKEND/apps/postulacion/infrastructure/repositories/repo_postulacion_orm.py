"""Repositorio ORM de postulantes, expedientes e historial; y el buscador de empleados previos (C-1)."""
import re
import unicodedata
from datetime import date, datetime, time, timedelta, timezone as tz_utc

from django.db import IntegrityError, transaction
from django.db.models import Case, IntegerField, Max, Q, Value, When
from django.utils import timezone

from apps.cargos.infrastructure.models.cargo_models import DenominacionCargoEspecificoModel, DenominacionCargoModel
from apps.catalogos.infrastructure.models.catalogo_models import TipoNominaModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.postulacion.domain.entities.bandeja import FilaBandeja, FiltrosBandeja, PropuestaCatalogo
from apps.postulacion.domain.entities.constancia import ConstanciaPresupuestaria
from apps.postulacion.domain.entities.credencial import CredencialPostulante
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import EmpleadoPrevio, Postulante, TransicionRegistrada
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.entities.punto_cuenta_ingreso import PuntoCuentaIngreso
from apps.postulacion.domain.entities.reserva import ACTIVA, ReservaPuesto
from apps.postulacion.domain.errores import ConflictoConCodigo
from apps.postulacion.infrastructure.mappers.mapper_postulacion import (
    CAMPOS_CONSTANCIA,
    CAMPOS_CREDENCIAL,
    CAMPOS_PSICOFISICO,
    CAMPOS_PUNTO_CUENTA_INGRESO,
    CAMPOS_RESERVA,
    campos_de_expediente,
    constancia_a_entidad,
    credencial_a_entidad,
    expediente_a_entidad,
    postulante_a_entidad,
    psicofisico_a_entidad,
    punto_cuenta_ingreso_a_entidad,
    reserva_a_entidad,
    transicion_a_entidad,
)
from apps.postulacion.infrastructure.models.credencial_models import CredencialPostulanteModel
from apps.postulacion.infrastructure.models.presupuesto_models import (
    ConstanciaPresupuestariaModel,
    PuntoCuentaIngresoModel,
    ReservaPuestoModel,
)
from apps.postulacion.infrastructure.models.psicofisico_models import ResultadoPsicofisicoModel
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)
from core.infrastructure.providers import obtener_resolutor_condicion
from apps.postulacion.domain.value_objects.estados import VALORES_TERMINALES
from core.domain.exceptions import ConflictError, NotFoundError
from core.domain.paginacion import Paginacion

_REINTENTOS_NUMERO = 5
_VOCALES = {'a': 'aáàäâÁÀÄÂ', 'e': 'eéèëêÉÈËÊ', 'i': 'iíìïîÍÌÏÎ', 'o': 'oóòöôÓÒÖÔ', 'u': 'uúùüûÚÙÜÛ', 'n': 'nñÑ'}


def _patron_sin_acentos(texto: str) -> str:
    """Regex para `iregex` que ignora mayúsculas y acentos (Postgres no trae `unaccent` en este proyecto)."""
    base = ''.join(c for c in unicodedata.normalize('NFD', texto) if not unicodedata.combining(c))
    return ''.join(f'[{_VOCALES[c.lower()]}]' if c.lower() in _VOCALES else re.escape(c) for c in base)


def _uuid_valido(valor: str):
    import uuid
    try:
        return uuid.UUID(str(valor))
    except (ValueError, TypeError, AttributeError):
        return None


class RepoPostulacionORM:
    def transaccion(self):
        return transaction.atomic()

    def al_confirmar(self, accion) -> None:
        transaction.on_commit(accion)

    # --- postulantes ---
    def obtener_postulante_por_cedula(self, cedula: str, bloquear: bool = False) -> Postulante | None:
        qs = PostulanteModel.objects.select_for_update() if bloquear else PostulanteModel.objects
        m = qs.filter(cedula=cedula).first()
        return postulante_a_entidad(m) if m else None

    def obtener_postulante(self, postulante_id: str) -> Postulante | None:
        pk = _uuid_valido(postulante_id)
        m = PostulanteModel.objects.filter(pk=pk).first() if pk else None
        return postulante_a_entidad(m) if m else None

    def crear_postulante(self, p: Postulante) -> Postulante:
        m = PostulanteModel.objects.create(
            cedula=p.cedula, nombres=p.nombres, apellidos=p.apellidos, correo=p.correo,
            telefono_movil=p.telefono_movil, employee_cedula=p.employee_cedula, creado_por=p.creado_por,
        )
        return postulante_a_entidad(m)

    def guardar_postulante(self, p: Postulante) -> Postulante:
        actualizadas = PostulanteModel.objects.filter(pk=p.id).update(
            nombres=p.nombres, apellidos=p.apellidos, correo=p.correo, telefono_movil=p.telefono_movil,
            updated_at=timezone.now(),
        )
        if not actualizadas:
            raise NotFoundError("El postulante no existe.")
        return self.obtener_postulante(p.id)

    def vincular_empleado(self, postulante_id: str, employee_cedula: str) -> Postulante:
        actualizadas = PostulanteModel.objects.filter(pk=postulante_id).update(employee_cedula=employee_cedula)
        if not actualizadas:
            raise NotFoundError("El postulante no existe.")
        return self.obtener_postulante(postulante_id)

    # --- expedientes ---
    def tiene_expediente_abierto(self, postulante_id: str) -> bool:
        return ExpedientePostulacionModel.objects.filter(postulante_id=postulante_id).exclude(
            estado__in=VALORES_TERMINALES,
        ).exists()

    def _siguiente_numero(self, anio: int) -> str:
        prefijo = f'EXP-{anio}-'
        ultimo = (
            ExpedientePostulacionModel.objects.filter(numero__startswith=prefijo)
            .order_by('-numero').values_list('numero', flat=True).first()
        )
        n = int(ultimo.rsplit('-', 1)[1]) + 1 if ultimo else 1
        return f'{prefijo}{n:05d}'

    def crear_expediente(self, e: ExpedientePostulacion) -> ExpedientePostulacion:
        anio = (e.fecha_apertura.year if e.fecha_apertura else None) or date.today().year
        campos = campos_de_expediente(e)
        for _ in range(_REINTENTOS_NUMERO):
            try:
                with transaction.atomic():  # savepoint: un choque de número o de constraint no envenena la transacción
                    m = ExpedientePostulacionModel.objects.create(
                        numero=self._siguiente_numero(anio), postulante_id=e.postulante_id,
                        fecha_apertura=e.fecha_apertura or timezone.now(), **campos,
                    )
                return expediente_a_entidad(m)
            except IntegrityError:
                if self.tiene_expediente_abierto(e.postulante_id):
                    raise ConflictError("El postulante ya tiene un expediente abierto.") from None
        raise ConflictError("No se pudo asignar el número del expediente; intente de nuevo.")

    def obtener_expediente(self, expediente_id: str, bloquear: bool = False) -> ExpedientePostulacion | None:
        pk = _uuid_valido(expediente_id)
        if pk is None:
            return None
        qs = ExpedientePostulacionModel.objects.select_for_update() if bloquear else ExpedientePostulacionModel.objects
        m = qs.filter(pk=pk).first()
        return expediente_a_entidad(m) if m else None

    def guardar_expediente(self, e: ExpedientePostulacion) -> ExpedientePostulacion:
        actualizadas = ExpedientePostulacionModel.objects.filter(pk=e.id).update(**campos_de_expediente(e))
        if not actualizadas:
            raise NotFoundError("El expediente de postulación no existe.")
        return self.obtener_expediente(e.id)

    # --- historial ---
    def registrar_transicion(self, t: TransicionRegistrada) -> TransicionRegistrada:
        m = TransicionExpedienteModel.objects.create(
            expediente_id=t.expediente_id, estado_origen=t.estado_origen, estado_destino=t.estado_destino,
            actor_cedula=t.actor_cedula, actor_tipo=t.actor_tipo, fecha=t.fecha, motivo=t.motivo,
            datos_extra=t.datos_extra,
        )
        return transicion_a_entidad(m)

    def listar_transiciones(self, expediente_id: str) -> list[TransicionRegistrada]:
        return [transicion_a_entidad(m) for m in TransicionExpedienteModel.objects.filter(expediente_id=expediente_id)]

    def listar_bandeja(self, filtros: FiltrosBandeja, paginacion: Paginacion) -> tuple[list[FilaBandeja], int]:
        # Fecha del último cambio de estado = el asiento más reciente (`guardar_expediente` no toca `updated_at`);
        # sin asiento (no ocurre: el alta lo crea) se cae a la fecha de apertura.
        qs = ExpedientePostulacionModel.objects.select_related('postulante').annotate(
            _cambio=Max('transiciones__fecha'),
            _pendiente=Case(
                When(estado__in=[e.value for e in filtros.prioritarios], then=Value(0)),
                default=Value(1), output_field=IntegerField(),
            ),
        )
        criterio = Q()
        if filtros.estados:
            criterio |= Q(estado__in=[e.value for e in filtros.estados])
        if filtros.o_punto_cuenta_estados:
            criterio |= Q(punto_cuenta_ingreso__estado__in=list(filtros.o_punto_cuenta_estados))
        if criterio:
            qs = qs.filter(criterio)
        for palabra in filtros.texto.split():
            patron = _patron_sin_acentos(palabra)
            qs = qs.filter(
                Q(numero__icontains=palabra) | Q(postulante__cedula__icontains=palabra)
                | Q(postulante__nombres__iregex=patron) | Q(postulante__apellidos__iregex=patron)
            )
        if filtros.desde:
            qs = qs.filter(_cambio__gte=datetime.combine(filtros.desde, time.min, tzinfo=tz_utc.utc))
        if filtros.hasta:
            qs = qs.filter(_cambio__lt=datetime.combine(filtros.hasta, time.min, tzinfo=tz_utc.utc) + timedelta(days=1))
        total = qs.count()
        pagina = qs.order_by('_pendiente', '_cambio', 'numero')[paginacion.offset:paginacion.offset + paginacion.tamano]
        filas = [
            FilaBandeja(
                expediente=expediente_a_entidad(m), postulante=postulante_a_entidad(m.postulante),
                ultimo_cambio=m._cambio or m.fecha_apertura,
            )
            for m in pagina
        ]
        return filas, total

    # --- vencimientos del sistema ---
    def listar_ids_con_ventana_vencida(self, ahora: datetime) -> list[str]:
        qs = ExpedientePostulacionModel.objects.filter(
            estado__in=['PRE_REGISTRADO', 'EN_CAPTURA'], ventana_vence_el__lt=ahora,
        ).order_by('ventana_vence_el')
        return [str(pk) for pk in qs.values_list('pk', flat=True)]

    def listar_ids_con_diferido_vencido(self, ahora: datetime) -> list[str]:
        qs = ExpedientePostulacionModel.objects.filter(
            estado='DIFERIDO_PRESUPUESTO', diferido_vence_el__lt=ahora,
        ).order_by('diferido_vence_el')
        return [str(pk) for pk in qs.values_list('pk', flat=True)]

    # --- test psicofísico ---
    def obtener_psicofisico(self, expediente_id: str, bloquear: bool = False) -> ResultadoPsicofisico | None:
        pk = _uuid_valido(expediente_id)
        if pk is None:
            return None
        qs = ResultadoPsicofisicoModel.objects.select_for_update() if bloquear else ResultadoPsicofisicoModel.objects
        m = qs.filter(expediente_id=pk).first()
        return psicofisico_a_entidad(m) if m else None

    def guardar_psicofisico(self, r: ResultadoPsicofisico) -> ResultadoPsicofisico:
        campos = {c: getattr(r, c) for c in CAMPOS_PSICOFISICO}
        m, _ = ResultadoPsicofisicoModel.objects.update_or_create(expediente_id=r.expediente_id, defaults=campos)
        return psicofisico_a_entidad(m)

    # --- reserva de puesto ---
    def obtener_reserva_activa_de_expediente(self, expediente_id: str, bloquear: bool = False) -> ReservaPuesto | None:
        pk = _uuid_valido(expediente_id)
        if pk is None:
            return None
        qs = ReservaPuestoModel.objects.select_for_update() if bloquear else ReservaPuestoModel.objects
        m = qs.filter(expediente_id=pk, estado=ACTIVA).first()
        return reserva_a_entidad(m) if m else None

    def obtener_reserva_activa_de_puesto(self, puesto_id: int, bloquear: bool = False) -> ReservaPuesto | None:
        qs = ReservaPuestoModel.objects.select_for_update() if bloquear else ReservaPuestoModel.objects
        m = qs.filter(puesto_id=puesto_id, estado=ACTIVA).first()
        return reserva_a_entidad(m) if m else None

    def crear_reserva(self, r: ReservaPuesto) -> ReservaPuesto:
        try:
            with transaction.atomic():  # savepoint: el choque del constraint no envenena la transacción
                m = ReservaPuestoModel.objects.create(
                    expediente_id=r.expediente_id, **{c: getattr(r, c) for c in CAMPOS_RESERVA},
                )
        except IntegrityError:
            raise ConflictoConCodigo(
                "El puesto ya está reservado por otro expediente, o este expediente ya tiene una reserva activa.",
                codigo='PUESTO_RESERVADO',
            ) from None
        return reserva_a_entidad(m)

    def guardar_reserva(self, r: ReservaPuesto) -> ReservaPuesto:
        actualizadas = ReservaPuestoModel.objects.filter(pk=r.id).update(
            **{c: getattr(r, c) for c in CAMPOS_RESERVA}, updated_at=timezone.now(),
        )
        if not actualizadas:
            raise NotFoundError("La reserva no existe.")
        return reserva_a_entidad(ReservaPuestoModel.objects.get(pk=r.id))

    def listar_reservas_vencidas(self, ahora: datetime) -> list[ReservaPuesto]:
        qs = ReservaPuestoModel.objects.filter(estado=ACTIVA, vence_el__lt=ahora).order_by('vence_el')
        return [reserva_a_entidad(m) for m in qs]

    def reservas_activas_de(self, expediente_ids: list[str]) -> dict[str, ReservaPuesto]:
        qs = ReservaPuestoModel.objects.filter(expediente_id__in=expediente_ids, estado=ACTIVA)
        return {str(m.expediente_id): reserva_a_entidad(m) for m in qs}

    # --- constancia presupuestaria ---
    def obtener_constancia(self, expediente_id: str, bloquear: bool = False) -> ConstanciaPresupuestaria | None:
        pk = _uuid_valido(expediente_id)
        if pk is None:
            return None
        qs = ConstanciaPresupuestariaModel.objects.select_for_update() if bloquear else ConstanciaPresupuestariaModel.objects
        m = qs.filter(expediente_id=pk).first()
        return constancia_a_entidad(m) if m else None

    def guardar_constancia(self, c: ConstanciaPresupuestaria) -> ConstanciaPresupuestaria:
        m, _ = ConstanciaPresupuestariaModel.objects.update_or_create(
            expediente_id=c.expediente_id, defaults={campo: getattr(c, campo) for campo in CAMPOS_CONSTANCIA},
        )
        return constancia_a_entidad(m)

    def constancias_de(self, expediente_ids: list[str]) -> dict[str, ConstanciaPresupuestaria]:
        qs = ConstanciaPresupuestariaModel.objects.filter(expediente_id__in=expediente_ids)
        return {str(m.expediente_id): constancia_a_entidad(m) for m in qs}

    # --- Punto de Cuenta de ingreso ---
    def obtener_punto_cuenta_ingreso(self, expediente_id: str, bloquear: bool = False) -> PuntoCuentaIngreso | None:
        pk = _uuid_valido(expediente_id)
        if pk is None:
            return None
        qs = PuntoCuentaIngresoModel.objects.select_for_update() if bloquear else PuntoCuentaIngresoModel.objects
        m = qs.filter(expediente_id=pk).first()
        return punto_cuenta_ingreso_a_entidad(m) if m else None

    def guardar_punto_cuenta_ingreso(self, e: PuntoCuentaIngreso) -> PuntoCuentaIngreso:
        m, _ = PuntoCuentaIngresoModel.objects.update_or_create(
            expediente_id=e.expediente_id,
            defaults={'punto_cuenta_id': e.punto_cuenta_id, **{c: getattr(e, c) for c in CAMPOS_PUNTO_CUENTA_INGRESO}},
        )
        return punto_cuenta_ingreso_a_entidad(m)

    def puntos_cuenta_de(self, expediente_ids: list[str]) -> dict[str, PuntoCuentaIngreso]:
        qs = PuntoCuentaIngresoModel.objects.filter(expediente_id__in=expediente_ids)
        return {str(m.expediente_id): punto_cuenta_ingreso_a_entidad(m) for m in qs}

    # --- credencial del postulante ---
    def obtener_credencial_por_usuario(self, usuario: str) -> CredencialPostulante | None:
        m = (
            CredencialPostulanteModel.objects.filter(usuario=usuario, revocada=False)
            .exclude(expediente__estado__in=VALORES_TERMINALES).order_by('-emitida_el').first()
        )
        return credencial_a_entidad(m) if m else None

    def obtener_credencial_de_expediente(self, expediente_id: str, bloquear: bool = False) -> CredencialPostulante | None:
        pk = _uuid_valido(expediente_id)
        if pk is None:
            return None
        qs = CredencialPostulanteModel.objects.select_for_update() if bloquear else CredencialPostulanteModel.objects
        m = qs.filter(expediente_id=pk).first()
        return credencial_a_entidad(m) if m else None

    def guardar_credencial(self, c: CredencialPostulante) -> CredencialPostulante:
        campos = {campo: getattr(c, campo) for campo in CAMPOS_CREDENCIAL}
        if campos['emitida_el'] is None:
            campos['emitida_el'] = timezone.now()
        m, _ = CredencialPostulanteModel.objects.update_or_create(expediente_id=c.expediente_id, defaults=campos)
        return credencial_a_entidad(m)


class BuscadorEmpleadosORM:
    """Lee el `Employee` heredado por cédula (solo lectura; sin FK desde las tablas nuevas)."""

    def por_cedula(self, cedula: str) -> EmpleadoPrevio | None:
        e = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if e is None:
            return None
        # Mismo criterio de condición que el resto del sistema (apps.identidad).
        resolutor = obtener_resolutor_condicion()
        condicion = str(resolutor.condicion_de(e.cedulaidentidad) or '') if resolutor else ''
        return EmpleadoPrevio(cedula=e.cedulaidentidad, nombres=e.nombres, apellidos=e.apellidos, condicion=condicion)


class CatalogoPropuestaORM:
    """Comprueba que los ids de la propuesta existan en los catálogos heredados y que la jerarquía de la oficina encaje."""

    def errores_de_propuesta(self, ids: PropuestaCatalogo) -> dict[str, str]:
        errores: dict[str, str] = {}

        def existe(campo: str, modelo, etiqueta: str):
            valor = getattr(ids, campo)
            if valor is None:
                return None
            fila = modelo.objects.filter(pk=valor).first()
            if fila is None:
                errores[campo] = f"{etiqueta} indicado no existe."
            return fila

        existe('cargo_propuesto_id', DenominacionCargoModel, 'El cargo')
        existe('cargo_especifico_propuesto_id', DenominacionCargoEspecificoModel, 'El cargo específico')
        existe('tipo_nomina_propuesto_id', TipoNominaModel, 'El tipo de nómina')
        dependencia = existe('dependencia_id', DependenciaModel, 'La dependencia')
        general = existe('direccion_general_id', DireccionGeneralModel, 'La dirección general')
        linea = existe('direccion_linea_id', DireccionLineaModel, 'La dirección de línea')
        coordinacion = existe('coordinacion_id', CoordinacionModel, 'La coordinación')
        # Jerarquía: coordinación -> línea -> general -> dependencia (solo se compara lo que llegó completo).
        if coordinacion and linea and coordinacion.direccionLinea_id != linea.pk:
            errores.setdefault('coordinacion_id', 'La coordinación no pertenece a la dirección de línea indicada.')
        if linea and general and linea.direccionGeneral_id != general.pk:
            errores.setdefault('direccion_linea_id', 'La dirección de línea no pertenece a la dirección general indicada.')
        if general and dependencia and general.dependenciaId_id != dependencia.pk:
            errores.setdefault('direccion_general_id', 'La dirección general no pertenece a la dependencia indicada.')
        return errores

    def nombres_de_propuesta(self, ids: PropuestaCatalogo) -> dict[str, str]:
        nombres: dict[str, str] = {}
        for clave, valor, modelo, campo in (
            ('cargo', ids.cargo_propuesto_id, DenominacionCargoModel, 'cargo'),
            ('cargo_especifico', ids.cargo_especifico_propuesto_id, DenominacionCargoEspecificoModel, 'cargo'),
            ('tipo_nomina', ids.tipo_nomina_propuesto_id, TipoNominaModel, 'nomina'),
            ('dependencia', ids.dependencia_id, DependenciaModel, 'dependencia'),
            ('direccion_general', ids.direccion_general_id, DireccionGeneralModel, 'direccion_general'),
            ('direccion_linea', ids.direccion_linea_id, DireccionLineaModel, 'direccion_linea'),
            ('coordinacion', ids.coordinacion_id, CoordinacionModel, 'coordinacion'),
        ):
            if valor is None:
                continue
            fila = modelo.objects.filter(pk=valor).first()
            if fila is not None:
                nombres[clave] = str(getattr(fila, campo) or '')
        return nombres
