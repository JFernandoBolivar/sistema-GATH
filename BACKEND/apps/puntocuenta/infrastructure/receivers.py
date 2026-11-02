"""
Receivers de Punto de Cuenta (patrón evento→signal→receiver, Regla B16).

Se suscribe a 2 eventos de `apps.cargos` sin que `apps.cargos` conozca ni
importe `apps.puntocuenta` — el desacople lo da el `django.dispatch.Signal`.
Conectado en `PuntocuentaConfig.ready()`.

- `cargo_dependencia_cambiada`: disparado por `actualizar_cargo()` SOLO
  cuando el campo Dependencia cambió (RN-006-01) -- siempre genera punto de
  cuenta.
- `cargo_movimiento_ejecutado`: disparado también por otras operaciones de
  cargo (INGRESO, CAMBIO DE ESTATUS); solo nos interesa `tipo_movimiento ==
  'TRASLADO'` Y que `dependencia_anterior_id` != `dependencia_nueva_id`
  (un traslado entre cargos de la MISMA dependencia no genera nada).

Registro del punto de cuenta: ESTRICTO (fallo cerrado) -- si falla, se
propaga y revierte toda la transacción que lo disparó (igual criterio que
el resto del sistema). Generación/subida del PDF: LENIENTE -- un fallo ahí
nunca revierte el registro ya creado; queda `documento_pdf_clave=None` y se
puede regenerar bajo demanda desde el endpoint de descarga.
"""
import logging

from django.dispatch import receiver

from apps.cargos.domain.events import cargo_dependencia_cambiada, cargo_movimiento_ejecutado
from apps.puntocuenta.application.use_cases.generar_punto_cuenta import (
    adjuntar_documento_punto_cuenta,
    generar_punto_cuenta,
)
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_orm import RepoPuntoCuentaORM

logger = logging.getLogger('gath.puntocuenta')


def _generar_punto_cuenta_y_documento(*, cargo_id, cedula, dependencia_origen_id, dependencia_destino_id, motivo_id, usuario_id):
    if not cedula:
        # Sin empleado en el puesto no hay a quién atribuirle el punto de
        # cuenta (mismo criterio que `apps.movimientos`).
        return

    repo = RepoPuntoCuentaORM()
    dto = generar_punto_cuenta(
        repo,
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_origen_id,
        dependencia_destino_id=dependencia_destino_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )

    try:
        from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
        from apps.puntocuenta.infrastructure.pdf_punto_cuenta import construir_pdf_punto_cuenta

        pdf_bytes = construir_pdf_punto_cuenta(dto)
        clave = f"puntocuenta/{dto.id}.pdf"
        SeaweedFSStorage().subir(clave, pdf_bytes, 'application/pdf')
        adjuntar_documento_punto_cuenta(repo, dto.id, clave)
    except Exception:
        logger.exception(
            "No fue posible generar/subir el documento PDF del punto de cuenta %s "
            "(el registro ya quedó creado; se puede regenerar bajo demanda).",
            dto.id,
        )


@receiver(cargo_dependencia_cambiada)
def despachar_punto_cuenta_por_actualizacion(
    sender, cargo_id, cedula, dependencia_anterior_id, dependencia_nueva_id, motivo_id, usuario_id, **kwargs
):
    _generar_punto_cuenta_y_documento(
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_anterior_id,
        dependencia_destino_id=dependencia_nueva_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )


@receiver(cargo_movimiento_ejecutado)
def despachar_punto_cuenta_por_traslado(sender, cargo_id, cedula, tipo_movimiento, motivo_id, usuario_id, **kwargs):
    if tipo_movimiento != 'TRASLADO':
        return
    dependencia_anterior_id = kwargs.get('dependencia_anterior_id')
    dependencia_nueva_id = kwargs.get('dependencia_nueva_id')
    if dependencia_anterior_id is None and dependencia_nueva_id is None:
        return  # Emisor antiguo/sin estos kwargs -- nada que comparar.
    if dependencia_anterior_id == dependencia_nueva_id:
        return  # Traslado dentro de la misma dependencia: no genera nada.

    _generar_punto_cuenta_y_documento(
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_anterior_id,
        dependencia_destino_id=dependencia_nueva_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )
