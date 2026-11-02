"""
Modelo ORM de `PuntoCuenta` (Punto de Cuenta automático). Tabla propia,
`managed=True`, migración real nueva. Append-only: sin update/delete de
negocio, salvo `adjuntar_documento` (solo escribe `documento_pdf_clave`
cuando el PDF se genera después de crear la fila).

IDs crudos (sin FK real) hacia cargo/empleado/dependencias/motivo: son
referencias a tablas legadas `managed=False` de otros módulos -- una FK
cruzada añadiría una dependencia de esquema entre una tabla nueva propia y
tablas legadas compartidas sin necesidad real (los nombres se resuelven en
el repositorio con joins de lectura, no con integridad referencial de BD).
Se re-exporta en `apps/puntocuenta/models.py` (regla B26).
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class PuntoCuentaModel(BaseModel):
    cargo_id = models.IntegerField(db_index=True)
    empleado_cedula = models.CharField(max_length=10, db_index=True)
    dependencia_origen_id = models.IntegerField(null=True, blank=True)
    dependencia_destino_id = models.IntegerField(null=True, blank=True)
    motivo_id = models.IntegerField(null=True, blank=True)
    usuario_id = models.IntegerField(null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)  # Meta.ordering = -fecha
    documento_pdf_clave = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'puntocuenta_punto_cuenta'
        ordering = ['-fecha']
        verbose_name = 'punto de cuenta'
        verbose_name_plural = 'puntos de cuenta'

    def __str__(self) -> str:
        return f"PuntoCuenta({self.empleado_cedula}, {self.dependencia_origen_id}->{self.dependencia_destino_id})"
