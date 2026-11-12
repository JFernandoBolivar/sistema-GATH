"""
Punto único para pedir una exportación desde las vistas de PDF/Excel.

Las vistas de reportes, movimientos y auditoría conservan su URL, su método y su
permiso (`reportes.generar_pdf`, `movimientos.exportar_excel`, ...). Lo único que
cambió es la respuesta: en vez de generar el archivo dentro de la petición, crean
un trabajo y devuelven 202 con su id.

Los filtros se validan ANTES de encolar (un filtro inválido es un 400 inmediato)
y el permiso de estructura organizativa se evalúa aquí, con el motor IAM, y se
guarda como booleano en los parámetros del trabajo (el worker no tiene sesión).
"""
from datetime import datetime, timezone

from django.conf import settings

from apps.exportaciones.application.use_cases.gestionar_exportaciones import solicitar_exportacion
from apps.exportaciones.infrastructure.auditor import auditor_de_peticion
from apps.exportaciones.infrastructure.generadores import validar_parametros
from apps.exportaciones.infrastructure.repositories.repo_exportaciones_orm import (
    RepoExportacionesORM,
)
from apps.exportaciones.presentation.serializers.exportaciones_serializers import (
    TrabajoExportacionSerializer,
)
from core.infrastructure.auditoria_contexto import origen_para_tarea
from core.infrastructure.tasks.celery_queue import CeleryTaskQueue
from core.presentation.envelope import ok

PERMISO_ESTRUCTURA_ORGANIZATIVA = 'organizacion.ver'


def _cedula_de(user) -> str:
    return str(getattr(user, 'cedula_id', '') or getattr(user, 'cedula', '') or '')


def pedir_exportacion(
    request, *, tipo: str, formato: str, extra: dict | None = None, quitar_filtros: tuple = (),
):
    """Crea el trabajo y responde 202 con su estado inicial."""
    from core.presentation.permissions import usuario_tiene_permiso

    user = request.user
    parametros = {
        # `.dict()`: un valor escalar por clave (igual que las vistas síncronas).
        'filtros': {k: v for k, v in request.query_params.dict().items() if k not in quitar_filtros},
        'puede_filtrar_estructura': usuario_tiene_permiso(user, PERMISO_ESTRUCTURA_ORGANIZATIVA),
        'usuario_nombre': str(user),
        **(extra or {}),
    }
    validar_parametros(tipo, parametros)
    trabajo = solicitar_exportacion(
        RepoExportacionesORM(),
        CeleryTaskQueue(),
        auditor_de_peticion(request, getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''),
        solicitante_id=getattr(user, 'pk', None),
        solicitante_cedula=_cedula_de(user),
        tipo=tipo,
        formato=formato,
        parametros=parametros,
        ahora=datetime.now(timezone.utc),
        ttl_horas=settings.EXPORTACIONES_TTL_HORAS,
        max_activas=settings.EXPORTACIONES_MAX_ACTIVAS_POR_USUARIO,
        origen=origen_para_tarea(),
    )
    return ok(
        TrabajoExportacionSerializer(trabajo).data,
        message='Exportación en proceso. Consulte su estado para descargarla.',
        status=202,
    )
