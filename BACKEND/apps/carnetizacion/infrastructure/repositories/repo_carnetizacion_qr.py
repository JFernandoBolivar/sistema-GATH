"""Repositorio de carnetizaciÃ³n: qr."""
from typing import Any
from django.utils import timezone

from apps.carnetizacion.domain.entities.privacidad import (
    FichaQr,
    PRIVACIDAD_POR_DEFECTO,
    validar_preferencias_privacidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    PreferenciaPrivacidadCarnetModel,
    BitacoraAccesoQrModel,
)

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.personal.infrastructure.models.expediente_models import (
    ContactoEmergenciaModel,
    DatosViviendaModel,
    PerfilSaludModel,
)


from .repo_carnetizacion_comun import (
    vencimiento_de_carnet,
)


class RepoQrPrivacidadMixin:
    def _ficha_credencial_externa(
        self,
        externa: Any,
        security_hash: str,
        usuario_sesion: Any | None,
        ip: str,
        user_agent: str,
        accion: str,
    ) -> FichaQr:
        from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
            CredencialExternaModel,
        )

        ahora = timezone.now()
        estado = externa.estado
        if estado == CredencialExternaModel.Estado.ACTIVA and externa.vigencia_hasta < ahora:
            externa.estado = CredencialExternaModel.Estado.VENCIDA
            externa.save(update_fields=['estado', 'updated_at'])
            estado = CredencialExternaModel.Estado.VENCIDA

        if estado != CredencialExternaModel.Estado.ACTIVA:
            BitacoraAccesoQrModel.objects.create(
                security_hash=security_hash,
                accion='ESCANEO_NO_VALIDO',
                ip=ip,
                user_agent=user_agent,
            )
            estado_ui = (
                'VENCIDO'
                if estado == CredencialExternaModel.Estado.VENCIDA
                else 'ANULADO'
            )
            return FichaQr(
                es_valido=False,
                estado=estado_ui,
                mensaje='Esta credencial ya no está vigente.',
                security_hash=security_hash,
                fecha_vencimiento=externa.vigencia_hasta.strftime('%d/%m/%Y %H:%M'),
            )

        BitacoraAccesoQrModel.objects.create(
            security_hash=security_hash,
            accion=accion,
            ip=ip,
            user_agent=user_agent,
        )
        datos = {
            'nombre': externa.nombre,
            'cargo': externa.empresa or externa.contrato or externa.tipo_credencial.nombre,
            'ubicacion': externa.persona_visitada or externa.motivo,
            'tipo_credencial': externa.tipo_credencial.nombre,
            'empresa': externa.empresa,
            'motivo': externa.motivo,
            'vigencia_hasta': externa.vigencia_hasta.strftime('%d/%m/%Y %H:%M'),
        }
        return FichaQr(
            es_valido=True,
            estado='VIGENTE',
            mensaje='Credencial auténtica y vigente.',
            security_hash=security_hash,
            datos=datos,
            nivel_acceso='PUBLICO',
            fecha_vencimiento=externa.vigencia_hasta.strftime('%d/%m/%Y %H:%M'),
        )

    def consultar_ficha_qr(
        self,
        security_hash: str,
        usuario_sesion: Any | None = None,
        ip: str = "",
        user_agent: str = "",
        accion: str = "ESCANEO",
    ) -> FichaQr:
        carnet = (
            CarnetEmitidoModel.objects.select_related('employee', 'motivo')
            .filter(security_hash=security_hash)
            .first()
        )
        if not carnet:
            from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
                CredencialExternaModel,
            )

            externa = (
                CredencialExternaModel.objects.select_related('tipo_credencial')
                .filter(security_hash=security_hash)
                .first()
            )
            if externa:
                return self._ficha_credencial_externa(
                    externa, security_hash, usuario_sesion, ip, user_agent, accion
                )
            return FichaQr(
                es_valido=False,
                estado='NO_REGISTRADO',
                mensaje='Carnet no encontrado en el sistema.',
                security_hash=security_hash,
            )

        usuario_id = getattr(usuario_sesion, 'id', None) if (usuario_sesion and getattr(usuario_sesion, 'is_authenticated', False)) else None

        if not carnet.activo:
            BitacoraAccesoQrModel.objects.create(
                security_hash=security_hash,
                carnet_id=carnet.id,
                accion='ESCANEO_ANULADO',
                usuario_id=usuario_id,
                ip=ip,
                user_agent=user_agent,
            )
            return FichaQr(
                es_valido=False,
                estado='ANULADO',
                mensaje='Este carnet fue anulado. Si lo encontró, entréguelo a la institución.',
                datos=None,
                security_hash=security_hash,
            )

        # Vencimiento: fecha guardada al emitir (o calculada si el carnet es anterior).
        fecha_venc_dt = vencimiento_de_carnet(carnet)
        fecha_venc_str = fecha_venc_dt.strftime('%d/%m/%Y') if fecha_venc_dt else None
        if fecha_venc_dt and timezone.now() > fecha_venc_dt:
            BitacoraAccesoQrModel.objects.create(
                security_hash=security_hash,
                carnet_id=carnet.id,
                accion='ESCANEO_VENCIDO',
                usuario_id=usuario_id,
                ip=ip,
                user_agent=user_agent,
            )
            return FichaQr(
                es_valido=False,
                estado='VENCIDO',
                mensaje='Este carnet ha vencido. Si lo encontró, entréguelo a la institución.',
                datos=None,
                security_hash=security_hash,
                fecha_vencimiento=fecha_venc_str,
            )

        # Nivel de acceso según sesión y permisos
        es_autenticado = bool(usuario_sesion and getattr(usuario_sesion, 'is_authenticated', False))
        es_admin = False
        if es_autenticado:
            if getattr(usuario_sesion, 'is_superuser', False) or getattr(usuario_sesion, 'is_staff', False):
                es_admin = True
            elif hasattr(usuario_sesion, 'tiene_permiso') and (
                usuario_sesion.tiene_permiso('carnetizacion.gestionar') or usuario_sesion.tiene_permiso('personal.gestionar')
            ):
                es_admin = True
            elif hasattr(usuario_sesion, 'has_perm') and (
                usuario_sesion.has_perm('carnetizacion.gestionar') or usuario_sesion.has_perm('personal.gestionar')
            ):
                es_admin = True
            elif getattr(usuario_sesion, 'rol_id', None) == 'ADMINISTRADOR':
                es_admin = True

        if es_admin:
            nivel_acceso = 'ADMINISTRADOR'
        elif es_autenticado:
            nivel_acceso = 'CON_SESION'
        else:
            nivel_acceso = 'PUBLICO'

        # Preferencias de privacidad del trabajador
        pref_model = PreferenciaPrivacidadCarnetModel.objects.filter(employee_id=carnet.employee_id).first()
        preferencias = (
            validar_preferencias_privacidad(pref_model.preferencias)
            if (pref_model and pref_model.preferencias)
            else dict(PRIVACIDAD_POR_DEFECTO)
        )

        empleado = carnet.employee

        asig = (
            AsigTrabajoModel.objects.select_related('denominacioncargoid', 'DireccionGeneral')
            .filter(employee=empleado)
            .order_by('-fecha_actualizacion')
            .first()
        )
        cargo_str = str(asig.denominacioncargoid) if asig and asig.denominacioncargoid else 'Funcionario'
        codigo_cargo = getattr(asig.denominacioncargoid, 'codigo', '') if asig and asig.denominacioncargoid else ''
        ubicacion_str = asig.DireccionGeneral.direccion_general if asig and asig.DireccionGeneral else 'Oficina de Gestión Humana'

        contactos_qs = ContactoEmergenciaModel.objects.select_related('relacion').filter(empleado=empleado)[:3]
        contactos_lista = [
            {
                'nombre': c.nombre,
                'parentesco': str(c.relacion) if c.relacion else 'Contacto',
                'telefono': c.telefono,
            }
            for c in contactos_qs
        ]

        salud_datos = {'alergias': [], 'patologias': [], 'discapacidades': [], 'grupo_sanguineo': ''}
        ps = PerfilSaludModel.objects.select_related('grupo_sanguineo').prefetch_related(
            'alergias', 'patologiaCronica', 'discapacidad'
        ).filter(empleado=empleado).first()
        if ps:
            salud_datos['grupo_sanguineo'] = str(ps.grupo_sanguineo) if ps.grupo_sanguineo else ''
            salud_datos['alergias'] = [str(a) for a in ps.alergias.all()]
            salud_datos['patologias'] = [str(p) for p in ps.patologiaCronica.all()]
            salud_datos['discapacidades'] = [str(d) for d in ps.discapacidad.all()]

        def dato_permitido(clave: str) -> bool:
            if nivel_acceso == 'ADMINISTRADOR':
                return True
            nivel_dato = preferencias.get(clave, PRIVACIDAD_POR_DEFECTO.get(clave, 'SOLO_PERSONAL'))
            if nivel_dato == 'PUBLICO':
                return True
            if nivel_dato == 'CON_SESION' and nivel_acceso in ('CON_SESION', 'ADMINISTRADOR'):
                return True
            return False

        datos_filtrados: dict[str, Any] = {}

        if dato_permitido('nombre'):
            datos_filtrados['nombre'] = f"{empleado.nombres} {empleado.apellidos}".strip()
        else:
            datos_filtrados['nombre'] = f"{empleado.nombres[:1]}. {empleado.apellidos}".strip()

        if dato_permitido('foto'):
            datos_filtrados['foto_url'] = empleado.profile or ''

        if dato_permitido('cargo'):
            datos_filtrados['cargo'] = cargo_str
            if nivel_acceso in ('CON_SESION', 'ADMINISTRADOR') and codigo_cargo:
                datos_filtrados['codigo_cargo'] = codigo_cargo

        if dato_permitido('ubicacion'):
            datos_filtrados['ubicacion'] = ubicacion_str

        if dato_permitido('cedula'):
            datos_filtrados['cedula'] = empleado.cedulaidentidad
        else:
            datos_filtrados['cedula'] = None

        if dato_permitido('fecha_nacimiento'):
            datos_filtrados['fecha_nacimiento'] = empleado.fecha_nacimiento.strftime('%d/%m/%Y') if empleado.fecha_nacimiento else None
        else:
            datos_filtrados['fecha_nacimiento'] = None

        if dato_permitido('contactos_emergencia'):
            datos_filtrados['contactos_emergencia'] = contactos_lista
        else:
            datos_filtrados['contactos_emergencia'] = []

        salud_disp = dato_permitido('salud')
        if nivel_acceso in ('CON_SESION', 'ADMINISTRADOR'):
            datos_filtrados['salud'] = salud_datos
            salud_disp = True
        elif accion == 'APERTURA_MEDICA' and salud_disp:
            datos_filtrados['salud'] = salud_datos
        else:
            datos_filtrados['salud'] = None

        if nivel_acceso == 'ADMINISTRADOR':
            dv = DatosViviendaModel.objects.filter(empleado=empleado).first()
            datos_filtrados['direccion_vivienda'] = str(dv.direccion_completa or dv.calle_avenida or '') if dv else ''
            datos_filtrados['expediente_completo_autorizado'] = True

        if accion == 'APERTURA_MEDICA':
            accion_log = 'APERTURA_MEDICA'
        elif nivel_acceso == 'ADMINISTRADOR':
            accion_log = 'CONSULTA_ADMIN'
        elif nivel_acceso == 'CON_SESION':
            accion_log = 'ESCANEO_AUTENTICADO'
        else:
            accion_log = 'ESCANEO_PUBLICO'

        BitacoraAccesoQrModel.objects.create(
            security_hash=security_hash,
            carnet_id=carnet.id,
            accion=accion_log,
            usuario_id=usuario_id,
            ip=ip,
            user_agent=user_agent,
        )

        return FichaQr(
            es_valido=True,
            estado='VIGENTE',
            mensaje='Carnet vigente y verificado.',
            security_hash=security_hash,
            nivel_acceso=nivel_acceso,
            datos=datos_filtrados,
            salud_disponible=salud_disp,
            fecha_emision=carnet.fecha_emision.strftime('%d/%m/%Y') if carnet.fecha_emision else None,
            fecha_vencimiento=fecha_venc_str,
        )






