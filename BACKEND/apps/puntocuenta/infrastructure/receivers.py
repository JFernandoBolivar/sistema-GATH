"""Receivers de Punto de Cuenta (patrón evento→señal→receiver, Regla B16).

La decisión de emisión respeta el interruptor general y los procesos habilitados.
La creación del registro, su correlativo y el documento publicado se hacen en una
sola transacción; cualquier error se propaga para no dejar una emisión incompleta.
"""
from django.dispatch import receiver

from apps.cargos.domain.events import cargo_dependencia_cambiada, cargo_movimiento_ejecutado
from core.domain.configuracion import CLAVE_GENERAR_PUNTOS_CUENTA
from core.infrastructure.providers import obtener_lector_configuracion
from apps.puntocuenta.application.use_cases.configurar_punto_cuenta import obtener_configuracion_activa
from apps.puntocuenta.domain.services.decision_punto_cuenta import evaluar_generacion_punto_cuenta
from apps.puntocuenta.infrastructure.emision_punto_cuenta import ServicioEmisionPuntoCuenta
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import RepoConfiguracionPuntoCuentaORM


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
    ServicioEmisionPuntoCuenta().emitir(
        proceso=proceso,
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_origen_id,
        dependencia_destino_id=dependencia_destino_id,
        oficina_origen_id=oficina_origen_id,
        oficina_destino_id=oficina_destino_id,
        division_origen_id=division_origen_id,
        division_destino_id=division_destino_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
        configuracion=configuracion,
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
    debe_generar = evaluar_generacion_punto_cuenta(
        generacion_activa=generacion_activa,
        cedula=cedula,
        procesos=configuracion.get('procesos_habilitados'),
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
    debe_generar = evaluar_generacion_punto_cuenta(
        generacion_activa=generacion_activa,
        cedula=cedula,
        procesos=configuracion.get('procesos_habilitados'),
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
