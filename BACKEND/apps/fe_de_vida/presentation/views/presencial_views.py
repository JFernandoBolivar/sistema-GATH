"""
Vistas de FE DE VIDA PRESENCIAL (Bienestar Social):
Permite al personal de Bienestar registrar la fe de vida de un pasivo que acude en persona,
incluso si carece de cuenta o correo, reutilizando el mismo flujo y validaciones del asistente.
"""
from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.fe_de_vida.application.use_cases._comun import evento, obtener_solicitud
from apps.fe_de_vida.application.use_cases.consultas import buscar_pasivos_presencial, obtener_proceso_vigente
from apps.fe_de_vida.application.use_cases.solicitudes_pasivo import (
    guardar_borrador,
    iniciar_solicitud_vigente,
    subir_evidencia,
)
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.domain.events import PublicadorNulo, TipoEvento
from apps.fe_de_vida.domain.services.reglas_proceso import exigir_puede_enviar
from apps.fe_de_vida.domain.value_objects.estados import CONDICION_PASIVO, EstadoSolicitud, validar_transicion_solicitud
from apps.fe_de_vida.infrastructure.adaptadores_autogestion import RepoCambiosActaORM, ValidadorCambiosActaORM
from apps.fe_de_vida.infrastructure.imagen_evidencia import sanear_imagen
from apps.fe_de_vida.infrastructure.models.solicitud_models import SolicitudFeDeVidaModel
from apps.fe_de_vida.infrastructure.repositories.buscador_pasivos_presencial_orm import BuscadorPasivosPresencialORM
from apps.fe_de_vida.infrastructure.repositories.lector_alcance_orm import LectorAlcanceORM
from apps.fe_de_vida.infrastructure.repositories.lector_ficha_pasivo_orm import LectorFichaPasivoORM
from apps.fe_de_vida.infrastructure.repositories.repo_constancias_orm import RepoConstanciasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from apps.fe_de_vida.infrastructure.signals import PublicadorSenales
from apps.fe_de_vida.infrastructure.verificador_pasivo import VerificadorPasivoKernel
from apps.fe_de_vida.presentation.permissions import fe_de_vida_permissions as permisos
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import (
    BuscarPasivoPresencialSerializer,
    EnviarPresencialSerializer,
    GuardarBorradorSerializer,
    IniciarSolicitudPresencialSerializer,
    PasivoPresencialSerializer,
    SolicitudSerializer,
    SubirEvidenciaSerializer,
    a_cambio_acta,
    a_dict_cambio,
    a_dict_item_presencial,
    a_dict_proceso,
    a_dict_solicitud,
)
from apps.fe_de_vida.presentation.views._comun import (
    ahora,
    auditar,
    cedula_de_sesion,
    nombres_de_tipos,
    parametros_pagina,
    respuesta_pagina,
    resumen,
    validar_entrada,
)
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.storage.validacion_archivo import MAX_BYTES_FOTO, TIPOS_FOTO, validar_archivo
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Fe de vida · Presencial']
ERRORES = {
    400: MensajeRespuestaSerializer,
    403: MensajeRespuestaSerializer,
    404: MensajeRespuestaSerializer,
    409: MensajeRespuestaSerializer,
}


def _nombre_funcionario(user) -> str:
    emp = getattr(user, 'cedula', None)
    if emp is not None:
        nombres = getattr(emp, 'nombres', '')
        apellidos = getattr(emp, 'apellidos', '')
        completo = f'{nombres} {apellidos}'.strip()
        if completo:
            return completo
    return str(user)


def _cedula_funcionario(user) -> str:
    return str(getattr(user, 'cedula_id', '') or getattr(user, 'pk', ''))


class BuscarPasivoPresencialView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REGISTRAR_PRESENCIAL)

    @extend_schema(
        tags=TAG,
        summary='Buscar pasivos para registro de fe de vida presencial y ver su estado',
        description='Busca pasivos por cédula o nombre y consulta su estado en el proceso de fe de vida abierto o con prórroga.',
        parameters=[
            OpenApiParameter('texto', str, required=True, description='Cédula o nombre del pasivo'),
            OpenApiParameter('limit', int, description='Por defecto 10, máximo 50'),
            OpenApiParameter('offset', int),
        ],
        responses={200: PasivoPresencialSerializer(many=True), **ERRORES},
    )
    def get(self, request):
        filtros = validar_entrada(BuscarPasivoPresencialSerializer, request.query_params)
        texto = filtros['texto'].strip()
        limite, desplazamiento = parametros_pagina(filtros)

        buscador = BuscadorPasivosPresencialORM()
        repo_proc = RepoProcesosORM()
        repo_sol = RepoSolicitudesFeDeVidaORM()
        alcance = LectorAlcanceORM()
        repo_const = RepoConstanciasORM()

        items, total = buscar_pasivos_presencial(
            buscador,
            repo_proc,
            repo_sol,
            alcance,
            repo_const,
            texto=texto,
            limite=limite,
            desplazamiento=desplazamiento,
            ahora=ahora(),
        )

        resultados = [a_dict_item_presencial(i) for i in items]
        return ok(respuesta_pagina(total, filtros, resultados))


