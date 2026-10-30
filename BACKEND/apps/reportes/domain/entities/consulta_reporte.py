"""
Entidad de Dominio `ConsultaReportePersonal` (B5).

Es la consulta de un reporte de personal ya **validada y traducida** a las
rutas del registro de campos (`ReportFieldRegistry`, R-06): el dominio no
conoce el ORM, así que `lookups` guarda claves del registro aprobado
(`sexoid_id`, `fecha_nacimiento__lte`, ...) que el repositorio aplica tal cual
sobre el modelo `Employee` (`campos_permitidos`/`filtros_permitidos`).
"""
from dataclasses import dataclass, field

from core.domain.exceptions import ValidationError

TIPOS_REPORTE = ('lista', 'conteo')


@dataclass(frozen=True)
class ConsultaReportePersonal:
    """Consulta lista para ejecutar por el repositorio."""

    lookups: dict = field(default_factory=dict)
    tipo_reporte: str = 'lista'
    agrupar_por: str | None = None
    agrupar_por_ruta: str | None = None

    def __post_init__(self):
        if self.tipo_reporte not in TIPOS_REPORTE:
            raise ValidationError(
                f'Tipo de reporte no válido: {self.tipo_reporte}. '
                f'Opciones: {", ".join(TIPOS_REPORTE)}.'
            )
        if self.tipo_reporte == 'conteo' and not self.agrupar_por_ruta:
            raise ValidationError('Un reporte de conteo necesita un campo de agrupación.')
