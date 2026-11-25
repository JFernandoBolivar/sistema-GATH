"""Casos de uso de emisión, consulta y vinculación documental del Punto de Cuenta."""
from datetime import datetime
from typing import Any

from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from apps.puntocuenta.domain.exceptions import DocumentoPuntoCuentaNoDisponible
from apps.puntocuenta.domain.ports.generador_punto_cuenta import DocumentoPuntoCuenta, GeneradorPuntoCuenta
from apps.puntocuenta.domain.ports.repo_documento_generado import RepoDocumentoGenerado
from apps.puntocuenta.domain.ports.repo_punto_cuenta import RepoPuntoCuenta
from apps.puntocuenta.domain.services.variables_plantilla import formatear_fecha_larga

PRESENTADO_A_POR_DEFECTO = 'Director(a) General de la Comisión Nacional de Telecomunicaciones'
CARGO_PRESENTADO_A_POR_DEFECTO = 'Director(a) General'
PRESENTADO_POR_POR_DEFECTO = 'Director(a) General de Gestión Humana'
CARGO_PRESENTADO_POR_POR_DEFECTO = 'Director(a) General de Gestión Humana'
UNIDAD_POR_DEFECTO = 'Dirección General de Gestión Humana'


def _a_dto(entidad) -> PuntoCuentaDTO:
    return PuntoCuentaDTO(
        id=str(entidad.id),
        cargo_id=entidad.cargo_id,
        empleado_cedula=entidad.empleado_cedula,
        empleado_nombre=entidad.empleado_nombre,
        dependencia_origen_id=entidad.dependencia_origen_id,
        dependencia_origen_nombre=entidad.dependencia_origen_nombre,
        dependencia_destino_id=entidad.dependencia_destino_id,
        dependencia_destino_nombre=entidad.dependencia_destino_nombre,
        motivo_id=entidad.motivo_id,
        motivo_nombre=entidad.motivo_nombre,
        usuario_id=entidad.usuario_id,
        fecha=entidad.fecha,
        documento_pdf_clave=entidad.documento_pdf_clave,
        documento_generado=bool(entidad.documento_pdf_clave or entidad.documento_generado_id),
        documento_generado_id=entidad.documento_generado_id,
        proceso=entidad.proceso,
        oficina_origen_id=entidad.oficina_origen_id,
        oficina_origen=entidad.oficina_origen_nombre,
        oficina_destino_id=entidad.oficina_destino_id,
        oficina_destino=entidad.oficina_destino_nombre,
        division_origen_id=entidad.division_origen_id,
        division_origen=entidad.division_origen_nombre,
        division_destino_id=entidad.division_destino_id,
        division_destino=entidad.division_destino_nombre,
        numero=entidad.numero,
        anio=entidad.anio,
        secuencia=entidad.secuencia,
        cargo_codigo=entidad.cargo_codigo,
        cargo_nombre=entidad.cargo_nombre,
        configuracion_version=entidad.configuracion_version,
        snapshot_formato=entidad.snapshot_formato,
    )


def generar_punto_cuenta(
    repo: RepoPuntoCuenta,
    *,
    cargo_id: int,
    cedula: str,
    dependencia_origen_id: int | None,
    dependencia_destino_id: int | None,
    motivo_id: int | None,
    usuario_id: int | None,
    oficina_origen_id: int | None = None,
    oficina_destino_id: int | None = None,
    division_origen_id: int | None = None,
    division_destino_id: int | None = None,
    numero: str | None = None,
    proceso: str = '',
    anio: int | None = None,
    secuencia: int | None = None,
    configuracion_version: int | None = None,
    snapshot_formato: dict | None = None,
) -> PuntoCuentaDTO:
    """Crea el registro; la emisión completa lo vincula después a su documento."""
    entidad = repo.crear(
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_origen_id,
        dependencia_destino_id=dependencia_destino_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
        oficina_origen_id=oficina_origen_id,
        oficina_destino_id=oficina_destino_id,
        division_origen_id=division_origen_id,
        division_destino_id=division_destino_id,
        numero=numero,
        proceso=proceso,
        anio=anio,
        secuencia=secuencia,
        configuracion_version=configuracion_version,
        snapshot_formato=snapshot_formato,
    )
    return _a_dto(entidad)


def _lugar(oficina: str | None, nivel: str | None, mostrar_nivel: bool) -> str:
    if not oficina and not nivel:
        return 'N/A'
    if not mostrar_nivel:
        return oficina or nivel or 'N/A'
    if oficina and nivel:
        return f'{oficina} ({nivel})'
    return oficina or nivel or 'N/A'


