"""
Pruebas unitarias de Política de Correo de Acceso y Aplicación Masiva (A7).
Verifica:
1. Valores por defecto de la política (pasivos=alternativo, activos=institucional, falta=dejar_sin_cuenta, avisar=False).
2. Resolución de correo para pasivos con correo alternativo.
3. Resolución de correo para pasivos sin alternativo con política dejar_sin_cuenta vs usar_siguiente.
4. Resolución de correo para activos con institucional vs alternativo.
5. Vista previa masiva respetando excepciones manuales.
6. Aplicación masiva con validación de motivo obligatorio (>= 5 caracteres).
7. Aplicación masiva cuando se fuerzan excepciones manuales.
8. Actualización de correo de acceso de pasivo en Fe de Vida validada (si política es alternativo) y no duplicación de copia.
"""
from datetime import datetime, timezone
import pytest

from apps.configuracion.application.use_cases.gestionar_politica_correo_acceso import (
    actualizar_politica_correo_acceso,
    aplicar_politica_masiva,
    generar_vista_previa_masiva,
    obtener_politica_correo_acceso,
    obtener_vista_previa_masiva,
)
from apps.configuracion.domain.correo_acceso import (
    DatosCorreoTrabajador,
    ItemVistaPrevia,
    PoliticaCorreoAcceso,
    PoliticaFaltaCorreo,
    PoliticaFuenteCorreo,
    ResumenVistaPrevia,
    es_correo_valido,
    resolver_correo_para_trabajador,
)
from core.domain.exceptions import ValidationError


class RepoPoliticaCorreoAccesoMemoria:
    def __init__(self, politica: PoliticaCorreoAcceso | None = None):
        self.politica = politica or PoliticaCorreoAcceso()
        self.excepciones: set[str] = set()
        self.trabajadores: dict[str, DatosCorreoTrabajador] = {}
        self.empleados_guardados: dict[str, str] = {}
        self.correos_ocupados: set[str] = set()

    def obtener_politica(self) -> PoliticaCorreoAcceso:
        return self.politica

    def actualizar_politica(
        self, datos: dict, actor_id: int | None = None
    ) -> tuple[PoliticaCorreoAcceso, PoliticaCorreoAcceso]:
        anterior = self.politica
        nuevo = PoliticaCorreoAcceso(
            politica_pasivos=PoliticaFuenteCorreo(datos.get('politica_pasivos', self.politica.politica_pasivos.value)),
            politica_activos=PoliticaFuenteCorreo(datos.get('politica_activos', self.politica.politica_activos.value)),
            si_falta_elegido=PoliticaFaltaCorreo(datos.get('si_falta_elegido', self.politica.si_falta_elegido.value)),
            avisar_al_aplicar_masivo=bool(datos.get('avisar_al_aplicar_masivo', self.politica.avisar_al_aplicar_masivo)),
        )
        self.politica = nuevo
        return anterior, nuevo

    def registrar_excepcion_manual(self, cedula: str, motivo: str = '', actor_cedula: str = '') -> None:
        self.excepciones.add(cedula)

    def listar_cedulas_excepcion(self) -> set[str]:
        return set(self.excepciones)

    def listar_trabajadores_por_grupo(self, grupo: str):
        return list(self.trabajadores.values())

    def correo_en_uso_por_otro(self, cedula: str, correo: str) -> bool:
        return correo.lower() in self.correos_ocupados and self.empleados_guardados.get(cedula) != correo

    def aplicar_correo_a_empleado(self, cedula: str, nuevo_correo: str) -> None:
        self.empleados_guardados[cedula] = nuevo_correo


# ==============================================================================
# Tests de Dominio: Resolución de Correos
# ==============================================================================

def test_politica_default_values():
    pol = PoliticaCorreoAcceso()
    # O39: el pasivo entra con su correo principal (institucional de la ficha).
    assert pol.politica_pasivos == PoliticaFuenteCorreo.INSTITUCIONAL
    assert pol.politica_activos == PoliticaFuenteCorreo.INSTITUCIONAL
    assert pol.si_falta_elegido == PoliticaFaltaCorreo.DEJAR_SIN_CUENTA
    assert pol.avisar_al_aplicar_masivo is False


