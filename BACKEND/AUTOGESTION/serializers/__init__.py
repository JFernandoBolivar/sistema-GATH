from .serializers_encuestas import (
    TipoPreguntaSerializer,
    OpcionesPreguntaSerializer,
    PreguntasEncuestasSerializer,
    RespuestaEncuestaSerializer,
    CensoViviendaSubmitSerializer,
)
from .serializers_reporte_censo import (
    ReporteCensoDependenciasSerializer,
    ReporteCensoResponseSerializer,
)

__all__ = [
    "TipoPreguntaSerializer",
    "OpcionesPreguntaSerializer",
    "PreguntasEncuestasSerializer",
    "RespuestaEncuestaSerializer",
    "CensoViviendaSubmitSerializer",
    "ReporteCensoDependenciasSerializer",
    "ReporteCensoResponseSerializer",
]
