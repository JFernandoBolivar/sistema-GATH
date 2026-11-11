"""
Casos de uso de consulta de cargas masivas (S5-01).

`presentation` dejó de tocar el ORM: pregunta por estos casos de uso y la
infraestructura implementa los puertos. Las respuestas HTTP no cambian.
"""
from apps.carga_masiva.domain.ports.carga_masiva import (
    ConsultorCargas,
    CreadorCarga,
    ExportadorResultadosCarga,
)


def crear_carga(creador: CreadorCarga, **datos):
    """Alta de la carga masiva (el ORM queda en infraestructura)."""
    return creador.crear(**datos)


def marcar_carga_con_error(creador: CreadorCarga, carga) -> None:
    """Deja la carga en estado ERROR cuando el análisis del archivo falla."""
    creador.marcar_error(carga)


def obtener_carga_visible(
    consultor: ConsultorCargas, carga_id: str, cedula: str, puede_aprobar: bool,
):
    """Carga que el usuario puede ver (propia si no puede aprobar); 404 si no existe."""
    return consultor.obtener_visible(carga_id, cedula, puede_aprobar)


def listar_cargas(
    consultor: ConsultorCargas,
    *,
    cedula: str,
    puede_aprobar: bool,
    poblaciones: list[str],
    poblacion: str | None = None,
    estado: str | None = None,
) -> list:
    return consultor.listar(
        cedula=cedula,
        puede_aprobar=puede_aprobar,
        poblaciones=poblaciones,
        poblacion=poblacion,
        estado=estado,
    )


def resumen_de_carga(consultor: ConsultorCargas, carga) -> dict:
    return consultor.resumen(carga)


def filas_de_carga(
    consultor: ConsultorCargas,
    carga,
    *,
    estado: str | None = None,
    solo_confirmacion: bool = False,
) -> list[dict]:
    return consultor.filas(carga, estado=estado, solo_confirmacion=solo_confirmacion)


def exportar_resultados(exportador: ExportadorResultadosCarga, carga) -> bytes:
    return exportador.generar_bytes(carga)
