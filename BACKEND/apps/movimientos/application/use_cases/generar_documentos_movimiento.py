"""Genera los documentos de un movimiento ya registrado.

Es puro: recibe puertos y no conoce transacciones, Django ni `documentos`. El
receptor infraestructura lo invoca mediante `transaction.on_commit`; si falla,
el movimiento persistido no se revierte.
"""
from datetime import datetime

from apps.movimientos.domain.entities.movimiento import MovimientoCargo
from apps.movimientos.domain.ports.generador_documentos_movimiento import (
    DocumentoGeneradoMovimiento,
    GeneradorDocumentosMovimiento,
    ProveedorTrabajadorMovimiento,
)

SUJETO_TRABAJADOR = 'trabajador'


def _destino(movimiento: MovimientoCargo) -> str:
    partes = [
        movimiento.codigo_puesto,
        movimiento.denominacion_nombre,
        movimiento.direccion_general_nombre or movimiento.dependencia_nombre,
    ]
    return ' - '.join(str(parte) for parte in partes if parte)


def _nombre_trabajador(datos: dict, cedula: str) -> str:
    completo = ' '.join(
        str(datos.get(clave) or '').strip()
        for clave in ('apellidos', 'nombres')
    ).strip()
    return completo or str(datos.get('nombre_completo') or '').strip() or f'Trabajador {cedula}'


def _fecha_legible(valor) -> str:
    """Normaliza la fecha del historial a DD/MM/AAAA para las plantillas."""
    if not valor:
        return ''
    if hasattr(valor, 'strftime'):
        return valor.strftime('%d/%m/%Y')
    texto = str(valor).strip()
    try:
        return datetime.fromisoformat(texto.replace('Z', '+00:00')).strftime('%d/%m/%Y')
    except ValueError:
        return texto


def construir_datos_movimiento(
    movimiento: MovimientoCargo,
    trabajador: dict,
    *,
    proceso: str,
    evento: dict | None = None,
) -> dict:
    """Combina proveedor real y snapshot histórico; los datos del movimiento mandan.

    Las claves quedan en el snapshot del PDF para consulta y trazabilidad; la
    plantilla se selecciona de forma explícita al invocar el generador.
    """
    destino = _destino(movimiento)
    fecha = _fecha_legible(movimiento.fecha_movimiento)
    origen = str(trabajador.get('origen') or '').strip()
    if not origen:
        if movimiento.tipo_movimiento == 'INGRESO':
            origen = 'Sin cargo anterior'
        elif movimiento.tipo_movimiento == 'CAMBIO DE ESTATUS':
            origen = destino
        else:
            origen = str((evento or {}).get('origen_descripcion') or 'Cargo anterior')

    datos = dict(trabajador)
    datos.update({
        'nombres': str(trabajador.get('nombres') or '').strip(),
        'apellidos': str(trabajador.get('apellidos') or '').strip(),
        'nombre_completo': _nombre_trabajador(trabajador, movimiento.empleado_cedula),
        'cedula': movimiento.empleado_cedula,
        'cedula_numero': str(trabajador.get('cedula_numero') or movimiento.empleado_cedula[1:]),
        'cargo': movimiento.denominacion_nombre,
        'cargo_destino': movimiento.denominacion_nombre,
        'codigo_cargo': movimiento.codigo_puesto,
        'oficina': movimiento.direccion_general_nombre or movimiento.dependencia_nombre or '',
        'division': movimiento.direccion_linea_nombre or '',
        'coordinacion': movimiento.coordinacion_nombre or '',
        'nivel': movimiento.dependencia_nombre or '',
        'nomina': movimiento.tipo_nomina_nombre,
        'tipo_empleado': movimiento.tipo_personal_nombre or '',
        'tipo_personal': movimiento.tipo_personal_nombre or '',
        'origen': origen,
        'destino': destino,
        'motivo': movimiento.motivo_nombre or movimiento.tipo_movimiento,
        'fecha': fecha,
        'fecha_efectiva': fecha,
        'numero': str(movimiento.id),
        'firmantes': [
            {
                'etiqueta': 'Trabajador',
                'detalle': _nombre_trabajador(trabajador, movimiento.empleado_cedula),
            },
            {'etiqueta': 'CONATEL', 'detalle': movimiento.ejecutado_por_nombre},
        ],
        'movimiento_id': movimiento.id,
        'tipo_movimiento': movimiento.tipo_movimiento,
        'proceso': proceso,
    })
    return datos


def generar_documentos_movimiento(
    generador: GeneradorDocumentosMovimiento,
    proveedor: ProveedorTrabajadorMovimiento,
    movimiento: MovimientoCargo,
    *,
    proceso: str,
    evento: dict | None = None,
) -> list[DocumentoGeneradoMovimiento]:
    """Genera un documento por cada plantilla publicada activa del proceso.

    Sin plantillas es un no-op y ni siquiera consulta al trabajador/almacén.
    """
    plantillas = generador.plantillas_activas(proceso)
    if not plantillas:
        return []

    trabajador = proveedor.datos_de(
        movimiento.empleado_cedula, movimiento=movimiento, evento=evento,
    )
    datos = construir_datos_movimiento(
        movimiento, trabajador, proceso=proceso, evento=evento,
    )
    documentos = []
    for plantilla in plantillas:
        documentos.append(generador.generar_plantilla(
            plantilla.id,
            sujeto_tipo=SUJETO_TRABAJADOR,
            sujeto_id=movimiento.empleado_cedula,
            datos=datos,
            actor_id=movimiento.ejecutado_por_id,
            valores_propios=None,
            trabajador_cedula=movimiento.empleado_cedula,
            # No hay pantalla para llenar campos propios: los obligatorios sin
            # dato salen vacíos y nunca bloquean el movimiento automático.
            estricto=False,
        ))

    # Si el servicio devolviera dos veces el mismo ID no se expone duplicado.
    return list({documento.id: documento for documento in documentos}.values())
