"""
Receivers de Punto de Cuenta (patrón evento→signal→receiver, Regla B16).

Se suscribe a 2 eventos de `apps.cargos` sin que `apps.cargos` conozca ni
importe `apps.puntocuenta` — el desacople lo da el `django.dispatch.Signal`.
Conectado en `PuntocuentaConfig.ready()`.

- `cargo_dependencia_cambiada`: disparado por `actualizar_cargo()`.
- `cargo_movimiento_ejecutado`: disparado por movimientos de cargo (TRASLADO,
  CAMBIO DE ESTATUS, EGRESO, etc.).

Ambos respetan el interruptor general `puntocuenta.generar` (apagado por defecto)
y las reglas configurables de `ConfiguracionPuntoCuentaModel` evaluadas mediante el
servicio de dominio `evaluar_generacion_punto_cuenta`.

Al crearse el registro, se le asigna un número correlativo atómico por año y se
guarda en el contexto (`guardar_ultimo_punto_cuenta`) para que la respuesta HTTP
del movimiento pueda informar el id y número del punto de cuenta generado.
"""
from datetime import datetime
import logging

from django.dispatch import receiver

from apps.cargos.domain.events import cargo_dependencia_cambiada, cargo_movimiento_ejecutado
from core.domain.configuracion import CLAVE_GENERAR_PUNTOS_CUENTA
from core.infrastructure.providers import obtener_lector_configuracion
from apps.puntocuenta.application.use_cases.configurar_punto_cuenta import obtener_configuracion_activa
from apps.puntocuenta.application.use_cases.generar_punto_cuenta import (
    adjuntar_documento_punto_cuenta,
    generar_punto_cuenta,
)
from apps.puntocuenta.application.use_cases.correlativo_punto_cuenta import obtener_siguiente_correlativo
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import (
    RepoConfiguracionPuntoCuentaORM,
    RepoSecuenciaPuntoCuentaORM,
)
from apps.puntocuenta.domain.services.decision_punto_cuenta import evaluar_generacion_punto_cuenta
from apps.puntocuenta.infrastructure.contexto import guardar_ultimo_punto_cuenta
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_orm import RepoPuntoCuentaORM

logger = logging.getLogger('gath.puntocuenta')


def _generacion_activa() -> bool:
    lector = obtener_lector_configuracion()
    return bool(lector.obtener_booleano(CLAVE_GENERAR_PUNTOS_CUENTA)) if lector is not None else False


