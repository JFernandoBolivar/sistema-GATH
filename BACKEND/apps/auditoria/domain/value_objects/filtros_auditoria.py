"""Filtros y paginación del listado de auditoría (D10)."""
from dataclasses import dataclass
from datetime import date

from core.domain.auditoria import RESULTADOS
from core.domain.exceptions import ValidationError

PAGINA_INICIAL = 1
TAMANO_POR_DEFECTO = 10
TAMANO_MAXIMO = 50

ETIQUETAS = {
    'usuario': 'Usuario',
    'accion': 'Acción',
    'modulo': 'Módulo',
    'recurso': 'Recurso',
    'ip': 'IP',
    'desde': 'Desde',
    'hasta': 'Hasta',
    'resultado': 'Resultado',
}


@dataclass(frozen=True)
class FiltrosAuditoria:
    usuario: str = ''
    accion: str = ''
    modulo: str = ''
    recurso: str = ''
    ip: str = ''
    desde: date | None = None
    hasta: date | None = None
    resultado: str = ''

    @classmethod
    def desde_parametros(cls, parametros) -> 'FiltrosAuditoria':
        datos = parametros or {}
        resultado = _texto(datos.get('resultado')).upper()
        if resultado and resultado not in RESULTADOS:
            raise ValidationError(f'Resultado de auditoría no válido: «{resultado}».')
        filtros = cls(
            usuario=_texto(datos.get('usuario')),
            accion=_texto(datos.get('accion')),
            modulo=_texto(datos.get('modulo')),
            recurso=_texto(datos.get('recurso')),
            ip=_texto(datos.get('ip')),
            desde=_fecha('desde', datos.get('desde')),
            hasta=_fecha('hasta', datos.get('hasta')),
            resultado=resultado,
        )
        if filtros.desde and filtros.hasta and filtros.desde > filtros.hasta:
            raise ValidationError('La fecha «Desde» no puede ser posterior a «Hasta».')
        return filtros

    def como_etiquetas(self) -> list[tuple[str, str]]:
        pares = (
            ('usuario', self.usuario),
            ('accion', self.accion),
            ('modulo', self.modulo),
            ('recurso', self.recurso),
            ('ip', self.ip),
            ('resultado', self.resultado),
            ('desde', self.desde.strftime('%d/%m/%Y') if self.desde else ''),
            ('hasta', self.hasta.strftime('%d/%m/%Y') if self.hasta else ''),
        )
        return [(ETIQUETAS[clave], valor) for clave, valor in pares if valor]


@dataclass(frozen=True)
class Paginacion:
    pagina: int = PAGINA_INICIAL
    tamano: int = TAMANO_POR_DEFECTO

    @classmethod
    def desde_parametros(cls, parametros) -> 'Paginacion':
        datos = parametros or {}
        pagina = _entero('pagina', datos.get('pagina'), PAGINA_INICIAL)
        tamano = _entero('page_size', datos.get('page_size'), TAMANO_POR_DEFECTO)
        if pagina < PAGINA_INICIAL:
            raise ValidationError('La página debe ser mayor o igual a 1.')
        if tamano < 1:
            raise ValidationError('El tamaño de página debe ser mayor o igual a 1.')
        return cls(pagina=pagina, tamano=min(tamano, TAMANO_MAXIMO))

    @property
    def offset(self) -> int:
        return (self.pagina - 1) * self.tamano


def _texto(valor) -> str:
    return str(valor).strip() if valor is not None else ''


def _entero(nombre: str, valor, por_defecto: int) -> int:
    texto = _texto(valor)
    if not texto:
        return por_defecto
    if not (texto.isascii() and texto.isdigit()):
        raise ValidationError(f'El parámetro «{nombre}» debe ser un número entero.')
    return int(texto)


def _fecha(clave: str, valor) -> date | None:
    texto = _texto(valor)
    if not texto:
        return None
    try:
        return date.fromisoformat(texto[:10])
    except ValueError as exc:
        raise ValidationError(
            f'El filtro «{ETIQUETAS[clave]}» debe ser una fecha con formato AAAA-MM-DD.'
        ) from exc
