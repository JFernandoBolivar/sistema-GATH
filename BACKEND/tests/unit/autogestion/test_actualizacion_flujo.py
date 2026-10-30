"""
Reglas de la autogestión por solicitud (PLAN_PRIORIDAD §2.1, B-T): máquina de estados, prórroga,
expiración, aprobación de UNA sola persona, ficha intacta hasta aprobar, lista blanca y Zero-IDOR.
Sin Django ni PostgreSQL: puertos en memoria.
"""
from datetime import timedelta

import pytest

from apps.autogestion.application.dtos.actualizacion_dtos import DecisionCampoDTO, ItemCambioDTO
from apps.autogestion.application.use_cases.decision_bienestar import (
    decidir_cambios,
    obtener_comparativo,
    rechazar_solicitud,
)
from apps.autogestion.application.use_cases.edicion_trabajador import (
    adjuntar_soporte,
    enviar_solicitud,
    guardar_borrador,
)
from apps.autogestion.application.use_cases.solicitud_ciclo import (
    expirar_ventanas,
    habilitar_ventana,
    prorrogar_ventana,
    solicitar_actualizacion,
)
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from tests.unit.autogestion.memoria_actualizacion import AHORA, BIENESTAR, TRABAJADOR, Mundo


def tel(valor, campo='telefono_movil'):
    return ItemCambioDTO('contacto', 'employee', 'MODIFICAR', campo, valor)


def solicitar(m, secciones=('contacto',), cedula=TRABAJADOR):
    return solicitar_actualizacion(m.solicitudes, m.secciones, m.publicador, cedula=cedula, secciones=list(secciones), motivo='Cambié de número de teléfono móvil hace poco')


def habilitar(m, sol, dias=5, secciones=None):
    return habilitar_ventana(m.solicitudes, m.publicador, solicitud_id=sol.id, plazo_dias=dias, secciones=secciones, actor=BIENESTAR, ahora=AHORA)


def borrador(m, sol, items, cedula=TRABAJADOR, ahora=AHORA):
    return guardar_borrador(m.solicitudes, m.cambios, m.ficha, solicitud_id=sol.id, cedula=cedula, items=items, version=None, ahora=ahora)


def soporte(m, sol, seccion='formacion', tipo='TITULO', cedula=TRABAJADOR):
    return adjuntar_soporte(
        m.solicitudes, m.soportes, m.cambios, m.ficha, m.almacen, solicitud_id=sol.id, cedula=cedula, seccion=seccion,
        tipo=tipo, contenido=b'%PDF-1.4 x', mime='application/pdf', extension='.pdf', nombre_original='titulo.pdf', ahora=AHORA,
    )


def enviar(m, sol, cedula=TRABAJADOR):
    return enviar_solicitud(m.solicitudes, m.cambios, m.soportes, m.secciones, m.publicador,
                            solicitud_id=sol.id, cedula=cedula, version=None, ahora=AHORA)


def decidir(m, sol, decisiones, actor=BIENESTAR, version=None, motivo=''):
    actual = m.solicitudes.obtener(sol.id)
    return decidir_cambios(
        m.solicitudes, m.cambios, m.soportes, m.ficha, m.ficha, m.publicador, solicitud_id=sol.id,
        decisiones=decisiones, version=version or actual.version, actor=actor, motivo_general=motivo, ahora=AHORA,
    )


def a_decidir(m, sol, aprobar_campos, motivo='No procede'):
    cambios = m.cambios.listar('ACTUALIZACION', sol.id)
    return [DecisionCampoDTO(c.id, c.campo in aprobar_campos, '' if c.campo in aprobar_campos else motivo) for c in cambios]