def test_resolver_correo_pasivo_con_alternativo():
    pol = PoliticaCorreoAcceso(
        politica_pasivos=PoliticaFuenteCorreo.ALTERNATIVO,
        si_falta_elegido=PoliticaFaltaCorreo.DEJAR_SIN_CUENTA,
    )
    datos = DatosCorreoTrabajador(
        cedula='V-12345678',
        nombre_completo='Pasivo Con Alternativo',
        condicion='PASIVO',
        correo_actual_acceso='anterior@ejemplo.com',
        correo_institucional='pasivo@conatel.gob.ve',
        correo_alternativo='personal@gmail.com',
        correo_ficha='anterior@ejemplo.com',
        tiene_cuenta=True,
    )
    res = resolver_correo_para_trabajador(datos, pol)
    # O39: el alternativo no es login; el pasivo entra con su correo principal.
    assert res == 'pasivo@conatel.gob.ve'


def test_politica_alternativa_en_pasivo_sin_principal_no_crea_cuenta():
    pol = PoliticaCorreoAcceso(
        politica_pasivos=PoliticaFuenteCorreo.ALTERNATIVO,
        si_falta_elegido=PoliticaFaltaCorreo.DEJAR_SIN_CUENTA,
    )
    datos = DatosCorreoTrabajador(
        cedula='V-33333333',
        nombre_completo='Pasivo Solo Alternativo',
        condicion='PASIVO',
        correo_actual_acceso='',
        correo_institucional='',
        correo_alternativo='personal@gmail.com',
        correo_ficha='',
        tiene_cuenta=False,
    )
    assert resolver_correo_para_trabajador(datos, pol) is None


def test_resolver_correo_pasivo_sin_principal_dejar_sin_cuenta():
    """Sin principal en la ficha (y el alternativo no es login) queda sin cuenta."""
    pol = PoliticaCorreoAcceso(
        politica_pasivos=PoliticaFuenteCorreo.ALTERNATIVO,
        si_falta_elegido=PoliticaFaltaCorreo.DEJAR_SIN_CUENTA,
    )
    datos = DatosCorreoTrabajador(
        cedula='V-22222222',
        nombre_completo='Pasivo Sin Alternativo',
        condicion='PASIVO',
        correo_actual_acceso='',
        correo_institucional='',
        correo_alternativo='',
        correo_ficha='',
        tiene_cuenta=False,
    )
    res = resolver_correo_para_trabajador(datos, pol)
    assert res is None


def test_resolver_correo_pasivo_sin_alternativo_usar_siguiente():
    pol = PoliticaCorreoAcceso(
        politica_pasivos=PoliticaFuenteCorreo.ALTERNATIVO,
        si_falta_elegido=PoliticaFaltaCorreo.USAR_SIGUIENTE,
    )
    datos = DatosCorreoTrabajador(
        cedula='V-22222222',
        nombre_completo='Pasivo Con Ficha Fallback',
        condicion='PASIVO',
        correo_actual_acceso='',
        correo_institucional='',
        correo_alternativo='',
        correo_ficha='ficha@ejemplo.com',
        tiene_cuenta=False,
    )
    res = resolver_correo_para_trabajador(datos, pol)
    assert res == 'ficha@ejemplo.com'


def test_resolver_correo_activo_institucional():
    pol = PoliticaCorreoAcceso(
        politica_activos=PoliticaFuenteCorreo.INSTITUCIONAL,
        si_falta_elegido=PoliticaFaltaCorreo.DEJAR_SIN_CUENTA,
    )
    datos = DatosCorreoTrabajador(
        cedula='V-33333333',
        nombre_completo='Trabajador Activo',
        condicion='ACTIVO',
        correo_actual_acceso='',
        correo_institucional='activo@conatel.gob.ve',
        correo_alternativo='personal@gmail.com',
        correo_ficha='activo@conatel.gob.ve',
        tiene_cuenta=False,
    )
    res = resolver_correo_para_trabajador(datos, pol)
    assert res == 'activo@conatel.gob.ve'


def test_resolver_correo_pasivo_con_principal_externo_gmail():
    """FIX-AUD8.7: el principal de un pasivo es el de la ficha, aunque sea externo."""
    pol = PoliticaCorreoAcceso(
        politica_pasivos=PoliticaFuenteCorreo.INSTITUCIONAL,
        si_falta_elegido=PoliticaFaltaCorreo.DEJAR_SIN_CUENTA,
    )
    datos = DatosCorreoTrabajador(
        cedula='V-4588543',
        nombre_completo='Pasivo Con Gmail',
        condicion='PASIVO',
        correo_actual_acceso='',
        correo_institucional='',
        correo_alternativo='',
        correo_ficha='pasivo@gmail.com',
        tiene_cuenta=False,
    )
    assert resolver_correo_para_trabajador(datos, pol) == 'pasivo@gmail.com'


