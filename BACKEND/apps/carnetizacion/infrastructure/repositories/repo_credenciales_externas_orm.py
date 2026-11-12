"""
Repositorio ORM de credenciales externas y temporales (O45-A).
"""
import logging
import base64
from datetime import datetime
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.carnetizacion.domain.entities.credencial_externa import CredencialExterna
from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_trabajador,
)
from apps.carnetizacion.domain.services.vigencia_carnet import TIPO_VIGENCIA_EXTERNO
from apps.carnetizacion.infrastructure.codigo_qr import codigo_qr_unico
from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    credencial_externa_a_entidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    BitacoraAccesoQrModel,
    PlantillaCarnetModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
    CredencialExternaModel,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
    vencimiento_segun_parametros,
)
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import (
    generar_carnet_pdf_fiel,
)
from apps.carnetizacion.infrastructure.pdf.carnet_pdf_lote import generar_pdf_lote
from apps.notificaciones.application.use_cases.correo_outbox import encolar_correo
from apps.notificaciones.domain.entities.mensaje_outbox import AdjuntoOutbox
from apps.notificaciones.infrastructure.planificador_envio_celery import (
    PlanificadorEnvioCelery,
)
from apps.notificaciones.infrastructure.repositories.repo_outbox_orm import RepoOutboxORM
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel

from core.domain.exceptions import NotFoundError, ValidationError
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

logger = logging.getLogger('gath.carnetizacion')