def test_flujo_completo_aprobacion_parcial_aplica_solo_lo_aprobado():
    m = Mundo()
    sol = solicitar(m)
    assert sol.estado is EstadoSolicitud.SOLICITADA
    sol = habilitar(m, sol)
    assert sol.estado is EstadoSolicitud.HABILITADA and sol.ventana_fin == AHORA + timedelta(days=5)
    borrador(m, sol, [tel('04245556677'), tel('02129998877', 'telefono_habitacion')])
    sol = enviar(m, sol)
    assert sol.estado is EstadoSolicitud.ENVIADA

    # La ficha NO cambia mientras la solicitud no se decide.
    assert m.ficha.datos[('employee', None)]['telefono_movil'] == '04141111111'
    assert m.ficha.aplicaciones == []

    dto = decidir(m, sol, a_decidir(m, sol, {'telefono_movil'}))
    assert dto.solicitud.estado is EstadoSolicitud.APROBADA_PARCIAL
    assert dto.solicitud.decidida_por == BIENESTAR  # una sola persona
    ficha = m.ficha.datos[('employee', None)]
    assert ficha['telefono_movil'] == '04245556677'      # aprobado: aplicado
    assert ficha['telefono_habitacion'] == '02121111111'  # rechazado: intacto
    assert m.ficha.aplicaciones == [['telefono_movil']]
    rechazado = next(c for c in dto.cambios if c.cambio.campo == 'telefono_habitacion').cambio
    assert rechazado.motivo_decision == 'No procede' and rechazado.decidido_por == BIENESTAR
    assert m.publicador.tipos == ['solicitud_creada', 'ventana_habilitada', 'solicitud_enviada', 'actualizacion_aprobada']
    assert (TRABAJADOR, 'contacto') not in m.solicitudes.reservas  # secciones liberadas


def test_aprobacion_total_y_rechazo_total():
    m = Mundo()
    sol = habilitar(m, solicitar(m))
    borrador(m, sol, [tel('04245556677')])
    sol = enviar(m, sol)
    assert decidir(m, sol, a_decidir(m, sol, {'telefono_movil'})).solicitud.estado is EstadoSolicitud.APROBADA

    m2 = Mundo()
    sol = habilitar(m2, solicitar(m2))
    borrador(m2, sol, [tel('04245556677')])
    sol = enviar(m2, sol)
    with pytest.raises(ValidationError):  # rechazo total exige motivo general
        decidir(m2, sol, a_decidir(m2, sol, set()))
    dto = decidir(m2, sol, a_decidir(m2, sol, set()), motivo='Datos no verificables')
    assert dto.solicitud.estado is EstadoSolicitud.RECHAZADA
    assert m2.ficha.aplicaciones == []
    assert m2.publicador.tipos[-1] == 'solicitud_rechazada'


def test_una_sola_persona_decide_y_nadie_decide_la_propia_solicitud():
    m = Mundo()
    sol = habilitar(m, solicitar(m))
    borrador(m, sol, [tel('04245556677')])
    sol = enviar(m, sol)
    with pytest.raises(ConflictError):
        decidir(m, sol, a_decidir(m, sol, {'telefono_movil'}), actor=TRABAJADOR)
    assert m.ficha.aplicaciones == []
    # Una vez decidida, una segunda decisión (otra persona) ya no cabe: no hay doble aprobación.
    decidir(m, sol, a_decidir(m, sol, {'telefono_movil'}))
    with pytest.raises(ConflictError):
        decidir(m, sol, [], actor='20333333')


def test_decisiones_deben_cubrir_todos_los_pendientes_y_el_motivo_del_rechazo_es_obligatorio():
    m = Mundo()
    sol = habilitar(m, solicitar(m))
    borrador(m, sol, [tel('04245556677'), tel('02129998877', 'telefono_habitacion')])
    sol = enviar(m, sol)
    decisiones = a_decidir(m, sol, {'telefono_movil'})
    with pytest.raises(ValidationError):
        decidir(m, sol, decisiones[:1])
    sin_motivo = [DecisionCampoDTO(d.cambio_id, d.aprobado, '') for d in decisiones]
    with pytest.raises(ValidationError):
        decidir(m, sol, sin_motivo)
    assert m.solicitudes.obtener(sol.id).estado is EstadoSolicitud.ENVIADA


def test_bloqueo_optimista_en_la_decision():
    m = Mundo()
    sol = habilitar(m, solicitar(m))
    borrador(m, sol, [tel('04245556677')])
    sol = enviar(m, sol)
    with pytest.raises(ConflictError):
        decidir(m, sol, a_decidir(m, sol, {'telefono_movil'}), version=1)


