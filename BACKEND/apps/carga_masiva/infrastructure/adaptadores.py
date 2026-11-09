"""Adaptadores de infraestructura para los casos de uso de carga masiva."""
from apps.carga_masiva.domain.ports.carga_masiva import AplicadorCarga, AnalizadorCarga
from apps.carga_masiva.infrastructure import analisis, aplicacion


class AnalizadorCargaORM:
    def analizar(self, carga, contenido: bytes, tipos: list[str]):
        return analisis.analizar_archivo(carga, contenido, tipos)


class AplicadorCargaORM:
    def aplicar(self, carga, actor_cedula: str, actor_id: int | None = None):
        return aplicacion.aplicar_carga(carga, actor_cedula, actor_id)

    def aprobar(self, carga, actor_cedula: str, actor_id: int | None = None):
        return aplicacion.aprobar_carga(carga, actor_cedula, actor_id)

    def rechazar(self, carga, actor_cedula: str, motivo: str):
        return aplicacion.rechazar_carga(carga, actor_cedula, motivo)

    def confirmar(self, carga, fila_ids: list[str], actor_cedula: str, actor_id: int | None = None):
        return aplicacion.confirmar_filas(carga, fila_ids, actor_cedula, actor_id)

    def revertir(self, carga, actor_id: int | None = None):
        return aplicacion.revertir_carga(carga, actor_id)


# Comprobación de contrato en tiempo de importación (sin costo en ejecución).
_: tuple[type[AnalizadorCarga], type[AplicadorCarga]] = (
    AnalizadorCargaORM, AplicadorCargaORM,
)