def datos_para_documento(dto: PuntoCuentaDTO) -> tuple[dict[str, str], dict[str, str]]:
    """Prepara las variables del catálogo y los campos propios de compatibilidad."""
    try:
        fecha_dt = datetime.fromisoformat(dto.fecha[:10])
    except (TypeError, ValueError):
        try:
            fecha_dt = datetime.strptime(dto.fecha[:10], '%d/%m/%Y')
        except (TypeError, ValueError):
            fecha_dt = datetime.now()
    fecha_corta = fecha_dt.strftime('%d/%m/%Y')
    cargo = dto.cargo_nombre or dto.cargo_codigo or (str(dto.cargo_id) if dto.cargo_id else 'N/A')
    origen = _lugar(dto.oficina_origen, dto.dependencia_origen_nombre, True)
    destino = _lugar(dto.oficina_destino, dto.dependencia_destino_nombre, True)
    origen_sin_nivel = _lugar(dto.oficina_origen, dto.dependencia_origen_nombre, False)
    destino_sin_nivel = _lugar(dto.oficina_destino, dto.dependencia_destino_nombre, False)
    referencia = dto.referencia_constancia or 'N/A'
    datos = {
        'numero': dto.numero or str(dto.id),
        'fecha': fecha_corta,
        'fecha_hoy': fecha_corta,
        'fecha_larga': formatear_fecha_larga(fecha_dt),
        'dia': f'{fecha_dt.day:02d}',
        'mes': f'{fecha_dt.month:02d}',
        'anio': str(fecha_dt.year),
        'nombre_completo': dto.empleado_nombre or 'N/A',
        'cedula': dto.empleado_cedula or 'N/A',
        'cargo': cargo,
        'cargo_destino': dto.cargo_destino or cargo,
        'codigo_cargo': dto.cargo_codigo or 'N/A',
        'nivel': dto.nivel or dto.dependencia_destino_nombre or dto.dependencia_origen_nombre or 'Nivel Central',
        'tipo_personal': dto.tipo_personal or 'PERSONAL FIJO',
        'origen': origen,
        'destino': destino,
        'oficina': destino,
        'division': dto.division_destino or dto.division_origen or 'N/A',
        'motivo': dto.motivo_nombre or 'N/A',
        'fecha_efectiva': dto.fecha_efectiva or fecha_corta,
        'fecha_ingreso': dto.fecha_ingreso or 'N/A',
        'anios_servicio': str(dto.anios_servicio or 'N/A'),
        'presentado_a': dto.presentado_a or PRESENTADO_A_POR_DEFECTO,
        'cargo_presentado_a': dto.cargo_presentado_a or CARGO_PRESENTADO_A_POR_DEFECTO,
        'presentado_por': dto.presentado_por or PRESENTADO_POR_POR_DEFECTO,
        'cargo_presentado_por': dto.cargo_presentado_por or CARGO_PRESENTADO_POR_POR_DEFECTO,
        'unidad': dto.unidad or UNIDAD_POR_DEFECTO,
        'referencia_constancia': referencia,
        'emitido_por': dto.emitido_por or 'N/A',
    }
    propios = {
        'origen_sin_nivel': origen_sin_nivel,
        'destino_sin_nivel': destino_sin_nivel,
        'frase_reserva': (
            'El puesto fue reservado para este ingreso y la disponibilidad presupuestaria quedó declarada con la '
            f'referencia {dto.referencia_constancia}.'
            if dto.referencia_constancia else 'El puesto fue reservado para este ingreso.'
        ),
    }
    return datos, propios


def generar_documento_punto_cuenta(
    generador: GeneradorPuntoCuenta,
    dto: PuntoCuentaDTO,
    *,
    proceso: str | None = None,
    datos_adicionales: dict[str, Any] | None = None,
) -> DocumentoPuntoCuenta:
    """Genera desde la plantilla publicada del proceso y devuelve su trazabilidad."""
    from dataclasses import replace

    if datos_adicionales:
        dto = replace(dto, **datos_adicionales)
    datos, propios = datos_para_documento(dto)
    return generador.generar(
        proceso or dto.proceso,
        sujeto_id=str(dto.id),
        datos=datos,
        actor_id=dto.usuario_id,
        valores_propios=propios,
        trabajador_cedula=dto.empleado_cedula or '',
    )


def adjuntar_documento_punto_cuenta(
    repo: RepoPuntoCuenta,
    id: Any,
    clave: str,
    documento_generado_id: str | None = None,
) -> PuntoCuentaDTO:
    return _a_dto(repo.adjuntar_documento(id, clave, documento_generado_id))


def resolver_pdf_para_descarga(
    repo: RepoPuntoCuenta,
    repo_documentos: RepoDocumentoGenerado,
    dto: PuntoCuentaDTO,
) -> PuntoCuentaDTO:
    """Recupera la clave del DocumentoGenerado guardado, sin volver a renderizar."""
    if dto.documento_pdf_clave:
        return dto
    if not dto.documento_generado_id:
        detalle = (
            'El registro histórico no tiene PDF y no identifica su proceso; no se puede regenerar.'
            if not dto.proceso else
            'El Punto de Cuenta no tiene un DocumentoGenerado vinculado; no se volverá a renderizar.'
        )
        raise DocumentoPuntoCuentaNoDisponible(detalle)
    documento = repo_documentos.obtener(dto.documento_generado_id)
    if documento is None or not documento.pdf_clave:
        raise DocumentoPuntoCuentaNoDisponible(
            'El DocumentoGenerado vinculado ya no está disponible; no se volverá a renderizar.',
        )
    return adjuntar_documento_punto_cuenta(repo, dto.id, documento.pdf_clave, documento.id)


def listar_puntos_cuenta(repo: RepoPuntoCuenta, filtros: dict | None = None) -> list[PuntoCuentaDTO]:
    return [_a_dto(e) for e in repo.listar(filtros)]


def obtener_punto_cuenta(repo: RepoPuntoCuenta, id: Any) -> PuntoCuentaDTO | None:
    entidad = repo.obtener_por_id(id)
    return _a_dto(entidad) if entidad else None