def test_conflicto_si_la_ficha_cambio_antes_de_aprobar():
    m = Mundo()
    sol = habilitar(m, solicitar(m))
    borrador(m, sol, [tel('04245556677')])
    sol = enviar(m, sol)
    m.ficha.datos[('employee', None)]['telefono_movil'] = '04169990000'  # RRHH lo cambió mientras tanto
    comparativo = obtener_comparativo(m.solicitudes, m.cambios, m.soportes, m.ficha, solicitud_id=sol.id)
    assert comparativo.cambios[0].conflicto and comparativo.cambios[0].valor_actual == '04169990000'
    with pytest.raises(ConflictError):
        decidir(m, sol, a_decidir(m, sol, {'telefono_movil'}))
    # Rechazarlo sí es posible.
    assert decidir(m, sol, a_decidir(m, sol, set()), motivo='Cambió la ficha').solicitud.estado is EstadoSolicitud.RECHAZADA


def test_una_solicitud_abierta_por_trabajador_y_seccion():
    m = Mundo()
    primera = solicitar(m, ('contacto', 'vivienda'))
    with pytest.raises(ConflictError):
        solicitar(m, ('vivienda',))
    solicitar(m, ('familiar',))  # otra sección: sí
    otro = solicitar(m, ('contacto',), cedula='20999999')  # otro trabajador: sí
    assert otro.cedula == '20999999'
    rechazar_solicitud(m.solicitudes, m.cambios, m.publicador, solicitud_id=primera.id, motivo='No procede', version=None, actor=BIENESTAR, ahora=AHORA)
    solicitar(m, ('vivienda',))  # liberada al cerrarse


def test_secciones_desconocidas_o_vacias_se_rechazan():
    m = Mundo()
    with pytest.raises(ValidationError):
        solicitar(m, ('identidad',))
    with pytest.raises(ValidationError):
        solicitar(m, ())


def test_habilitar_con_subconjunto_libera_las_demas_y_valida_el_plazo():
    m = Mundo()
    sol = solicitar(m, ('contacto', 'vivienda'))
    with pytest.raises(ValidationError):
        habilitar(m, sol, dias=0)
    with pytest.raises(ValidationError):
        habilitar(m, sol, dias=500)
    with pytest.raises(ValidationError):
        habilitar(m, sol, secciones=['foto'])
    sol = habilitar(m, sol, secciones=['contacto'])
    assert sol.secciones_habilitadas == ('contacto',)
    assert (TRABAJADOR, 'vivienda') not in m.solicitudes.reservas


def test_prorroga_extiende_la_ventana_y_deja_registro():
    m = Mundo()
    sol = habilitar(m, solicitar(m), dias=2)
    nueva = AHORA + timedelta(days=9)
    sol = prorrogar_ventana(m.solicitudes, m.publicador, solicitud_id=sol.id, nueva_fin=nueva, motivo='Viaje', actor=BIENESTAR, ahora=AHORA)
    assert sol.ventana_fin == nueva and sol.estado is EstadoSolicitud.HABILITADA
    assert m.solicitudes.prorrogas[0].fecha_fin_anterior == AHORA + timedelta(days=2)
    with pytest.raises(ValidationError):  # no puede acortar
        prorrogar_ventana(m.solicitudes, m.publicador, solicitud_id=sol.id, nueva_fin=AHORA + timedelta(days=3), motivo='x', actor=BIENESTAR, ahora=AHORA)
    with pytest.raises(ValidationError):  # motivo obligatorio
        prorrogar_ventana(m.solicitudes, m.publicador, solicitud_id=sol.id, nueva_fin=AHORA + timedelta(days=20), motivo=' ', actor=BIENESTAR, ahora=AHORA)
    sol = prorrogar_ventana(m.solicitudes, m.publicador, solicitud_id=sol.id, nueva_fin=AHORA + timedelta(days=12), motivo='Otra vez', actor=BIENESTAR, ahora=AHORA)
    assert len(m.solicitudes.prorrogas) == 2  # repetible


