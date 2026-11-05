"""Casos de uso de las estadísticas de fe de vida (O21). Sin Django."""
import uuid
from collections.abc import Mapping
from datetime import date

from apps.fe_de_vida.domain.entities.estadisticas import (
    EstadisticasFeDeVida,
    FiltroEstadisticas,
    PasivoEstadistica,
    ProcesoResumen,
)
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida
from apps.fe_de_vida.domain.ports.repos import LectorAlcance, RepoEstadisticas, RepoProcesos
from apps.fe_de_vida.domain.value_objects.estados import CANALES_SOLICITUD, EstadoProceso, EstadoSolicitud
from core.domain.exceptions import NotFoundError, ValidationError


def _texto(valor) -> str | None:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def _fecha(valor, campo: str) -> date | None:
    texto = _texto(valor)
    if texto is None:
        return None
    try:
        return date.fromisoformat(texto)
    except ValueError as exc:
        raise ValidationError('La fecha debe tener el formato AAAA-MM-DD.', campo=campo) from exc


def normalizar_filtros(datos: Mapping | None) -> FiltroEstadisticas:
    """Valida los parámetros de la pantalla y del archivo exportado (400 con campo)."""
    datos = datos or {}
    proceso_id = _texto(datos.get('proceso_id'))
    if proceso_id is not None:
        try:
            uuid.UUID(proceso_id)
        except (ValueError, AttributeError) as exc:
            raise ValidationError('El proceso indicado no es válido.', campo='proceso_id') from exc

    tipo_nomina_id = None
    if _texto(datos.get('tipo_nomina_id')):
        try:
            tipo_nomina_id = int(datos['tipo_nomina_id'])
        except (TypeError, ValueError) as exc:
            raise ValidationError('El tipo de pasivo debe ser un número.', campo='tipo_nomina_id') from exc
        if tipo_nomina_id <= 0:
            raise ValidationError('El tipo de pasivo no es válido.', campo='tipo_nomina_id')

    estado = _texto(datos.get('estado'))
    if estado is not None and estado not in {e.value for e in EstadoSolicitud}:
        raise ValidationError('El estado de la fe de vida no es válido.', campo='estado')

    canal = _texto(datos.get('canal'))
    if canal is not None and canal not in CANALES_SOLICITUD:
        raise ValidationError('El canal no es válido.', campo='canal')

    desde = _fecha(datos.get('desde'), 'desde')
    hasta = _fecha(datos.get('hasta'), 'hasta')
    if desde and hasta and desde > hasta:
        raise ValidationError('El rango de fechas es inválido: "desde" es posterior a "hasta".', campo='desde')

    return FiltroEstadisticas(
        proceso_id=proceso_id, tipo_nomina_id=tipo_nomina_id, estado=estado, canal=canal,
        desde=desde, hasta=hasta,
    )


def _resumen(proceso: ProcesoFeDeVida) -> ProcesoResumen:
    return ProcesoResumen(
        id=proceso.id, nombre=proceso.nombre, estado=proceso.estado.value,
        apertura=proceso.fecha_apertura, cierre=proceso.fecha_cierre,
    )


def _procesos(repo_proc: RepoProcesos) -> tuple[ProcesoResumen, ...]:
    return tuple(_resumen(p) for p in repo_proc.listar())


def resolver_proceso(repo_proc: RepoProcesos, proceso_id: str | None) -> ProcesoFeDeVida | None:
    """El proceso pedido o, por defecto, el vigente (el ABIERTO más reciente)."""
    if proceso_id:
        proceso = repo_proc.obtener(proceso_id)
        if proceso is None:
            raise NotFoundError('El proceso de fe de vida no existe.')
        return proceso
    abiertos = repo_proc.listar(EstadoProceso.ABIERTO.value)
    return max(abiertos, key=lambda p: p.fecha_apertura) if abiertos else None


def calcular_estadisticas(
    repo: RepoEstadisticas,
    repo_proc: RepoProcesos,
    alcance: LectorAlcance,
    *,
    filtro: FiltroEstadisticas,
) -> EstadisticasFeDeVida:
    """KPIs, desgloses, matriz y catálogo de tipos para el proceso y filtros pedidos."""
    proceso = resolver_proceso(repo_proc, filtro.proceso_id)
    procesos = _procesos(repo_proc)
    tipos = tuple(alcance.tipos_pension())
    if proceso is None:
        return EstadisticasFeDeVida(proceso=None, procesos=procesos, tipos=tipos, filtro=filtro)
    conteos = repo.contar(proceso, filtro)
    return EstadisticasFeDeVida(
        proceso=_resumen(proceso), procesos=procesos, tipos=tipos, conteos=conteos, filtro=filtro,
    )


def listar_pasivos_estadistica(
    repo: RepoEstadisticas,
    repo_proc: RepoProcesos,
    *,
    filtro: FiltroEstadisticas,
    faltantes: bool,
    limite: int,
    desplazamiento: int,
) -> tuple[list[PasivoEstadistica], int]:
    """Listado paginado del detalle («faltan por responder» o una casilla de la matriz)."""
    proceso = resolver_proceso(repo_proc, filtro.proceso_id)
    if proceso is None:
        return [], 0
    return repo.listar(proceso, filtro, faltantes=faltantes, limite=limite, desplazamiento=desplazamiento)