class IniciarOSolicitudPresencialView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REGISTRAR_PRESENCIAL)

    @extend_schema(
        tags=TAG,
        summary='Iniciar o continuar solicitud de fe de vida presencial',
        description='Obtiene o crea la solicitud presencial de un pasivo en el proceso vigente, cargando su expediente y borrador previo si existe.',
        request=IniciarSolicitudPresencialSerializer,
        responses={200: OpenApiTypes.OBJECT, **ERRORES},
    )
    def post(self, request):
        datos = validar_entrada(IniciarSolicitudPresencialSerializer, request.data)
        cedula = datos['cedula'].strip()
        momento = ahora()
        repo_proc = RepoProcesosORM()
        repo_sol = RepoSolicitudesFeDeVidaORM()
        alcance = LectorAlcanceORM()
        verificador = VerificadorPasivoKernel()
        repo_cambios = RepoCambiosActaORM()
        lector_ficha = LectorFichaPasivoORM()

        with transaction.atomic():
            vigente = obtener_proceso_vigente(repo_proc, repo_sol, alcance, cedula=cedula, ahora=momento)
            if vigente is None:
                raise ConflictError("No hay un proceso de fe de vida abierto o con prórroga vigente para este pasivo.")

            solicitud = repo_sol.obtener_de(vigente.proceso.id, cedula)
            funcionario_nombre = _nombre_funcionario(request.user)
            funcionario_cedula = _cedula_funcionario(request.user)

            if solicitud is None:
                solicitud = repo_sol.crear(SolicitudFeDeVida(
                    id='',
                    proceso_id=vigente.proceso.id,
                    cedula=cedula,
                    canal='PRESENCIAL',
                    registrada_por=funcionario_nombre,
                    registrada_por_cedula=funcionario_cedula,
                ))
                auditar(
                    request, 'SOLICITUD_PRESENCIAL_INICIADA', solicitud.id, None,
                    {'proceso_id': vigente.proceso.id, 'cedula': cedula, 'canal': 'PRESENCIAL'},
                )
            else:
                auditar(
                    request, 'SOLICITUD_PRESENCIAL_CONSULTADA', solicitud.id, None,
                    {'proceso_id': vigente.proceso.id, 'cedula': cedula, 'estado': solicitud.estado.value},
                )

            cambios = repo_cambios.listar(solicitud.id)
            ficha = lector_ficha.ficha(cedula)

        nombre_pasivo = f"{ficha['empleado'].get('nombres', '')} {ficha['empleado'].get('apellidos', '')}".strip()
        return ok({
            'solicitud': a_dict_solicitud(solicitud, nombre_pasivo),
            'cambios': [a_dict_cambio(c) for c in cambios],
            'ficha': ficha,
        })


class BorradorPresencialView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REGISTRAR_PRESENCIAL)

    @extend_schema(
        tags=TAG,
        summary='Guardar borrador de la fe de vida presencial',
        description='Actualiza las respuestas y cambios propuestos del acta en la solicitud presencial.',
        request=GuardarBorradorSerializer,
        responses={200: OpenApiTypes.OBJECT, **ERRORES},
    )
    def put(self, request, solicitud_id):
        datos = validar_entrada(GuardarBorradorSerializer, request.data)
        momento = ahora()
        repo_sol = RepoSolicitudesFeDeVidaORM()
        repo_proc = RepoProcesosORM()
        repo_cambios = RepoCambiosActaORM()
        validador = ValidadorCambiosActaORM()

        with transaction.atomic():
            solicitud = repo_sol.obtener(str(solicitud_id), bloquear=True)
            if solicitud is None:
                raise NotFoundError("La solicitud de fe de vida no existe.")
            if not solicitud.editable:
                raise ValidationError(f"La solicitud está {solicitud.estado.value}: ya no admite cambios.")
            exigir_puede_enviar(
                repo_proc.obtener(solicitud.proceso_id),
                repo_proc.listar_prorrogas(solicitud.proceso_id),
                solicitud.cedula,
                momento,
            )

            cambios_entrada = [a_cambio_acta(d) for d in datos['cambios']]
            guardados = guardar_borrador(
                repo_proc, repo_sol, repo_cambios, validador,
                solicitud_id=solicitud.id, cedula=solicitud.cedula,
                cambios=cambios_entrada, ahora=momento,
            )
            auditar(
                request, 'BORRADOR_PRESENCIAL_GUARDADO', solicitud.id, None,
                {'cambios_guardados': len(guardados)},
            )

        return ok({'solicitud': a_dict_solicitud(solicitud), 'cambios': [a_dict_cambio(c) for c in guardados]})


