"""
Filtros del historial de movimientos (HU 0008), validados en el dominio.

`RN-008-01` (la fecha de inicio no puede ser posterior a la de fin) se aplica
aquí, no solo en el formulario: cualquier entrada —pantalla, PDF, Excel o una
petición directa a la API— pasa por este value object. También expone las
etiquetas legibles que imprime el PDF (nunca IDs).
"""
from dataclasses import dataclass
from datetime import date

from core.domain.exceptions import ValidationError

MENSAJE_RANGO_INVALIDO = 'La fecha de inicio no puede ser posterior a la fecha de fin.'

ETIQUETAS = {
    'cedula': 'Cédula del trabajador',
    'codigo_puesto': 'Código de puesto',
    'categoria': 'Categoría de movimiento',
    'tipo_movimiento': 'Tipo o motivo específico',
    'gerencia': 'Gerencia / Dirección',
    'estatus': 'Estatus del cargo',
    'fecha_inicio': 'Desde',
    'fecha_fin': 'Hasta',
}


@dataclass(frozen=True)
class FiltrosHistorial:
    cedula: str = ''
    codigo_puesto: str = ''
    categoria: str = ''
    tipo_movimiento: str = ''
    gerencia: str = ''
    estatus: str = ''
    fecha_inicio: date | None = None
    fecha_fin: date | None = None

    @classmethod
    def desde_parametros(cls, parametros) -> 'FiltrosHistorial':
        """Normaliza y valida los parámetros de la petición (cadenas)."""
        datos = parametros or {}
        filtros = cls(
            cedula=_texto(datos.get('cedula')),
            codigo_puesto=_texto(datos.get('codigo_puesto')),
            categoria=_texto(datos.get('categoria')),
            tipo_movimiento=_texto(datos.get('tipo_movimiento')),
            gerencia=_texto(datos.get('gerencia')),
            estatus=_texto(datos.get('estatus')),
            fecha_inicio=_fecha('fecha_inicio', datos.get('fecha_inicio')),
            fecha_fin=_fecha('fecha_fin', datos.get('fecha_fin')),
        )
        if (
            filtros.fecha_inicio is not None
            and filtros.fecha_fin is not None
            and filtros.fecha_inicio > filtros.fecha_fin
        ):
            raise ValidationError(MENSAJE_RANGO_INVALIDO)
        return filtros

    def como_etiquetas(self) -> list[tuple[str, str]]:
        """Pares (etiqueta, valor) con lo que realmente se aplicó al reporte."""
        pares = (
            ('cedula', self.cedula),
            ('codigo_puesto', self.codigo_puesto),
            ('categoria', self.categoria),
            ('tipo_movimiento', self.tipo_movimiento),
            ('gerencia', self.gerencia),
            ('estatus', self.estatus),
            ('fecha_inicio', self.fecha_inicio.strftime('%d/%m/%Y') if self.fecha_inicio else ''),
            ('fecha_fin', self.fecha_fin.strftime('%d/%m/%Y') if self.fecha_fin else ''),
        )
        return [(ETIQUETAS[clave], valor) for clave, valor in pares if valor]


def _texto(valor) -> str:
    return str(valor).strip() if valor is not None else ''


def _fecha(clave: str, valor) -> date | None:
    texto = _texto(valor)
    if not texto:
        return None
    try:
        return date.fromisoformat(texto[:10])
    except ValueError:
        raise ValidationError(
            f'El filtro «{ETIQUETAS[clave]}» debe ser una fecha con formato AAAA-MM-DD.'
        )
