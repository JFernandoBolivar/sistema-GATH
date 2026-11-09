"""
Reglas puras de administración de usuarios (D4): a), b) y c) viven en el
dominio, no en la vista ni en el frontend.
"""
import pytest

from apps.identidad.domain.services.reglas_administracion import (
    PERMISOS_ADMINISTRACION,
    es_administrador,
    es_cuenta_administrativa,
    exigir_al_menos_un_editor_matriz,
    validar_asignacion_rol,
    validar_cambio_estado,
    validar_cambio_rol,
    validar_concesion_administracion,
    validar_matriz_propia,
    validar_operacion_sobre_cuenta_administrativa,
    validar_override_propio,
)
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from core.domain.exceptions import ConflictError, PermissionDeniedError


def test_a_no_puede_desactivar_su_propia_cuenta():
    with pytest.raises(PermissionDeniedError):
        validar_cambio_estado(actor_id=7, objetivo_id=7, is_active=False)


def test_a_si_puede_desactivar_la_cuenta_de_otra_persona():
    validar_cambio_estado(actor_id=7, objetivo_id=8, is_active=False)


def test_a_activar_la_propia_cuenta_no_se_bloquea():
    validar_cambio_estado(actor_id=7, objetivo_id=7, is_active=True)


def test_c_nadie_se_cambia_su_propio_rol():
    with pytest.raises(PermissionDeniedError):
        validar_cambio_rol(actor_id=7, objetivo_id=7, cambia_rol=True)


def test_c_si_puede_cambiar_el_rol_de_otra_persona():
    validar_cambio_rol(actor_id=7, objetivo_id=8, cambia_rol=True)


def test_c_nadie_modifica_sus_propios_overrides():
    with pytest.raises(PermissionDeniedError):
        validar_override_propio(actor_cedula='12345678', objetivo_cedula='12345678')


def test_c_si_puede_modificar_los_overrides_de_otra_persona():
    validar_override_propio(actor_cedula='12345678', objetivo_cedula='87654321')


def test_b_rechaza_el_cambio_que_deja_cero_editores():
    with pytest.raises(ConflictError):
        exigir_al_menos_un_editor_matriz(antes=1, despues=0)


def test_b_permite_el_cambio_si_queda_al_menos_un_editor():
    exigir_al_menos_un_editor_matriz(antes=2, despues=1)


def test_b_no_bloquea_una_base_que_ya_venia_sin_editores():
    exigir_al_menos_un_editor_matriz(antes=0, despues=0)


def _politica(*codigos: str) -> PoliticaAcceso:
    return PoliticaAcceso(allow=frozenset(codigos))


def test_a1_una_cuenta_con_permisos_de_administracion_exige_actor_administrador():
    objetivo = _politica('identidad.restablecer_acceso')
    actor_analista = _politica('identidad.restablecer_acceso', 'identidad.ver_usuarios')

    assert es_cuenta_administrativa(objetivo) is True
    assert es_administrador(actor_analista) is False
    with pytest.raises(PermissionDeniedError):
        validar_operacion_sobre_cuenta_administrativa(
            politica_actor=actor_analista,
            politica_objetivo=objetivo,
            operacion='restablecer el acceso de',
        )


def test_a1_un_administrador_si_puede_operar_sobre_una_cuenta_administrativa():
    objetivo = _politica('identidad.asignar_permisos')
    actor = _politica(*PERMISOS_ADMINISTRACION)

    validar_operacion_sobre_cuenta_administrativa(
        politica_actor=actor,
        politica_objetivo=objetivo,
        operacion='restablecer el acceso de',
    )


def test_a1_una_cuenta_basica_puede_ser_atendida_por_rrhh():
    validar_operacion_sobre_cuenta_administrativa(
        politica_actor=_politica('identidad.restablecer_acceso'),
        politica_objetivo=_politica('autogestion.ver_propio'),
        operacion='restablecer el acceso de',
    )


def test_m3_no_se_asigna_un_rol_administrativo_sin_tener_sus_permisos():
    with pytest.raises(PermissionDeniedError):
        validar_asignacion_rol(
            politica_actor=_politica('identidad.editar_usuarios'),
            codigos_rol_destino=frozenset(PERMISOS_ADMINISTRACION),
            rol_id=1,
        )


def test_m3_un_administrador_si_puede_asignar_el_rol_administrativo():
    validar_asignacion_rol(
        politica_actor=_politica(*PERMISOS_ADMINISTRACION),
        codigos_rol_destino=frozenset(PERMISOS_ADMINISTRACION),
        rol_id=1,
    )


def test_m3_un_rol_sin_permisos_de_administracion_no_require_ser_administrador():
    validar_asignacion_rol(
        politica_actor=_politica('identidad.editar_usuarios'),
        codigos_rol_destino=frozenset({'autogestion.ver_propio'}),
        rol_id=3,
    )


def test_m4_el_actor_no_modifica_la_matriz_de_su_propio_rol():
    with pytest.raises(PermissionDeniedError):
        validar_matriz_propia(rol_actor_id=1, rol_objetivo_id=1)


def test_m4_puede_modificar_la_matriz_de_otro_rol():
    validar_matriz_propia(rol_actor_id=1, rol_objetivo_id=2)


def test_r2_no_concede_un_permiso_administrativo_que_no_tiene():
    with pytest.raises(PermissionDeniedError):
        validar_concesion_administracion(
            politica_actor=_politica('identidad.asignar_permisos'),
            codigos_agregados=frozenset({'configuracion.editar'}),
        )


def test_r2_un_administrador_completo_si_concede_permisos_administrativos():
    validar_concesion_administracion(
        politica_actor=_politica(*PERMISOS_ADMINISTRACION),
        codigos_agregados=frozenset({'configuracion.editar'}),
    )


def test_r2_conceder_un_permiso_operativo_no_se_bloquea():
    validar_concesion_administracion(
        politica_actor=_politica('identidad.asignar_permisos'),
        codigos_agregados=frozenset({'personal.ver'}),
    )