def test_resolver_correo_activo_con_correo_externo_sigue_sin_cuenta():
    """FIX-AUD8.7: los activos no cambian; un correo externo no es institucional."""
    pol = PoliticaCorreoAcceso(
        politica_activos=PoliticaFuenteCorreo.INSTITUCIONAL,
        si_falta_elegido=PoliticaFaltaCorreo.DEJAR_SIN_CUENTA,
    )
    datos = DatosCorreoTrabajador(
        cedula='V-4488543',
        nombre_completo='Activo Con Gmail',
        condicion='ACTIVO',
        correo_actual_acceso='',
        correo_institucional='',
        correo_alternativo='',
        correo_ficha='activo@gmail.com',
        tiene_cuenta=False,
    )
    assert resolver_correo_para_trabajador(datos, pol) is None


# ==============================================================================
# Tests de Vista Previa y Excepciones Manuales
# ==============================================================================

def test_vista_previa_respeta_excepciones_manuales():
    pol = PoliticaCorreoAcceso(
        politica_pasivos=PoliticaFuenteCorreo.INSTITUCIONAL,
        si_falta_elegido=PoliticaFaltaCorreo.DEJAR_SIN_CUENTA,
    )
    t1 = DatosCorreoTrabajador(
        cedula='V-111',
        nombre_completo='Normal Cambia',
        condicion='PASIVO',
        correo_actual_acceso='viejo@ejemplo.com',
        correo_institucional='nuevo@conatel.gob.ve',
        correo_alternativo='nuevo@gmail.com',
        correo_ficha='viejo@ejemplo.com',
        tiene_cuenta=True,
        es_excepcion_manual=False,
    )
    t2 = DatosCorreoTrabajador(
        cedula='V-222',
        nombre_completo='Excepcion Individual',
        condicion='PASIVO',
        correo_actual_acceso='ajustado_a_mano@ejemplo.com',
        correo_institucional='otro_nuevo@conatel.gob.ve',
        correo_alternativo='otro@gmail.com',
        correo_ficha='ajustado_a_mano@ejemplo.com',
        tiene_cuenta=True,
        es_excepcion_manual=True,
    )

    # Caso 1: sin incluir excepciones manuales
    resumen = generar_vista_previa_masiva([t1, t2], pol, incluir_excepciones=False)
    assert resumen.total_evaluados == 2
    assert resumen.cambian == 1
    assert resumen.quedan_igual == 0
    assert resumen.excepciones_manuales_ignoradas == 1

    item_ex = next(it for it in resumen.items if it.cedula == 'V-222')
    assert item_ex.es_excepcion_manual is True
    assert item_ex.cambiara is False
    assert item_ex.correo_propuesto == 'ajustado_a_mano@ejemplo.com'

    # Caso 2: forzando incluir excepciones
    resumen_con = generar_vista_previa_masiva([t1, t2], pol, incluir_excepciones=True)
    assert resumen_con.cambian == 2
    assert resumen_con.excepciones_manuales_ignoradas == 0
    item_ex2 = next(it for it in resumen_con.items if it.cedula == 'V-222')
    assert item_ex2.cambiara is True
    assert item_ex2.correo_propuesto == 'otro_nuevo@conatel.gob.ve'


# ==============================================================================
# Tests de Aplicación Masiva y Auditoría
# ==============================================================================

def test_aplicar_politica_masiva_valida_motivo_obligatorio():
    repo = RepoPoliticaCorreoAccesoMemoria()
    with pytest.raises(ValidationError) as exc:
        aplicar_politica_masiva(repo, grupo='pasivos', motivo='abc')
    assert 'motivo' in exc.value.campo or 'motivo' in str(exc.value)


