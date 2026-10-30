"""
B16 (decisión G): solicitud campo por campo, motivo único validado y estado DEVUELTA con reenvío.
Sin Django ni BD: puertos en memoria.
"""
from datetime import timedelta

import pytest

from apps.autogestion.application.use_cases.decision_bienestar import devolver_solicitud
from apps.autogestion.application.use_cases.solicitud_ciclo import (
    expirar_ventanas,
    prorrogar_ventana,
    solicitar_actualizacion,
)
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from core.domain.exceptions import ConflictError, ValidationError
from tests.unit.autogestion.memoria_actualizacion import AHORA, BIENESTAR, TRABAJADOR, Mundo
from tests.unit.autogestion.test_actualizacion_flujo import borrador, enviar, habilitar, tel

MOTIVO = 'Cambié de número de teléfono móvil hace poco'


def pedir(m, campos, motivo=MOTIVO):
    return solicitar_actualizacion(m.solicitudes, m.secciones, m.publicador, cedula=TRABAJADOR, campos=campos, motivo=motivo)


def devolver(m, sol, motivo='Falta aclarar el número', actor=BIENESTAR, ahora=AHORA):
    return devolver_solicitud(m.solicitudes, m.publicador, solicitud_id=sol.id, motivo=motivo, version=None, actor=actor, ahora=ahora)


def test_la_solicitud_guarda_solo_los_campos_pedidos_y_deriva_las_secciones():
    m = Mundo()
    sol = pedir(m, ['employee.telefono_movil', 'datos_vivienda.direccion_exacta'])
    assert sol.campos_solicitados == ('employee.telefono_movil', 'datos_vivienda.direccion_exacta')
    assert sol.secciones_solicitadas == ('contacto', 'vivienda')


@pytest.mark.parametrize('campo', ['employee.correo', 'employee.cedula', 'employee.inventado', 'solo_campo'])
def test_el_correo_institucional_y_los_campos_ajenos_no_son_solicitables(campo):
    m = Mundo()
    with pytest.raises(ValidationError):
        pedir(m, [campo])


def test_el_correo_alternativo_si_es_solicitable():
    m = Mundo()
    assert pedir(m, ['datos_complementarios.correo_alternativo']).secciones_solicitadas == ('contacto',)


@pytest.mark.parametrize('motivo', ['', 'cuatro palabras bien largas', 'a b c d e', 'uno dos tres cuatro'])
def test_motivo_minimo_cinco_palabras_y_veinte_caracteres(motivo):
    m = Mundo()
    with pytest.raises(ValidationError):
        pedir(m, ['employee.telefono_movil'], motivo)


def test_solo_se_edita_lo_solicitado_y_habilitado():
    m = Mundo()
    sol = habilitar(m, pedir(m, ['employee.telefono_movil']))
    assert sol.campos_habilitados == ('employee.telefono_movil',)
    borrador(m, sol, [tel('04245556677')])
    with pytest.raises(ValidationError):  # misma sección, campo no solicitado
        borrador(m, sol, [tel('02129998877', 'telefono_habitacion')])


def test_habilitar_un_subconjunto_de_secciones_recorta_los_campos():
    m = Mundo()
    sol = pedir(m, ['employee.telefono_movil', 'datos_vivienda.direccion_exacta'])
    sol = habilitar(m, sol, secciones=['contacto'])
    assert sol.campos_habilitados == ('employee.telefono_movil',)


def preparar_enviada(m):
    sol = habilitar(m, pedir(m, ['employee.telefono_movil']), dias=5)
    borrador(m, sol, [tel('04245556677')])
    return enviar(m, sol)


def test_devolver_exige_motivo_y_pasa_a_devuelta_con_aviso_al_trabajador():
    m = Mundo()
    sol = preparar_enviada(m)
    with pytest.raises(ValidationError):
        devolver(m, sol, motivo=' ')
    devuelta = devolver(m, sol)
    assert devuelta.estado is EstadoSolicitud.DEVUELTA and devuelta.motivo_devolucion == 'Falta aclarar el número'
    assert devuelta.devuelta_por == BIENESTAR and devuelta.abierta
    assert m.publicador.tipos[-1] == 'solicitud_devuelta'


def test_nadie_devuelve_su_propia_solicitud_ni_una_que_no_esta_enviada():
    m = Mundo()
    sol = habilitar(m, pedir(m, ['employee.telefono_movil']))
    with pytest.raises(ConflictError):
        devolver(m, sol)  # HABILITADA
    sol = enviar(m, borrador(m, sol, [tel('04245556677')]) and sol)
    with pytest.raises(ConflictError):
        devolver(m, sol, actor=TRABAJADOR)


def test_el_trabajador_corrige_y_reenvia_dentro_del_plazo():
    m = Mundo()
    devuelta = devolver(m, preparar_enviada(m))
    borrador(m, devuelta, [tel('04165554433')])  # edita estando DEVUELTA
    reenviada = enviar(m, devuelta)
    assert reenviada.estado is EstadoSolicitud.ENVIADA and reenviada.motivo_devolucion  # historial conservado
    assert m.publicador.tipos[-1] == 'correccion_reenviada'
    assert m.publicador.tipos.count('solicitud_enviada') == 1


def test_devuelta_vencida_no_se_reenvia_se_prorroga_o_expira():
    m = Mundo()
    devuelta = devolver(m, preparar_enviada(m))
    tarde = AHORA + timedelta(days=6)
    with pytest.raises(ConflictError):
        borrador(m, devuelta, [tel('04165554433')], ahora=tarde)
    nueva = prorrogar_ventana(m.solicitudes, m.publicador, solicitud_id=devuelta.id, nueva_fin=tarde + timedelta(days=3),
                              motivo='Más tiempo', actor=BIENESTAR, ahora=tarde)
    assert nueva.estado is EstadoSolicitud.DEVUELTA and nueva.ventana_fin > tarde
    assert expirar_ventanas(m.solicitudes, m.publicador, tarde + timedelta(days=1)) == 0
    assert expirar_ventanas(m.solicitudes, m.publicador, tarde + timedelta(days=4)) == 1
    assert m.solicitudes.obtener(devuelta.id).estado is EstadoSolicitud.EXPIRADA
    assert m.publicador.tipos[-1] == 'ventana_expirada'
