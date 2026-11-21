"""Vistas de Captación (personal con permiso, token normal de empleado): alta del postulante y reposición de clave."""
from drf_spectacular.utils import extend_schema
from rest_framework.views import APIView

from apps.postulacion.application.use_cases.credenciales import alta_postulante_con_credencial, emitir_credencial
from apps.postulacion.infrastructure.hasheador_django import HasheadorDjango
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import BuscadorEmpleadosORM, RepoPostulacionORM
from apps.postulacion.presentation.permissions.postulante_permissions import permisos_captacion
from apps.postulacion.presentation.serializers.postulacion_serializers import (
    AltaPostulanteRespuestaSerializer,
    AltaPostulanteSerializer,
    CredencialEmitidaSerializer,
)
from apps.postulacion.presentation.views._comun import (
    a_dict_credencial,
    a_dict_expediente_resumen,
    ahora,
    auditar_captacion,
    configuracion,
    sin_cache,
    validar_entrada,
)
from core.domain.exceptions import PermissionDeniedError
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Postulación · Captación']
ERRORES = {
    400: MensajeRespuestaSerializer, 401: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer,
    404: MensajeRespuestaSerializer, 409: MensajeRespuestaSerializer,
}


def _cedula_del_analista(request) -> str:
    cedula = getattr(request.user, 'cedula_id', None)
    if not cedula:
        raise PermissionDeniedError("El usuario autenticado no tiene un expediente de trabajador asociado.")
    return str(cedula)


class AltaPostulanteView(APIView):
    """`postulacion.crear_postulante`: crea el postulante con su expediente y emite la credencial (clave UNA vez)."""

    permission_classes = permisos_captacion()

    @extend_schema(
        tags=TAG, summary='Alta del postulante con su expediente y credencial de la Ventana 1',
        request=AltaPostulanteSerializer, responses={201: AltaPostulanteRespuestaSerializer, **ERRORES},
    )
    def post(self, request):
        datos = validar_entrada(AltaPostulanteSerializer, request.data)
        alta = alta_postulante_con_credencial(
            RepoPostulacionORM(), BuscadorEmpleadosORM(), configuracion(), HasheadorDjango(),
            cedula=datos['cedula'], nombres=datos['nombres'], apellidos=datos['apellidos'],
            correo=datos.get('correo', ''), telefono_movil=datos.get('telefono_movil', ''),
            creado_por=_cedula_del_analista(request), ahora=ahora(),
        )
        auditar_captacion(
            request, 'POSTULANTE_CREADO', alta.expediente.id,
            {'cedula': alta.postulante.cedula, 'numero': alta.expediente.numero, 'reingreso': alta.es_reingreso,
             'ventana': alta.emision.credencial.ventana,
             'vence_el': alta.emision.credencial.vence_el.isoformat()},
        )
        p = alta.postulante
        return sin_cache(ok(
            {
                'postulante': {
                    'id': p.id, 'cedula': p.cedula, 'nombres': p.nombres, 'apellidos': p.apellidos,
                    'correo': p.correo, 'telefono_movil': p.telefono_movil,
                },
                'expediente': a_dict_expediente_resumen(alta.expediente), 'es_reingreso': alta.es_reingreso,
                'credencial': a_dict_credencial(alta.emision),
            },
            'Postulante creado. Entregue la contraseña temporal en persona: no se volverá a mostrar.', status=201,
        ))


class ReponerCredencialView(APIView):
    """`postulacion.crear_postulante`: nueva contraseña temporal; la anterior y las sesiones abiertas quedan invalidadas."""

    permission_classes = permisos_captacion()

    @extend_schema(
        tags=TAG, summary='Reponer la credencial (nueva contraseña temporal, una sola vez)', request=None,
        responses={200: CredencialEmitidaSerializer, **ERRORES},
    )
    def post(self, request, expediente_id):
        emision = emitir_credencial(
            RepoPostulacionORM(), HasheadorDjango(), expediente_id=str(expediente_id),
            emitida_por=_cedula_del_analista(request), ahora=ahora(),
        )
        auditar_captacion(
            request, 'CREDENCIAL_REPUESTA', emision.credencial.expediente_id,
            {'ventana': emision.credencial.ventana, 'vence_el': emision.credencial.vence_el.isoformat()},
        )
        return sin_cache(ok(
            a_dict_credencial(emision),
            'Credencial repuesta. Entregue la contraseña temporal en persona: no se volverá a mostrar.',
        ))