def test_expiracion_marca_vencidas_es_idempotente_y_bloquea_al_trabajador():
    m = Mundo()
    sol = habilitar(m, solicitar(m), dias=1)
    tarde = AHORA + timedelta(days=2)
    with pytest.raises(ConflictError):  # aun sin tarea, el servidor no admite cambios fuera de plazo
        borrador(m, sol, [tel('04245556677')], ahora=tarde)
    assert expirar_ventanas(m.solicitudes, m.publicador, AHORA) == 0
    assert expirar_ventanas(m.solicitudes, m.publicador, tarde) == 1
    assert expirar_ventanas(m.solicitudes, m.publicador, tarde) == 0  # idempotente
    assert m.solicitudes.obtener(sol.id).estado is EstadoSolicitud.EXPIRADA
    assert m.publicador.tipos[-1] == 'ventana_expirada'
    solicitar(m)  # EXPIRADA -> el trabajador puede solicitar de nuevo
    with pytest.raises(ConflictError):
        prorrogar_ventana(m.solicitudes, m.publicador, solicitud_id=sol.id, nueva_fin=tarde + timedelta(days=3), motivo='x', actor=BIENESTAR, ahora=tarde)


def test_transiciones_invalidas():
    m = Mundo()
    sol = solicitar(m)
    with pytest.raises(ConflictError):  # SOLICITADA no se envía sin ventana
        enviar(m, sol)
    with pytest.raises(ConflictError):  # ni se decide
        decidir(m, sol, [])
    sol = habilitar(m, sol)
    with pytest.raises(ConflictError):  # no se habilita dos veces
        habilitar(m, sol)
    with pytest.raises(ValidationError):  # enviar sin cambios
        enviar(m, sol)


def test_lista_blanca_rechaza_identidad_correo_cargo_y_estatus():
    m = Mundo()
    sol = habilitar(m, solicitar(m))
    for campo in ('cedula', 'correo', 'cargo', 'estatus', 'nombres', 'fecha_nacimiento'):
        with pytest.raises(ValidationError):
            borrador(m, sol, [ItemCambioDTO('contacto', 'employee', 'MODIFICAR', campo, 'X')])
    with pytest.raises(ValidationError):  # sección no habilitada
        borrador(m, sol, [ItemCambioDTO('vivienda', 'datos_vivienda', 'MODIFICAR', 'direccion_exacta', 'Calle 1')])
    with pytest.raises(ValidationError):  # teléfono inválido
        borrador(m, sol, [tel('abc')])
    with pytest.raises(ValidationError):  # la foto no va en el borrador
        borrador(m, sol, [ItemCambioDTO('foto', 'employee', 'MODIFICAR', 'profile', 'x')])


def test_borrador_ignora_lo_que_no_cambia_y_se_reemplaza():
    m = Mundo()
    sol = habilitar(m, solicitar(m))
    borrador(m, sol, [tel('04141111111')])  # igual al actual: no es un cambio
    assert m.cambios.listar('ACTUALIZACION', sol.id) == []
    borrador(m, sol, [tel('04245556677')])
    borrador(m, sol, [tel('04245550000', 'telefono_habitacion')])
    assert [c.campo for c in m.cambios.listar('ACTUALIZACION', sol.id)] == ['telefono_habitacion']
    with pytest.raises(ValidationError):  # repetido
        borrador(m, sol, [tel('04245556677'), tel('04245556688')])


def test_correo_alternativo_y_tiene_hijos_van_a_la_tabla_complementaria():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('contacto', 'familiar')))
    borrador(m, sol, [
        ItemCambioDTO('contacto', 'datos_complementarios', 'MODIFICAR', 'correo_alternativo', 'maria@gmail.com'),
        ItemCambioDTO('familiar', 'datos_complementarios', 'MODIFICAR', 'tiene_hijos', True),
    ])
    sol = soporte(m, sol, 'familiar', 'ACTA_NACIMIENTO') and m.solicitudes.obtener(sol.id)
    sol = enviar(m, sol)
    decidir(m, sol, [DecisionCampoDTO(c.id, True) for c in m.cambios.listar('ACTUALIZACION', sol.id)])
    assert m.ficha.datos[('datos_complementarios', None)] == {'correo_alternativo': 'maria@gmail.com', 'tiene_hijos': True}
    with pytest.raises(ValidationError):  # correo mal formado
        sol2 = habilitar(m, solicitar(m, ('contacto',)))
        borrador(m, sol2, [ItemCambioDTO('contacto', 'datos_complementarios', 'MODIFICAR', 'correo_alternativo', 'no-es-correo')])