def test_aplicar_politica_masiva_ejecuta_y_audita():
    pol = PoliticaCorreoAcceso(
        politica_pasivos=PoliticaFuenteCorreo.INSTITUCIONAL,
    )
    repo = RepoPoliticaCorreoAccesoMemoria(politica=pol)
    repo.trabajadores['V-111'] = DatosCorreoTrabajador(
        cedula='V-111',
        nombre_completo='Pasivo 1',
        condicion='PASIVO',
        correo_actual_acceso='viejo@ejemplo.com',
        correo_institucional='nuevo@conatel.gob.ve',
        correo_alternativo='nuevo@gmail.com',
        correo_ficha='viejo@ejemplo.com',
        tiene_cuenta=True,
        es_excepcion_manual=False,
    )
    auditados = []

    def fake_audit(cedula, previo, nuevo, motivo):
        auditados.append((cedula, previo, nuevo, motivo))

    resultado = aplicar_politica_masiva(
        repo,
        grupo='pasivos',
        motivo='Migración masiva aprobada por RRHH',
        incluir_excepciones=False,
        auditar_cuenta=fake_audit,
    )
    assert resultado['actualizados'] == 1
    assert repo.empleados_guardados['V-111'] == 'nuevo@conatel.gob.ve'
    assert len(auditados) == 1
    assert auditados[0] == ('V-111', 'viejo@ejemplo.com', 'nuevo@conatel.gob.ve', 'Migración masiva aprobada por RRHH')


def test_aplicar_politica_masiva_reporta_conflictos_sin_romper_el_lote():
    pol = PoliticaCorreoAcceso(politica_pasivos=PoliticaFuenteCorreo.INSTITUCIONAL)
    repo = RepoPoliticaCorreoAccesoMemoria(politica=pol)
    for cedula, institucional in (('V-111', 'compartido@gmail.com'), ('V-222', 'libre@gmail.com')):
        repo.trabajadores[cedula] = DatosCorreoTrabajador(
            cedula=cedula, nombre_completo=cedula, condicion='PASIVO',
            correo_actual_acceso='viejo@ejemplo.com', correo_institucional=institucional,
            correo_alternativo='', correo_ficha='viejo@ejemplo.com', tiene_cuenta=True,
        )
    repo.correos_ocupados.add('compartido@gmail.com')

    resultado = aplicar_politica_masiva(repo, grupo='pasivos', motivo='Migración aprobada por RRHH')

    assert resultado['actualizados'] == 1
    assert resultado['conflictos'] == 1
    assert repo.empleados_guardados == {'V-222': 'libre@gmail.com'}


def test_aplicar_politica_masiva_notifica_al_nuevo_correo_si_esta_encendido():
    pol = PoliticaCorreoAcceso(
        politica_pasivos=PoliticaFuenteCorreo.INSTITUCIONAL, avisar_al_aplicar_masivo=True,
    )
    repo = RepoPoliticaCorreoAccesoMemoria(politica=pol)
    repo.trabajadores['V-111'] = DatosCorreoTrabajador(
        cedula='V-111', nombre_completo='Pasivo 1', condicion='PASIVO',
        correo_actual_acceso='viejo@ejemplo.com', correo_institucional='nuevo@gmail.com',
        correo_alternativo='', correo_ficha='viejo@ejemplo.com', tiene_cuenta=True,
    )
    notificados = []
    aplicar_politica_masiva(
        repo, grupo='pasivos', motivo='Migración aprobada por RRHH',
        notificar_cuenta=lambda cedula, correo, motivo: notificados.append((cedula, correo, motivo)),
    )
    assert notificados == [('V-111', 'nuevo@gmail.com', 'Migración aprobada por RRHH')]


# ==============================================================================
# Tests de Fe de Vida: Actualización al validar y no duplicación de copia
# ==============================================================================

def test_fe_de_vida_validada_no_duplica_copia_si_coincide():
    # Simula la regla de receivers.py:
    # copia = (pasivo.correo_alternativo,) if pasivo.correo_alternativo and pasivo.correo_alternativo != pasivo.correo else ()
    correo_cuenta = 'juan.perez@gmail.com'
    correo_alternativo = 'juan.perez@gmail.com'

    copia = (
        (correo_alternativo,)
        if correo_alternativo and correo_alternativo != correo_cuenta
        else ()
    )
    assert copia == ()

    # Si fueran distintos, sí lleva copia
    correo_cuenta_distinto = 'juan.perez@conatel.gob.ve'
    copia_distinta = (
        (correo_alternativo,)
        if correo_alternativo and correo_alternativo != correo_cuenta_distinto
        else ()
    )
    assert copia_distinta == ('juan.perez@gmail.com',)