class EvidenciaPresencialView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REGISTRAR_PRESENCIAL)
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=TAG,
        summary='Subir o capturar foto con cédula en fe de vida presencial',
        description='Sube la foto tomada con la cámara del equipo o archivo subido por el funcionario.',
        request=SubirEvidenciaSerializer,
        responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(SubirEvidenciaSerializer, request.data)
        archivo = datos['file']
        contenido, tipo, _ext = validar_archivo(archivo, TIPOS_FOTO, MAX_BYTES_FOTO)
        contenido = sanear_imagen(contenido, tipo.mime)
        momento = ahora()
        repo_sol = RepoSolicitudesFeDeVidaORM()
        repo_proc = RepoProcesosORM()

        with transaction.atomic():
            solicitud = repo_sol.obtener(str(solicitud_id), bloquear=True)
            if solicitud is None:
                raise NotFoundError("La solicitud de fe de vida no existe.")

            actualizada = subir_evidencia(
                repo_proc, repo_sol, SeaweedFSStorage(),
                solicitud_id=solicitud.id, cedula=solicitud.cedula,
                contenido=contenido, mime=tipo.mime,
                origen=datos['origen'], metadatos=datos.get('metadatos'), ahora=momento,
            )
            auditar(
                request, 'EVIDENCIA_PRESENCIAL_SUBIDA', solicitud.id, None,
                {'origen': datos['origen'], 'tamano': len(contenido)},
            )

        return ok(a_dict_solicitud(actualizada), 'Foto registrada exitosamente.')


class EnviarPresencialView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REGISTRAR_PRESENCIAL)

    @extend_schema(
        tags=TAG,
        summary='Enviar fe de vida presencial a revisión',
        description='El funcionario certifica la comparecencia presencial del pasivo y envía la solicitud a revisión.',
        request=EnviarPresencialSerializer,
        responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(EnviarPresencialSerializer, request.data)
        if not datos.get('declaracion_presencial'):
            raise ValidationError(
                "Debe certificar la comparecencia y declaración presencial del pasivo.",
                campo='declaracion_presencial',
            )

        momento = ahora()
        repo_sol = RepoSolicitudesFeDeVidaORM()
        repo_proc = RepoProcesosORM()
        publicador = PublicadorSenales()

        with transaction.atomic():
            solicitud = repo_sol.obtener(str(solicitud_id), bloquear=True)
            if solicitud is None:
                raise NotFoundError("La solicitud de fe de vida no existe.")
            if not solicitud.editable:
                raise ConflictError(f"La solicitud está {solicitud.estado.value}: no puede enviarse.")
            if not solicitud.evidencia_clave:
                raise ValidationError("Debe tomar o adjuntar la foto del pasivo con su cédula antes de enviar.")

            exigir_puede_enviar(
                repo_proc.obtener(solicitud.proceso_id),
                repo_proc.listar_prorrogas(solicitud.proceso_id),
                solicitud.cedula,
                momento,
            )

            funcionario_nombre = _nombre_funcionario(request.user)
            funcionario_cedula = _cedula_funcionario(request.user)

            validar_transicion_solicitud(solicitud.estado, EstadoSolicitud.PENDIENTE_REVISION)

            from dataclasses import replace
            enviada = replace(
                solicitud,
                estado=EstadoSolicitud.PENDIENTE_REVISION,
                canal='PRESENCIAL',
                registrada_por=funcionario_nombre,
                registrada_por_cedula=funcionario_cedula,
                envios=solicitud.envios + 1,
                fecha_envio=momento,
                requiere_nueva_foto=False,
            )
            guardada = repo_sol.guardar(enviada, solicitud.version)

            auditar(
                request, 'FE_DE_VIDA_REGISTRADA_PRESENCIAL', guardada.id,
                resumen(solicitud),
                {
                    **resumen(guardada),
                    'canal': 'PRESENCIAL',
                    'registrada_por': funcionario_nombre,
                    'registrada_por_cedula': funcionario_cedula,
                },
            )
            publicador.publicar(evento(
                TipoEvento.SOLICITUD_ENVIADA, guardada, guardada.cedula,
                envio=guardada.envios, canal='PRESENCIAL',
            ))

        return ok(a_dict_solicitud(guardada), 'Fe de vida presencial enviada a revisión exitosamente.')