def _generar_punto_cuenta_y_documento(
    *,
    cargo_id,
    cedula,
    dependencia_origen_id,
    dependencia_destino_id,
    oficina_origen_id,
    oficina_destino_id,
    motivo_id,
    usuario_id,
    division_origen_id=None,
    division_destino_id=None,
    configuracion=None,
    proceso=None,
):
    if configuracion is None:
        configuracion = obtener_configuracion_activa(RepoConfiguracionPuntoCuentaORM())

    anio_actual = datetime.now().year
    try:
        secuencia, numero = obtener_siguiente_correlativo(RepoSecuenciaPuntoCuentaORM(), anio_actual)
    except Exception:  # noqa: BLE001 - sin secuencia se genera sin número
        logger.warning('No se pudo reservar el correlativo del punto de cuenta.', exc_info=True)
        secuencia, numero = None, None

    repo = RepoPuntoCuentaORM()
    dto = generar_punto_cuenta(
        repo,
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_origen_id,
        dependencia_destino_id=dependencia_destino_id,
        oficina_origen_id=oficina_origen_id,
        oficina_destino_id=oficina_destino_id,
        division_origen_id=division_origen_id,
        division_destino_id=division_destino_id,
        numero=numero,
        anio=anio_actual,
        secuencia=secuencia,
        configuracion_version=configuracion.get('version'),
        snapshot_formato=configuracion,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )

    # Publicar en el contexto para que la vista HTTP pueda responder con el id/número
    guardar_ultimo_punto_cuenta(dto)

    try:
        from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
        from apps.puntocuenta.infrastructure.pdf_punto_cuenta import construir_pdf_punto_cuenta

        pdf_bytes = construir_pdf_punto_cuenta(dto, configuracion=configuracion, proceso=proceso)
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
    oficina_anterior_id = kwargs.get('oficina_anterior_id')
    oficina_nueva_id = kwargs.get('oficina_nueva_id')
    division_anterior_id = kwargs.get('division_anterior_id')
    division_nueva_id = kwargs.get('division_nueva_id')

    generacion_activa = _generacion_activa()
    if not generacion_activa:
        return

    configuracion = obtener_configuracion_activa(RepoConfiguracionPuntoCuentaORM())
    procesos = configuracion.get('procesos_habilitados')

    debe_generar = evaluar_generacion_punto_cuenta(
        generacion_activa=generacion_activa,
        cedula=cedula,
        procesos=procesos,
        oficina_origen_id=oficina_anterior_id,
        oficina_destino_id=oficina_nueva_id,
        dependencia_origen_id=dependencia_anterior_id,
        dependencia_destino_id=dependencia_nueva_id,
        division_origen_id=division_anterior_id,
        division_destino_id=division_nueva_id,
    )
    if not debe_generar:
        return

    proc_tipo = 'cambio_oficina' if oficina_anterior_id != oficina_nueva_id else (
        'cambio_nivel' if dependencia_anterior_id != dependencia_nueva_id else 'cambio_division'
    )
    _generar_punto_cuenta_y_documento(
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_anterior_id,
        dependencia_destino_id=dependencia_nueva_id,
        oficina_origen_id=oficina_anterior_id,
        oficina_destino_id=oficina_nueva_id,
        division_origen_id=division_anterior_id,
        division_destino_id=division_nueva_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
        configuracion=configuracion,
        proceso=proc_tipo,
    )


@receiver(cargo_movimiento_ejecutado)
def despachar_punto_cuenta_por_traslado(sender, cargo_id, cedula, tipo_movimiento, motivo_id, usuario_id, **kwargs):
    if tipo_movimiento != 'TRASLADO':
        return

    generacion_activa = _generacion_activa()
    if not generacion_activa:
        return

    oficina_anterior_id = kwargs.get('oficina_anterior_id')
    oficina_nueva_id = kwargs.get('oficina_nueva_id')
    dependencia_anterior_id = kwargs.get('dependencia_anterior_id')
    dependencia_nueva_id = kwargs.get('dependencia_nueva_id')
    division_anterior_id = kwargs.get('division_anterior_id')
    division_nueva_id = kwargs.get('division_nueva_id')
    cargo_anterior_id = kwargs.get('cargo_anterior_id')

    configuracion = obtener_configuracion_activa(RepoConfiguracionPuntoCuentaORM())
    procesos = configuracion.get('procesos_habilitados')

    debe_generar = evaluar_generacion_punto_cuenta(
        generacion_activa=generacion_activa,
        cedula=cedula,
        procesos=procesos,
        oficina_origen_id=oficina_anterior_id,
        oficina_destino_id=oficina_nueva_id,
        dependencia_origen_id=dependencia_anterior_id,
        dependencia_destino_id=dependencia_nueva_id,
        division_origen_id=division_anterior_id,
        division_destino_id=division_nueva_id,
        cargo_origen_id=cargo_anterior_id,
        cargo_destino_id=cargo_id,
        tipo_movimiento=tipo_movimiento,
    )
    if not debe_generar:
        return

    proc_tipo = 'cambio_oficina' if oficina_anterior_id != oficina_nueva_id else (
        'cambio_nivel' if dependencia_anterior_id != dependencia_nueva_id else 'cambio_division'
    )
    _generar_punto_cuenta_y_documento(
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_anterior_id,
        dependencia_destino_id=dependencia_nueva_id,
        oficina_origen_id=oficina_anterior_id,
        oficina_destino_id=oficina_nueva_id,
        division_origen_id=division_anterior_id,
        division_destino_id=division_nueva_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
        configuracion=configuracion,
        proceso=proc_tipo,
    )
