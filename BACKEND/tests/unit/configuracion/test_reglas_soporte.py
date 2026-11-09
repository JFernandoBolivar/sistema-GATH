"""Pruebas unitarias puras del catálogo configurable de tipos de soporte (O41)."""
import pytest

from apps.configuracion.domain.reglas_catalogos import (
    ReglaChecklistSoporte,
    ReglaTipoSoporte,
    normalizar_codigo_tipo_soporte,
    preparar_nuevo_tipo_soporte,
    validar_checklist_soporte,
    validar_edicion_tipo_soporte,
    validar_eliminacion_tipo_soporte,
)
from core.domain.exceptions import ValidationError
from core.domain.tipos_soporte import ItemChecklistSoporte


def tipo(codigo='CEDULA', reservado=True, protegido=True, tipo_id=1):
    return ReglaTipoSoporte(
        id=tipo_id, codigo=codigo, nombre=codigo.title(), es_reservado=reservado,
        es_protegido=protegido, orden=tipo_id * 10,
    )


def fila(codigo='CEDULA', tipo_id=1, requerido=True, permitido=True):
    return ReglaChecklistSoporte(
        id=tipo_id, seccion='identidad', tipo_soporte_id=tipo_id, codigo=codigo,
        nombre=codigo.title(), etiqueta=codigo.title(), permitido=permitido,
        requerido=requerido, orden=tipo_id * 10,
    )


def test_codigo_de_tipo_soporte_se_normaliza_y_valida():
    assert normalizar_codigo_tipo_soporte(' certificado_medico ') == 'CERTIFICADO_MEDICO'
    with pytest.raises(ValidationError):
        normalizar_codigo_tipo_soporte('')
    with pytest.raises(ValidationError):
        normalizar_codigo_tipo_soporte('CON GUION')
    with pytest.raises(ValidationError):
        normalizar_codigo_tipo_soporte('A')


def test_alta_de_tipo_soporte_normaliza_nombre_y_orden():
    codigo, nombre, orden = preparar_nuevo_tipo_soporte('certificado', '  Certificado   médico ', 70)
    assert (codigo, nombre, orden) == ('CERTIFICADO', 'Certificado médico', 70)


def test_tipo_reservado_no_cambia_de_codigo():
    with pytest.raises(ValidationError):
        validar_edicion_tipo_soporte(tipo(), 'OTRO_CODIGO', None)
    # Cambiar el nombre sí está permitido.
    validar_edicion_tipo_soporte(tipo(), 'CEDULA', 'Cédula de identidad')


def test_tipo_reservado_o_en_uso_no_se_elimina():
    with pytest.raises(ValidationError):
        validar_eliminacion_tipo_soporte(tipo(reservado=True, protegido=False), False)
    with pytest.raises(ValidationError):
        validar_eliminacion_tipo_soporte(tipo(reservado=False, protegido=False), True)
    validar_eliminacion_tipo_soporte(tipo(reservado=False, protegido=False), False)


def test_checklist_no_permite_quitar_ni_desmarcar_un_tipo_exigido():
    actual = [fila()]
    tipos = {1: tipo(), 2: tipo(codigo='OTRO', tipo_id=2)}
    with pytest.raises(ValidationError):
        validar_checklist_soporte(actual, [], tipos)
    with pytest.raises(ValidationError):
        validar_checklist_soporte(
            actual, [ItemChecklistSoporte(1, permitido=False, requerido=True)], tipos,
        )
    with pytest.raises(ValidationError):
        validar_checklist_soporte(
            actual, [ItemChecklistSoporte(1, permitido=True, requerido=False)], tipos,
        )


def test_checklist_permite_agregar_tipos_nuevos():
    actual = [fila()]
    tipos = {1: tipo(), 2: tipo(codigo='OTRO', tipo_id=2)}
    validar_checklist_soporte(
        actual,
        [
            ItemChecklistSoporte(1, permitido=True, requerido=True),
            ItemChecklistSoporte(2, permitido=True, requerido=False),
        ],
        tipos,
    )


def test_checklist_rechaza_tipo_inexistente_y_exigido_no_permitido():
    tipos = {1: tipo()}
    with pytest.raises(ValidationError):
        validar_checklist_soporte([], [ItemChecklistSoporte(99, True, False)], tipos)
    with pytest.raises(ValidationError):
        validar_checklist_soporte([], [ItemChecklistSoporte(1, False, True)], tipos)
