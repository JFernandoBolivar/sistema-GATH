"""Vistas del postulante (invitado): acceso, cambio de clave, su expediente, borrador y envío (D-4)."""
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.postulacion.application.use_cases.credenciales import autenticar_postulante, cambiar_clave
from apps.postulacion.application.use_cases.mi_expediente import (
    consultar_mi_expediente,
    enviar_expediente,
    guardar_borrador,
)
from apps.postulacion.domain.errores import ErrorAccesoPostulante
from apps.postulacion.domain.services.credencial import expiracion_sesion
from apps.postulacion.infrastructure.hasheador_django import HasheadorDjango
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from apps.postulacion.infrastructure.tokens.sesion_invitado import emitir_token_invitado
from apps.postulacion.presentation.authentication import PostulanteJWTAuthentication
from apps.postulacion.presentation.permissions.postulante_permissions import EsPostulante
from apps.postulacion.presentation.serializers.postulacion_serializers import (
    AccesoSerializer,
    BorradorSerializer,
    CambiarClaveSerializer,
    EnvioSerializer,
    MiExpedienteSerializer,
    SesionInvitadoSerializer,
)
from apps.postulacion.presentation.views._comun import (
    ErroresAccesoMixin,
    VistaPostulante,
    a_dict_expediente_resumen,
    a_dict_mi_expediente,
    ahora,
    auditar_postulante,
    configuracion,
    registrar_rechazo,
    sin_cache,
    validar_entrada,
)
from core.infrastructure.providers import obtener_notificador
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Postulación · Postulante']
ERRORES = {
    400: MensajeRespuestaSerializer, 401: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer,
    404: MensajeRespuestaSerializer, 409: MensajeRespuestaSerializer, 429: MensajeRespuestaSerializer,
}


def _sesion(credencial, expediente, momento) -> dict:
    """Respuesta con el token de invitado (≤ 2 h y nunca más allá del vencimiento de la credencial)."""
    expira = expiracion_sesion(credencial, momento)
    token = emitir_token_invitado(
        cedula=credencial.usuario, expediente_id=expediente.id, version_sesion=credencial.version_sesion,
        ahora=momento, expira_el=expira,
    )
    return {
        'token': token, 'tipo': 'Bearer', 'scope': f'expediente:{expediente.id}', 'expira_el': expira,
        'expira_en_segundos': max(0, int((expira - momento).total_seconds())),
        'debe_cambiar_clave': credencial.debe_cambiar_clave, 'expediente': a_dict_expediente_resumen(expediente),
    }