class RepoCredencialesExternasORM:
    def __init__(self, almacen: Any = None) -> None:
        self._almacen = almacen or SeaweedFSStorage()

    # --- Lectura ---
    def listar(
        self,
        tipo: str | None = None,
        grupo: str | None = None,
        estado: str | None = None,
        desde: datetime | None = None,
        hasta: datetime | None = None,
    ) -> list[CredencialExterna]:
        self.marcar_vencidas()
        qs = CredencialExternaModel.objects.select_related(
            'tipo_credencial', 'empleado'
        ).all()
        if tipo:
            qs = qs.filter(tipo_credencial_id=tipo)
        if grupo:
            qs = qs.filter(tipo_credencial__grupo=grupo)
        if estado:
            qs = qs.filter(estado=estado)
        if desde:
            qs = qs.filter(created_at__gte=desde)
        if hasta:
            qs = qs.filter(created_at__lte=hasta)
        return [credencial_externa_a_entidad(c) for c in qs.order_by('-created_at')]

    def obtener(self, credencial_id: str) -> CredencialExterna:
        fila = (
            CredencialExternaModel.objects.select_related('tipo_credencial', 'empleado')
            .filter(pk=credencial_id)
            .first()
        )
        if not fila:
            raise NotFoundError(f"Credencial {credencial_id} no encontrada")
        return credencial_externa_a_entidad(fila)

    def obtener_por_hash(self, security_hash: str) -> CredencialExterna | None:
        fila = (
            CredencialExternaModel.objects.select_related('tipo_credencial', 'empleado')
            .filter(security_hash=security_hash)
            .first()
        )
        return credencial_externa_a_entidad(fila) if fila else None

    def marcar_vencidas(self) -> int:
        """Anula sola la credencial al vencer; deja bitácora por cada una."""
        ahora = timezone.now()
        vencidas = list(
            CredencialExternaModel.objects.filter(
                estado=CredencialExternaModel.Estado.ACTIVA,
                vigencia_hasta__lt=ahora,
            )
        )
        for fila in vencidas:
            fila.estado = CredencialExternaModel.Estado.VENCIDA
            fila.save(update_fields=['estado', 'updated_at'])
            BitacoraAccesoQrModel.objects.create(
                security_hash=fila.security_hash,
                accion='VENCIDA',
                usuario_id=None,
                ip='',
                user_agent='sistema',
            )
        return len(vencidas)

    # --- Escritura ---
    def crear(
        self,
        *,
        tipo_codigo: str,
        grupo_esperado: str | None,
        nombre: str,
        documento: str,
        motivo: str,
        vigencia_desde: datetime,
        vigencia_hasta: datetime | None = None,
        correo: str = '',
        empresa: str = '',
        contrato: str = '',
        persona_visitada: str = '',
        empleado_cedula: str | None = None,
        observaciones: str = '',
        creado_por: Any | None = None,
    ) -> CredencialExterna:
        tipo = TipoCredencialModel.objects.filter(codigo=tipo_codigo, activo=True).first()
        if not tipo:
            raise ValidationError('Tipo de credencial no encontrado o inactivo.', 'tipo_credencial')
        if grupo_esperado and tipo.grupo != grupo_esperado:
            raise ValidationError(
                'El tipo de credencial no pertenece a esta pantalla.',
                'tipo_credencial',
            )
        if vigencia_hasta is None:
            # Sin fecha final: se aplica la vigencia por defecto (días) de Gestión del Sistema.
            vigencia_hasta = vencimiento_segun_parametros(vigencia_desde, TIPO_VIGENCIA_EXTERNO)
        if vigencia_hasta <= vigencia_desde:
            raise ValidationError(
                'La vigencia final debe ser posterior a la inicial.',
                'vigencia_hasta',
            )

        empleado = None
        if empleado_cedula:
            empleado = EmployeeModel.objects.filter(
                cedulaidentidad=empleado_cedula
            ).first()
            if not empleado:
                raise ValidationError(
                    f'Empleado con cédula {empleado_cedula} no encontrado.',
                    'empleado_cedula',
                )
        if tipo.grupo == 'temporal' and empleado is None:
            raise ValidationError(
                'La credencial temporal requiere un trabajador.',
                'empleado_cedula',
            )

        security_hash = codigo_qr_unico()
        creado_por_id = (
            getattr(creado_por, 'pk', None)
            if isinstance(creado_por, get_user_model())
            else None
        )
        plantilla = (
            PlantillaCarnetModel.objects.filter(tipo_credencial_id=tipo_codigo, activa=True).first()
            or PlantillaCarnetModel.objects.filter(tipo_credencial_id='trabajador', activa=True).first()
        )

        with transaction.atomic():
            fila = CredencialExternaModel.objects.create(
                tipo_credencial=tipo,
                empleado=empleado,
                nombre=nombre.strip()[:150],
                documento=documento.strip()[:50],
                correo=(correo or '').strip()[:254],
                empresa=(empresa or '').strip()[:150],
                contrato=(contrato or '').strip()[:100],
                persona_visitada=(persona_visitada or '').strip()[:150],
                motivo=motivo.strip()[:200],
                vigencia_desde=vigencia_desde,
                vigencia_hasta=vigencia_hasta,
                estado=CredencialExternaModel.Estado.ACTIVA,
                security_hash=security_hash,
                datos={
                    'nombre': nombre.strip()[:150],
                    'documento': documento.strip()[:50],
                    'empresa': (empresa or '').strip()[:150],
                    'contrato': (contrato or '').strip()[:100],
                    'persona_visitada': (persona_visitada or '').strip()[:150],
                    'motivo': motivo.strip()[:200],
                },
                plantilla_id=str(plantilla.pk) if plantilla else '',
                plantilla_version=plantilla.version if plantilla else None,
                plantilla_snapshot=plantilla.definicion if plantilla else None,
                observaciones=observaciones or '',
                creado_por_id=creado_por_id,
            )
            BitacoraAccesoQrModel.objects.create(
                security_hash=security_hash,
                accion='EMISION',
                usuario_id=getattr(creado_por, 'pk', None),
                ip='',
                user_agent='credenciales-externas',
            )
        return credencial_externa_a_entidad(fila)

    def devolver(self, credencial_id: str) -> CredencialExterna:
        fila = CredencialExternaModel.objects.filter(pk=credencial_id).first()
        if not fila:
            raise NotFoundError(f"Credencial {credencial_id} no encontrada")
        if fila.estado != CredencialExternaModel.Estado.ACTIVA:
            raise ValidationError('Solo se puede devolver una credencial activa.', 'estado')
        fila.estado = CredencialExternaModel.Estado.DEVUELTA
        fila.devuelta_en = timezone.now()
        fila.save(update_fields=['estado', 'devuelta_en', 'updated_at'])
        BitacoraAccesoQrModel.objects.create(
            security_hash=fila.security_hash,
            accion='DEVUELTA',
            ip='',
            user_agent='credenciales-externas',
        )
        return credencial_externa_a_entidad(fila)

    def anular(self, credencial_id: str) -> CredencialExterna:
        fila = CredencialExternaModel.objects.filter(pk=credencial_id).first()
        if not fila:
            raise NotFoundError(f"Credencial {credencial_id} no encontrada")
        fila.estado = CredencialExternaModel.Estado.ANULADA
        fila.anulada_en = timezone.now()
        fila.save(update_fields=['estado', 'anulada_en', 'updated_at'])
        BitacoraAccesoQrModel.objects.create(
            security_hash=fila.security_hash,
            accion='ANULADA',
            ip='',
            user_agent='credenciales-externas',
        )
        return credencial_externa_a_entidad(fila)

    # --- PDF / correo ---
    def _datos_pdf(self, fila: CredencialExternaModel) -> tuple[dict[str, Any], str]:
        definicion = fila.plantilla_snapshot
        if not definicion:
            plantilla = (
                PlantillaCarnetModel.objects.filter(
                    tipo_credencial_id=fila.tipo_credencial_id, activa=True
                ).first()
                or PlantillaCarnetModel.objects.filter(
                    tipo_credencial_id='trabajador', activa=True
                ).first()
            )
            definicion = (
                plantilla.definicion if plantilla else plantilla_defecto_trabajador()
            )

        foto_bytes = None
        if fila.empleado_id:
            emp = fila.empleado
            nombre = f"{emp.nombres} {emp.apellidos}".strip()
            cedula = str(emp.cedulaidentidad)
            asignacion = (
                AsigTrabajoModel.objects.select_related(
                    'denominacioncargoid', 'DireccionGeneral'
                )
                .filter(employee=emp)
                .order_by('-fecha_actualizacion')
                .first()
            )
            cargo = (
                str(asignacion.denominacioncargoid)
                if asignacion and asignacion.denominacioncargoid
                else ''
            )
            departamento = (
                asignacion.DireccionGeneral.direccion_general
                if asignacion and asignacion.DireccionGeneral
                else ''
            )
            if emp.profile:
                try:
                    foto_bytes = self._almacen.descargar(emp.profile) or None
                except Exception:
                    logger.warning(
                        'No se pudo leer la foto de la credencial externa.', exc_info=True,
                    )
                    foto_bytes = None
        else:
            nombre = fila.nombre
            cedula = fila.documento
            cargo = fila.empresa or fila.contrato
            departamento = fila.persona_visitada or fila.motivo

        datos = {
            'nombre_completo': nombre,
            'cedula': cedula,
            'cargo': cargo,
            'departamento': departamento,
            # El código del tipo hace de «nómina» (VISITANTE, CONTRATISTA...) para que las
            # Reglas de Color del diseñador puedan asignar colores propios a cada tipo.
            'nomina': str(fila.tipo_credencial_id or '').upper(),
            'externo': fila.empleado_id is None,
            'security_hash': fila.security_hash,
            'tipo_credencial': fila.tipo_credencial_id,
            'motivo': fila.motivo,
            'empresa': fila.empresa,
            'persona_visitada': fila.persona_visitada,
            'vigencia_desde': fila.vigencia_desde.isoformat(),
            'vigencia_hasta': fila.vigencia_hasta.isoformat(),
            'vence': fila.vigencia_hasta.strftime('%d/%m/%Y'),
            'foto_bytes': foto_bytes,
        }
        return datos, definicion

    def generar_pdf(self, credencial_id: str) -> bytes:
        fila = CredencialExternaModel.objects.select_related(
            'tipo_credencial', 'empleado'
        ).filter(pk=credencial_id).first()
        if not fila:
            raise NotFoundError(f"Credencial {credencial_id} no encontrada")
        datos, definicion = self._datos_pdf(fila)
        return generar_carnet_pdf_fiel(definicion, datos)

    def generar_pdf_lote(self, ids: list[str]) -> bytes:
        filas = list(
            CredencialExternaModel.objects.select_related('tipo_credencial', 'empleado')
            .filter(pk__in=ids)
            .order_by('created_at')
        )
        if not filas:
            raise ValidationError('Seleccione al menos una credencial para el lote.', 'ids')
        tarjetas = []
        for fila in filas:
            datos, definicion = self._datos_pdf(fila)
            tarjetas.append({'definicion': definicion, 'datos': datos})
        return generar_pdf_lote(tarjetas)

    def enviar_correo(self, credencial_id: str, destinatario: str | None = None) -> bool:
        fila = CredencialExternaModel.objects.select_related(
            'tipo_credencial', 'empleado'
        ).filter(pk=credencial_id).first()
        if not fila:
            raise NotFoundError(f"Credencial {credencial_id} no encontrada")
        correo = (destinatario or fila.correo or '').strip()
        if not correo:
            raise ValidationError('La credencial no tiene un correo configurado.', 'correo')
        pdf = self.generar_pdf(credencial_id)
        adjunto = AdjuntoOutbox(
            nombre=f"credencial-{fila.documento}.pdf",
            mime='application/pdf',
            contenido_b64=base64.b64encode(pdf).decode('ascii'),
        )
        with transaction.atomic():
            enviado = encolar_correo(
                RepoOutboxORM(),
                PlanificadorEnvioCelery(),
                tipo='carnet.credencial',
                destinatario=correo,
                destinatario_cedula=fila.documento,
                asunto='Credencial institucional GATH',
                titulo='Su credencial institucional',
                mensaje=(
                    f"Se adjunta la credencial de {fila.nombre}. "
                    f"Vigencia: {fila.vigencia_desde:%d/%m/%Y %H:%M} — "
                    f"{fila.vigencia_hasta:%d/%m/%Y %H:%M}."
                ),
                ref_id=str(fila.pk),
                adjuntos=(adjunto,),
            )
            if enviado:
                BitacoraAccesoQrModel.objects.create(
                    security_hash=fila.security_hash,
                    accion='CORREO_ENVIADO',
                    ip='',
                    user_agent='credenciales-externas',
                )
        return enviado