def test_soporte_obligatorio_en_formacion_y_familiares():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('formacion',)))
    nuevo = ItemCambioDTO('formacion', 'formacion_academica', 'CREAR', '*', {'nivel_academico_id': 4, 'carrera_id': 9})
    borrador(m, sol, [nuevo])
    with pytest.raises(ValidationError, match='soporte obligatorio'):
        enviar(m, sol)
    with pytest.raises(ValidationError):  # tipo no permitido para la sección
        soporte(m, sol, 'formacion', 'ACTA_NACIMIENTO')
    soporte(m, sol, 'formacion', 'TITULO')
    assert enviar(m, sol).estado is EstadoSolicitud.ENVIADA
    assert len(m.almacen.objetos) == 1  # el soporte quedó en el almacén


def test_soporte_de_seccion_no_habilitada_o_ajena_se_rechaza():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('contacto',)))
    with pytest.raises(ValidationError):
        soporte(m, sol, 'formacion', 'TITULO')
    with pytest.raises(NotFoundError):
        soporte(m, sol, 'contacto', 'CONSTANCIA', cedula='20999999')


def test_zero_idor_solicitud_ajena_y_registros_ajenos():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('familiar',)))
    with pytest.raises(NotFoundError):  # otro trabajador no ve ni edita la solicitud
        borrador(m, sol, [tel('04245556677')], cedula='20999999')
    with pytest.raises(NotFoundError):
        enviar(m, sol, cedula='20999999')
    ajeno = ItemCambioDTO('familiar', 'familiar', 'MODIFICAR', 'primer_nombre', 'LUIS', entidad_id='999')
    with pytest.raises(NotFoundError):  # familiar que no es suyo
        borrador(m, sol, [ajeno])
    propio = ItemCambioDTO('familiar', 'familiar', 'MODIFICAR', 'primer_nombre', 'ANITA', entidad_id='7')
    borrador(m, sol, [propio])
    assert m.cambios.listar('ACTUALIZACION', sol.id)[0].valor_anterior == 'ANA'


def test_foto_crea_el_cambio_profile_y_el_aplicador_recibe_el_soporte():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('foto',)))
    foto = adjuntar_soporte(
        m.solicitudes, m.soportes, m.cambios, m.ficha, m.almacen, solicitud_id=sol.id, cedula=TRABAJADOR,
        seccion='foto', tipo='FOTO', contenido=b'\xff\xd8\xff data', mime='image/jpeg', extension='.jpg', nombre_original='yo.jpg', ahora=AHORA,
    )
    cambio = m.cambios.listar('ACTUALIZACION', sol.id)[0]
    assert cambio.campo == 'profile' and cambio.valor_propuesto == {'soporte_id': foto.id}
    assert cambio.valor_anterior == 'perfiles/viejo.jpg'
    sol = enviar(m, sol)
    decidir(m, sol, [DecisionCampoDTO(cambio.id, True)])
    assert 'foto_aprobada' in m.publicador.tipos


def test_rechazar_solicitud_sin_habilitar_o_enviada_con_motivo():
    m = Mundo()
    sol = solicitar(m)
    with pytest.raises(ValidationError):
        rechazar_solicitud(m.solicitudes, m.cambios, m.publicador, solicitud_id=sol.id, motivo='', version=None, actor=BIENESTAR, ahora=AHORA)
    rechazada = rechazar_solicitud(m.solicitudes, m.cambios, m.publicador, solicitud_id=sol.id, motivo='No procede', version=None, actor=BIENESTAR, ahora=AHORA)
    assert rechazada.estado is EstadoSolicitud.RECHAZADA and rechazada.motivo_decision == 'No procede'

    sol = habilitar(m, solicitar(m))
    borrador(m, sol, [tel('04245556677')])
    sol = enviar(m, sol)
    rechazar_solicitud(m.solicitudes, m.cambios, m.publicador, solicitud_id=sol.id, motivo='Falso', version=None, actor=BIENESTAR, ahora=AHORA)
    assert m.ficha.aplicaciones == []
    assert m.cambios.listar('ACTUALIZACION', sol.id)[0].decision.value == 'RECHAZADO'
