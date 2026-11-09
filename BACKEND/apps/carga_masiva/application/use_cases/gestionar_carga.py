"""Casos de uso de la carga masiva (la infraestructura implementa los puertos)."""
from apps.carga_masiva.domain.ports.carga_masiva import AplicadorCarga, AnalizadorCarga


def analizar_carga(carga, contenido: bytes, tipos: list[str], analizador: AnalizadorCarga):
    return analizador.analizar(carga, contenido, tipos)


def aplicar_carga(
    carga, actor_cedula: str, aplicador: AplicadorCarga, actor_id: int | None = None,
):
    return aplicador.aplicar(carga, actor_cedula, actor_id)


def aprobar_carga(
    carga, actor_cedula: str, aplicador: AplicadorCarga, actor_id: int | None = None,
):
    return aplicador.aprobar(carga, actor_cedula, actor_id)


def rechazar_carga(
    carga, actor_cedula: str, motivo: str, aplicador: AplicadorCarga,
):
    return aplicador.rechazar(carga, actor_cedula, motivo)


def confirmar_filas(
    carga, fila_ids: list[str], actor_cedula: str, aplicador: AplicadorCarga,
    actor_id: int | None = None,
):
    return aplicador.confirmar(carga, fila_ids, actor_cedula, actor_id)


def revertir_carga(carga, aplicador: AplicadorCarga, actor_id: int | None = None):
    return aplicador.revertir(carga, actor_id)