class AccesoView(ErroresAccesoMixin, APIView):
    """Cédula + contraseña -> sesión de invitado. Sin autenticación previa; con throttle por IP y bloqueo por credencial."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    @extend_schema(
        tags=TAG, summary='Acceso del postulante (sesión de invitado)', request=AccesoSerializer,
        description=(
            "Devuelve un JWT de invitado propio (≤ 2 h, ligado al expediente, `scope=expediente:<id>`) que SOLO sirve "
            "en las rutas del postulante. 5 intentos fallidos bloquean 15 minutos (429). Si es la primera entrada "
            "con el expediente PRE_REGISTRADO, pasa a EN_CAPTURA."
        ),
        responses={200: SesionInvitadoSerializer, **ERRORES},
    )
    def post(self, request):
        datos = validar_entrada(AccesoSerializer, request.data)
        cedula = datos['cedula'].strip()
        momento = ahora()
        try:
            acceso = autenticar_postulante(
                RepoPostulacionORM(), HasheadorDjango(), configuracion(),
                cedula=cedula, clave=datos['password'], ahora=momento,
            )
        except ErrorAccesoPostulante as exc:
            registrar_rechazo(request, exc, cedula)
            raise
        auditar_postulante(
            request, 'POSTULANTE_ACCESO', acceso.credencial.usuario, acceso.expediente.id,
            {'estado': acceso.expediente.estado.value, 'ventana': acceso.credencial.ventana,
             'primer_acceso': acceso.primer_acceso},
        )
        return sin_cache(ok(_sesion(acceso.credencial, acceso.expediente, momento), 'Acceso concedido.'))


class CambiarClaveView(ErroresAccesoMixin, APIView):
    """
    Cambio de la contraseña temporal. Es la única ruta autenticada que NO exige la clave al día (es justo la que
    la deja al día). Devuelve una sesión nueva: las demás sesiones abiertas dejan de valer.
    """

    authentication_classes = [PostulanteJWTAuthentication]
    permission_classes = [EsPostulante]
    throttle_scope = 'login'

    @extend_schema(
        tags=TAG, summary='Cambiar la contraseña (obligatorio en el primer ingreso)', request=CambiarClaveSerializer,
        responses={200: SesionInvitadoSerializer, **ERRORES},
    )
    def post(self, request):
        datos = validar_entrada(CambiarClaveSerializer, request.data)
        sesion = request.user
        momento = ahora()
        repo = RepoPostulacionORM()
        credencial = cambiar_clave(
            repo, HasheadorDjango(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            clave_actual=datos['clave_actual'], clave_nueva=datos['clave_nueva'], ahora=momento,
        )
        vista = consultar_mi_expediente(repo, expediente_id=sesion.expediente_id, cedula=sesion.cedula)
        auditar_postulante(request, 'POSTULANTE_CLAVE_CAMBIADA', sesion.cedula, sesion.expediente_id)
        return sin_cache(ok(_sesion(credencial, vista.expediente, momento), 'Contraseña actualizada.'))


class MiExpedienteView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Mi expediente: estado, ventana, vencimiento y observaciones',
        responses={200: MiExpedienteSerializer, **ERRORES},
    )
    def get(self, request):
        sesion = request.user
        vista = consultar_mi_expediente(RepoPostulacionORM(), expediente_id=sesion.expediente_id, cedula=sesion.cedula)
        return sin_cache(ok(a_dict_mi_expediente(vista)))


class BorradorView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Guardar el borrador de la ventana actual', request=BorradorSerializer,
        responses={200: MiExpedienteSerializer, **ERRORES},
    )
    def put(self, request):
        datos = validar_entrada(BorradorSerializer, request.data)
        sesion = request.user
        repo = RepoPostulacionORM()
        guardar_borrador(
            repo, configuracion(), expediente_id=sesion.expediente_id, cedula=sesion.cedula,
            nombres=datos['nombres'], apellidos=datos['apellidos'], correo=datos.get('correo'),
            telefono_movil=datos.get('telefono_movil'), datos_ventana1=datos.get('datos_ventana1'),
            ahora=ahora(),
        )
        vista = consultar_mi_expediente(repo, expediente_id=sesion.expediente_id, cedula=sesion.cedula)
        return sin_cache(ok(a_dict_mi_expediente(vista), 'Borrador guardado.'))


class EnviarView(VistaPostulante):
    @extend_schema(
        tags=TAG, summary='Enviar la ventana actual a Captación', request=None,
        description=(
            "EN_CAPTURA o EN_CORRECCION_DATOS -> ENVIADO_CAPTACION; CONSOLIDANDO -> EN_REVISION_FINAL. "
            "La sesión se cierra: el token deja de valer al enviar."
        ),
        responses={200: EnvioSerializer, **ERRORES},
    )
    def post(self, request):
        sesion = request.user
        repo = RepoPostulacionORM()
        enviar_expediente(
            repo, configuracion(), expediente_id=sesion.expediente_id, cedula=sesion.cedula, ahora=ahora(),
            notificador=obtener_notificador(),
        )
        vista = consultar_mi_expediente(repo, expediente_id=sesion.expediente_id, cedula=sesion.cedula)
        auditar_postulante(
            request, 'POSTULANTE_ENVIO', sesion.cedula, sesion.expediente_id,
            {'estado': vista.expediente.estado.value},
        )
        return sin_cache(ok(
            {'sesion_cerrada': True, 'expediente': a_dict_mi_expediente(vista)['expediente']},
            'Expediente enviado a Captación.',
        ))
