"""
Repositorio ORM de Eventos, Categorías, Zonas e Invitados (Regla B2/B3, O45-B).
"""
import logging
import uuid
from datetime import datetime
from django.db import IntegrityError, transaction
from django.db.models import Count, Q

from apps.carnetizacion.domain.entities.evento import (
    EstadoEvento,
    EstadoInvitado,
    Evento,
    EventoCategoria,
    EventoInvitado,
    EventoZona,
    RegistroAccesoEvento,
    ResumenPanelEvento,
)
from apps.carnetizacion.domain.ports.repo_eventos import RepoEventosPort
from apps.carnetizacion.infrastructure.mappers.mapper_eventos import (
    a_entidad_categoria,
    a_entidad_evento,
    a_entidad_invitado,
    a_entidad_registro_acceso,
    a_entidad_zona,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (

    EventoCategoriaModel,
    EventoInvitadoModel,
    EventoModel,
    EventoRegistroAccesoModel,
    EventoZonaModel,
)

logger = logging.getLogger('gath.carnetizacion')

class RepoEventosORM(RepoEventosPort):

    # ─── Eventos ───
    def crear_evento(self, evento: Evento) -> Evento:
        m = EventoModel.objects.create(
            id=evento.id,
            nombre=evento.nombre,
            descripcion=evento.descripcion,
            lugar=evento.lugar,
            fecha_inicio=evento.fecha_inicio,
            fecha_fin=evento.fecha_fin,
            estado=evento.estado.value if hasattr(evento.estado, 'value') else str(evento.estado),
            plantilla_id=evento.plantilla_id,
            creado_por_id=evento.creado_por_id,
        )
        return a_entidad_evento(m)

    def actualizar_evento(self, evento: Evento) -> Evento:
        EventoModel.objects.filter(id=evento.id).update(
            nombre=evento.nombre,
            descripcion=evento.descripcion,
            lugar=evento.lugar,
            fecha_inicio=evento.fecha_inicio,
            fecha_fin=evento.fecha_fin,
            estado=evento.estado.value if hasattr(evento.estado, 'value') else str(evento.estado),
            plantilla_id=evento.plantilla_id,
        )
        m = EventoModel.objects.get(id=evento.id)
        return a_entidad_evento(m)

    def obtener_evento(self, evento_id: str) -> Evento | None:
        try:
            m = EventoModel.objects.get(id=evento_id)
            return a_entidad_evento(m)
        except (EventoModel.DoesNotExist, ValueError):
            return None

    def listar_eventos(
        self, estado: str | None = None, busqueda: str | None = None
    ) -> list[Evento]:
        qs = EventoModel.objects.all().order_by('-fecha_inicio')
        if estado:
            qs = qs.filter(estado=estado)
        if busqueda:
            qs = qs.filter(
                Q(nombre__icontains=busqueda) | Q(lugar__icontains=busqueda)
            )
        return [a_entidad_evento(m) for m in qs]

    # ─── Categorías ───
    def crear_categoria(self, categoria: EventoCategoria) -> EventoCategoria:
        m = EventoCategoriaModel.objects.create(
            id=categoria.id,
            evento_id=categoria.evento_id,
            nombre=categoria.nombre,
            color_primario=categoria.color_primario,
            color_acento=categoria.color_acento,
            orden=categoria.orden,
            plantilla_id=categoria.plantilla_id,
        )
        return a_entidad_categoria(m)

    def actualizar_categoria(self, categoria: EventoCategoria) -> EventoCategoria:
        EventoCategoriaModel.objects.filter(id=categoria.id).update(
            nombre=categoria.nombre,
            color_primario=categoria.color_primario,
            color_acento=categoria.color_acento,
            orden=categoria.orden,
            plantilla_id=categoria.plantilla_id,
        )
        m = EventoCategoriaModel.objects.get(id=categoria.id)
        return a_entidad_categoria(m)

    def obtener_categoria(self, categoria_id: str) -> EventoCategoria | None:
        try:
            m = EventoCategoriaModel.objects.get(id=categoria_id)
            return a_entidad_categoria(m)
        except (EventoCategoriaModel.DoesNotExist, ValueError):
            return None

    def listar_categorias(self, evento_id: str) -> list[EventoCategoria]:
        qs = EventoCategoriaModel.objects.filter(evento_id=evento_id).order_by('orden', 'nombre')
        return [a_entidad_categoria(m) for m in qs]

    # ─── Zonas ───
    def crear_zona(self, zona: EventoZona) -> EventoZona:
        m = EventoZonaModel.objects.create(
            id=zona.id,
            evento_id=zona.evento_id,
            nombre=zona.nombre,
            codigo=zona.codigo,
            orden=zona.orden,
        )
        return a_entidad_zona(m)

    def actualizar_zona(self, zona: EventoZona) -> EventoZona:
        EventoZonaModel.objects.filter(id=zona.id).update(
            nombre=zona.nombre,
            codigo=zona.codigo,
            orden=zona.orden,
        )
        m = EventoZonaModel.objects.get(id=zona.id)
        return a_entidad_zona(m)

    def obtener_zona(self, zona_id: str) -> EventoZona | None:
        try:
            m = EventoZonaModel.objects.get(id=zona_id)
            return a_entidad_zona(m)
        except (EventoZonaModel.DoesNotExist, ValueError):
            return None

    def listar_zonas(self, evento_id: str) -> list[EventoZona]:
        qs = EventoZonaModel.objects.filter(evento_id=evento_id).order_by('orden', 'nombre')
        return [a_entidad_zona(m) for m in qs]

    # ─── Invitados ───
    def siguiente_codigo_credencial(self) -> str:
        """Siguiente INV-NNNN libre.

        La columna `codigo_credencial` es única en toda la tabla, no por evento;
        por eso el correlativo se calcula sobre todos los invitados existentes.
        """
        maximo = 0
        codigos = EventoInvitadoModel.objects.filter(
            codigo_credencial__startswith='INV-'
        ).values_list('codigo_credencial', flat=True)
        for codigo in codigos:
            try:
                numero = int(str(codigo).split('-', 1)[1])
            except (IndexError, ValueError):
                continue
            maximo = max(maximo, numero)
        return f'INV-{maximo + 1:04d}'

    def _insertar_invitado(self, invitado: EventoInvitado) -> EventoInvitado:
        m = EventoInvitadoModel.objects.create(
            id=invitado.id,
            evento_id=invitado.evento_id,
            nombre_completo=invitado.nombre_completo,
            categoria_id=invitado.categoria_id,
            zona_id=invitado.zona_id,
            documento_identidad=invitado.documento_identidad,
            organizacion=invitado.organizacion,
            correo=invitado.correo,
            telefono=invitado.telefono,
            mesa=invitado.mesa,
            codigo_credencial=invitado.codigo_credencial,
            security_hash=invitado.security_hash,
            es_acompanante=invitado.es_acompanante,
            trabajador_titular_id=invitado.trabajador_titular_id,
            estado=invitado.estado.value if hasattr(invitado.estado, 'value') else str(invitado.estado),
            fecha_emision=invitado.fecha_emision,
            fecha_ingreso=invitado.fecha_ingreso,
            ingreso_registrado_por_id=invitado.ingreso_registrado_por_id,
            observaciones=invitado.observaciones,
        )
        return a_entidad_invitado(m)

    def crear_invitado(self, invitado: EventoInvitado) -> EventoInvitado:
        """Crea el invitado con un INV-NNNN único incluso bajo concurrencia.

        `max+1` puede repetirse si dos altas simultáneas calculan el mismo
        siguiente número. La unicidad real la impone la BD; si el INSERT choca
        por `codigo_credencial`, se recalcula y se reintenta (savepoint por
        intento para no romper una transacción externa).
        """
        codigo_original = invitado.codigo_credencial
        for intento in range(6):
            try:
                with transaction.atomic():
                    return self._insertar_invitado(invitado)
            except IntegrityError as exc:
                es_codigo = (
                    'codigo_credencial' in str(exc)
                    and codigo_original.startswith('INV-')
                )
                if not es_codigo or intento == 5:
                    raise
                invitado.codigo_credencial = self.siguiente_codigo_credencial()
        raise RuntimeError('No se pudo asignar un código de credencial único.')

    def actualizar_invitado(self, invitado: EventoInvitado) -> EventoInvitado:
        EventoInvitadoModel.objects.filter(id=invitado.id).update(
            nombre_completo=invitado.nombre_completo,
            categoria_id=invitado.categoria_id,
            zona_id=invitado.zona_id,
            documento_identidad=invitado.documento_identidad,
            organizacion=invitado.organizacion,
            correo=invitado.correo,
            telefono=invitado.telefono,
            mesa=invitado.mesa,
            es_acompanante=invitado.es_acompanante,
            trabajador_titular_id=invitado.trabajador_titular_id,
            estado=invitado.estado.value if hasattr(invitado.estado, 'value') else str(invitado.estado),
            fecha_emision=invitado.fecha_emision,
            fecha_ingreso=invitado.fecha_ingreso,
            ingreso_registrado_por_id=invitado.ingreso_registrado_por_id,
            observaciones=invitado.observaciones,
        )
        m = EventoInvitadoModel.objects.get(id=invitado.id)
        return a_entidad_invitado(m)

    def obtener_invitado(self, invitado_id: str) -> EventoInvitado | None:
        try:
            m = EventoInvitadoModel.objects.get(id=invitado_id)
            return a_entidad_invitado(m)
        except (EventoInvitadoModel.DoesNotExist, ValueError):
            return None

    def buscar_invitado_por_hash_o_codigo(self, hash_o_codigo: str) -> tuple[EventoInvitado | None, Evento | None]:
        valor = hash_o_codigo.strip()
        qs = EventoInvitadoModel.objects.select_related('evento').filter(
            Q(security_hash=valor) | Q(codigo_credencial__iexact=valor)
        )
        m = qs.first()
        if not m:
            return None, None
        return a_entidad_invitado(m), a_entidad_evento(m.evento)

    def listar_invitados_paginado(
        self,
        evento_id: str,
        offset: int,
        limite: int,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[EventoInvitado], int]:
        qs = self._qs_invitados(evento_id, categoria_id, zona_id, estado, busqueda)
        total = qs.count()
        return [a_entidad_invitado(m) for m in qs[offset:offset + limite]], total

    def listar_ids_invitados(
        self,
        evento_id: str,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> list[str]:
        qs = self._qs_invitados(evento_id, categoria_id, zona_id, estado, busqueda)
        return [str(i) for i in qs.values_list('id', flat=True)]

    def listar_invitados(
        self,
        evento_id: str,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> list[EventoInvitado]:
        qs = self._qs_invitados(evento_id, categoria_id, zona_id, estado, busqueda)
        return [a_entidad_invitado(m) for m in qs]

    @staticmethod
    def _qs_invitados(
        evento_id: str,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ):
        qs = EventoInvitadoModel.objects.filter(evento_id=evento_id).order_by('nombre_completo', 'id')
        if categoria_id:
            qs = qs.filter(categoria_id=categoria_id)
        if zona_id:
            qs = qs.filter(zona_id=zona_id)
        if estado:
            qs = qs.filter(estado=estado)
        if busqueda:
            term = busqueda.strip()
            qs = qs.filter(
                Q(nombre_completo__icontains=term)
                | Q(documento_identidad__icontains=term)
                | Q(organizacion__icontains=term)
                | Q(codigo_credencial__icontains=term)
                | Q(correo__icontains=term)
            )
        return qs

    def registrar_ingreso(
        self,
        invitado_id: str,
        registrado_por_id: int | None,
        zona_id: str | None = None,
    ) -> EventoInvitado:
        ahora = datetime.now()
        EventoInvitadoModel.objects.filter(id=invitado_id).update(
            estado=EstadoInvitado.INGRESO.value,
            fecha_ingreso=ahora,
            ingreso_registrado_por_id=registrado_por_id,
        )
        m = EventoInvitadoModel.objects.get(id=invitado_id)
        return a_entidad_invitado(m)

    def registrar_bitacora_acceso(self, registro: RegistroAccesoEvento) -> RegistroAccesoEvento:
        reg_id = registro.id or str(uuid.uuid4())
        m = EventoRegistroAccesoModel.objects.create(
            id=reg_id,
            evento_id=registro.evento_id,
            invitado_id=registro.invitado_id,
            zona_id=registro.zona_id,
            registrado_por_id=registro.registrado_por_id,
            resultado=registro.resultado.value if hasattr(registro.resultado, 'value') else str(registro.resultado),
            observaciones=registro.observaciones,
        )
        return a_entidad_registro_acceso(m)

    # ─── Panel y Estadísticas ───
    def obtener_resumen_panel(self, evento_id: str) -> ResumenPanelEvento:
        evento = EventoModel.objects.filter(id=evento_id).first()
        nombre_evento = evento.nombre if evento else ""

        total = EventoInvitadoModel.objects.filter(evento_id=evento_id).count()
        emitidas = EventoInvitadoModel.objects.filter(
            evento_id=evento_id,
            estado__in=[EstadoInvitado.EMITIDO.value, EstadoInvitado.INGRESO.value]
        ).count()
        entraron = EventoInvitadoModel.objects.filter(
            evento_id=evento_id,
            estado=EstadoInvitado.INGRESO.value
        ).count()
        faltan = total - entraron

        # Conteo por categoría
        por_cat = {}
        for c in EventoCategoriaModel.objects.filter(evento_id=evento_id):
            cnt = EventoInvitadoModel.objects.filter(evento_id=evento_id, categoria_id=c.id).count()
            por_cat[c.nombre] = cnt

        # Conteo por zona
        por_zona = {}
        for z in EventoZonaModel.objects.filter(evento_id=evento_id):
            cnt = EventoInvitadoModel.objects.filter(evento_id=evento_id, zona_id=z.id).count()
            por_zona[z.nombre] = cnt

        return ResumenPanelEvento(
            evento_id=str(evento_id),
            nombre_evento=nombre_evento,
            total_invitados=total,
            credenciales_emitidas=emitidas,
            entraron=entraron,
            faltan=max(0, faltan),
            por_categoria=por_cat,
            por_zona=por_zona,
        )

    def enviar_correo_invitado(self, invitado: EventoInvitado, evento: Evento) -> bool:
        if not invitado.correo or "@" not in invitado.correo:
            return False
        try:
            from django.conf import settings
            from django.core.mail import send_mail

            asunto = f"Su Credencial de Acceso — {evento.nombre}"
            mensaje = (
                f"Estimado(a) {invitado.nombre_completo},\n\n"
                f"Le hacemos llegar su credencial de acceso para el evento '{evento.nombre}'.\n\n"
                f"Lugar: {evento.lugar}\n"
                f"Código de Credencial: {invitado.codigo_credencial}\n"
                f"Mesa / Asiento: {invitado.mesa or 'General'}\n\n"
                f"Presente su código de credencial o código QR al momento del ingreso.\n"
                f"Comisión Nacional de Telecomunicaciones — CONATEL\n"
            )
            remitente = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@conatel.gob.ve")
            send_mail(asunto, mensaje, remitente, [invitado.correo], fail_silently=True)
            return True
        except Exception:
            logger.warning('No se pudo enviar la invitación del evento.', exc_info=True)
            return False

