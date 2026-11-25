"""N-2: el Punto de Cuenta se genera con la plantilla PUBLICADA y ACTIVA del diseñador.

Cubre la migración de datos (textos de configuración → plantillas), la equivalencia del texto del PDF con el
generador anterior, la emisión de cada proceso, el error cuando falta la plantilla y el aviso de la lista.
"""
from datetime import datetime
from types import SimpleNamespace

import pytest

from apps.documentos.domain.services.catalogo_procesos import CATALOGO_PROCESOS, GRUPO_PUNTO_CUENTA
from apps.documentos.domain.value_objects.esquema_documento import validar_definicion
from apps.documentos.infrastructure import almacen as almacen_mod
from apps.documentos.infrastructure.models.documentos_models import (
    DocumentoGeneradoModel,
    PlantillaDocumentoModel,
    VersionPlantillaDocumentoModel,
)
from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from apps.puntocuenta.application.use_cases.generar_punto_cuenta import datos_para_documento
from apps.puntocuenta.domain.exceptions import PlantillaPuntoCuentaFaltante
from apps.puntocuenta.domain.value_objects.plantilla_punto_cuenta import (
    PROCESO_INGRESO_POSTULACION,
    PROCESOS_POR_DEFECTO,
)
from apps.puntocuenta.infrastructure.emision_punto_cuenta import ServicioEmisionPuntoCuenta
from tests.integration.documentos.conftest import AlmacenMemoria, admin  # noqa: F401 (fixture)
from tests.integration.documentos.test_plantillas_api import BASE as BASE_DOCUMENTOS
from tests.integration.puntocuenta._plantillas import migracion_plantillas, sembrar_plantillas_punto_cuenta
from tests.unit.documentos._ayudas import texto_de
from tests.unit.puntocuenta.test_generar_punto_cuenta import RepoPuntoCuentaMemoria

pytestmark = pytest.mark.django_db
mig = migracion_plantillas()
PROCESOS_PC = [p.codigo for p in CATALOGO_PROCESOS if p.grupo == GRUPO_PUNTO_CUENTA]


@pytest.fixture
def almacen(monkeypatch):
    memoria = AlmacenMemoria()
    monkeypatch.setattr(almacen_mod, 'obtener_almacen', lambda: memoria)
    return memoria


@pytest.fixture
def sembradas():
    sembrar_plantillas_punto_cuenta()


class SecuenciaMemoria:
    def __init__(self):
        self.ultimo = 0

    def siguiente(self, anio):
        self.ultimo += 1
        return self.ultimo


def _plano(texto: str) -> str:
    return ' '.join(texto.split())


def _como_antes(texto: str, **variables) -> str:
    """Sustitución del generador anterior: `{clave}` → valor (N/A si vacío)."""
    for clave, valor in variables.items():
        texto = texto.replace('{' + clave + '}', valor or 'N/A')
    return texto


def _emitir(proceso, repo=None, almacen_=None, **extra):
    servicio = ServicioEmisionPuntoCuenta(
        repo=repo or RepoPuntoCuentaMemoria(), repo_secuencia=SecuenciaMemoria(), almacen=almacen_,
    )
    return servicio.emitir(
        proceso=proceso, cargo_id=10, cedula='V-12345678', dependencia_origen_id=1, dependencia_destino_id=2,
        motivo_id=5, usuario_id=None, oficina_origen_id=7, oficina_destino_id=8,
        ahora=datetime(2026, 11, 24, 9, 0), **extra,
    )


# ───────────────────────── migración de datos ─────────────────────────

def test_hay_una_plantilla_publicada_y_activa_por_proceso_y_su_definicion_es_valida(sembradas):
    assert set(PROCESOS_POR_DEFECTO) == {p.split(':', 1)[1] for p in PROCESOS_PC}
    for proceso in PROCESOS_PC:
        plantillas = PlantillaDocumentoModel.objects.filter(proceso=proceso)
        assert plantillas.count() == 1, proceso
        p = plantillas.get()
        assert p.activa and p.ultima_version == 1 and p.modo == 'formulario'
        assert p.nombre == 'PUNTO DE CUENTA'
        version = VersionPlantillaDocumentoModel.objects.get(plantilla=p, numero=1)
        assert version.metadatos['titulo_configurado'] == 'PUNTO DE CUENTA'
        validar_definicion('formulario', p.definicion, p.campos_propios, None, proceso)
        assert version.definicion == p.definicion and version.metadatos['proceso'] == proceso
        firmas = [b for b in p.definicion['bloques'] if b['tipo'] == 'firmas']
        assert firmas[0]['firmantes'] == [{'etiqueta': 'Director(a) General de Gestión Humana', 'detalle': ''}]


def test_sembrar_dos_veces_no_duplica_ni_pisa_lo_publicado(sembradas):
    antes = set(PlantillaDocumentoModel.objects.values_list('id', flat=True))
    sembrar_plantillas_punto_cuenta()
    assert set(PlantillaDocumentoModel.objects.values_list('id', flat=True)) == antes


def test_la_huella_guardada_es_la_del_borrador_publicado(sembradas, admin):  # noqa: F811
    """La plantilla migrada no aparece con «cambios sin publicar» en el diseñador."""
    p = PlantillaDocumentoModel.objects.get(proceso='punto_cuenta:cambio_oficina')
    r = admin.get(f'{BASE_DOCUMENTOS}/plantillas/{p.id}/')
    assert r.status_code == 200, r.content
    assert r.json()['data']['cambios_sin_publicar'] is False


def _estado_historico_de_la_migracion():
    """Modelos tal como los ve la migración 0007 (con los campos de texto que la 0008 retira)."""
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor
    from django.test import override_settings

    with connection.cursor() as c:  # el esquema de las pruebas ya es el final: se recrean las columnas viejas (se deshacen al terminar)
        for columna, tipo in (
            ('titulo', "varchar(200) NOT NULL DEFAULT 'PUNTO DE CUENTA'"), ('encabezado', "text NOT NULL DEFAULT ''"),
            ('cuerpo', "text NOT NULL DEFAULT ''"), ('firmas', "jsonb NOT NULL DEFAULT '[]'"),
            ('mostrar_nivel', 'boolean NOT NULL DEFAULT true'), ('plantillas_procesos', "jsonb NOT NULL DEFAULT '{}'"),
        ):
            c.execute(f'ALTER TABLE puntocuenta_configuracion ADD COLUMN {columna} {tipo}')
    with override_settings(MIGRATION_MODULES={}):
        return MigrationExecutor(connection).loader.project_state([
            ('puntocuenta', '0006_punto_cuenta_proceso_documento'), ('documentos', '0003_catalogo_procesos'),
        ]).apps


def test_la_migracion_convierte_la_configuracion_guardada_en_la_base(almacen):
    """De punta a punta con los modelos históricos: la fila de configuración vieja → plantillas publicadas y activas."""
    apps_historicas = _estado_historico_de_la_migracion()
    Config = apps_historicas.get_model('puntocuenta', 'ConfiguracionPuntoCuentaModel')
    Config.objects.create(
        procesos_habilitados={'cambio_oficina': True}, version=3, titulo='PUNTO DE CUENTA',
        encabezado='Aviso formal.', cuerpo='Cuerpo formal de {nombre}.',
        firmas=[{'cargo': 'Directora General', 'nombre': 'MARÍA ROJAS'}], mostrar_nivel=True,
        plantillas_procesos={'general': {'propuesta': 'Propuesta propia para {nombre}.', 'incluir_decision': False}},
    )
    mig.crear_plantillas(apps_historicas, None)
    assert PlantillaDocumentoModel.objects.filter(proceso__startswith='punto_cuenta:', activa=True).count() == len(PROCESOS_PC)

    dto = _emitir('pase_a_pasivo', almacen_=almacen)
    texto = _plano(texto_de(almacen.descargar(dto.documento_pdf_clave)))
    assert 'Aviso formal.' in texto and 'Cuerpo formal de EMPLEADO DE PRUEBA.' in texto
    assert 'Propuesta propia para EMPLEADO DE PRUEBA.' in texto
    assert 'DECISIÓN DE LA MÁXIMA AUTORIDAD' not in texto
    assert 'Directora General' in texto and 'MARÍA ROJAS' in texto
    # el ingreso conserva su texto propio aunque la configuración general sea otra
    ingreso = _emitir(PROCESO_INGRESO_POSTULACION, almacen_=almacen)
    assert 'Solicitud de aprobación del ingreso' in texto_de(almacen.descargar(ingreso.documento_pdf_clave))


# ───────────────────────── equivalencia del texto ─────────────────────────

def _variables_de(dto):
    datos, propios = datos_para_documento(dto)
    return {**datos, 'nombre': datos['nombre_completo']}, propios


def test_el_pdf_de_un_cambio_de_oficina_trae_el_mismo_texto_que_el_generador_anterior(sembradas, almacen):
    dto = _emitir('cambio_oficina', almacen_=almacen)
    assert dto.documento_generado_id and dto.documento_pdf_clave and dto.proceso == 'cambio_oficina'
    texto = _plano(texto_de(almacen.descargar(dto.documento_pdf_clave)))
    variables = {
        'nombre': 'EMPLEADO DE PRUEBA', 'cedula': 'V-12345678', 'cargo': '10', 'cargo_destino': '10', 'numero': '0001-2026',
        'motivo': 'TRASLADO', 'origen': 'OFICINA ORIGEN (DEPENDENCIA ORIGEN)',
        'destino': 'OFICINA DESTINO (DEPENDENCIA DESTINO)', 'fecha': '15/01/2026',
    }
    for fragmento in (
        'PUNTO DE CUENTA N.º 0001-2026', 'FECHA: 15 de enero de 2026',
        'PRESENTADO A: Director(a) General de la Comisión Nacional de Telecomunicaciones — Director(a) General',
        'PRESENTADO POR: Director(a) General de Gestión Humana — Director(a) General de Gestión Humana',
        'UNIDAD: Dirección General de Gestión Humana',
        'ASUNTO:', 'SÍNTESIS / EXPOSICIÓN DE MOTIVOS:', 'PROPUESTA:', 'BASE LEGAL:',
        'DECISIÓN DE LA MÁXIMA AUTORIDAD', '[ ] APROBADO [ ] NEGADO [ ] DIFERIDO [ ] VISTO',
        'OBSERVACIONES / INSTRUCCIONES:', 'Director(a) General de Gestión Humana',
    ):
        assert _plano(fragmento) in texto, fragmento
    for plantilla in (mig.ASUNTO, mig.EXPOSICION, mig.PROPUESTA, mig.BASE_LEGAL):
        for parrafo in plantilla.split('\n\n'):
            assert _plano(_como_antes(parrafo, **variables)) in texto, parrafo


@pytest.mark.parametrize('con_constancia', [True, False])
def test_el_punto_de_cuenta_de_ingreso_conserva_su_texto_con_y_sin_constancia(sembradas, almacen, con_constancia):
    extra = {'datos_adicionales': {
        'empleado_nombre': 'ANA MARÍA PÉREZ', 'emitido_por': 'María Gómez',
        'referencia_constancia': 'PART-2026-045' if con_constancia else None,
    }}
    dto = _emitir(PROCESO_INGRESO_POSTULACION, almacen_=almacen, **extra)
    texto = _plano(texto_de(almacen.descargar(dto.documento_pdf_clave)))
    constancia = ' y la disponibilidad presupuestaria quedó declarada con la referencia PART-2026-045' if con_constancia else ''
    assert _plano(
        'El puesto fue reservado para este ingreso' + constancia + '. El presente punto de cuenta es emitido por '
        'María Gómez con fecha 15 de enero de 2026.'
    ) in texto
    assert 'Solicitud de aprobación del ingreso de ANA MARÍA PÉREZ (C.I. V-12345678) al cargo de 10.' in texto
    assert 'se propone muy respetuosamente a la Máxima Autoridad aprobar el ingreso de ANA MARÍA PÉREZ' in texto


def test_una_configuracion_personalizada_se_convierte_con_sus_textos_firmas_y_secciones(almacen):
    """Plantilla propia de un proceso, sin nivel en las ubicaciones, con tabla resumen y dos firmas."""
    fila = SimpleNamespace(
        titulo='PUNTO DE CUENTA', encabezado='Aviso general.', cuerpo='Cuerpo general.',
        firmas=[{'cargo': 'Director(a) General', 'nombre': 'JUAN PÉREZ'}, {'cargo': 'Jefe de Nómina', 'nombre': ''}],
        mostrar_nivel=False,
        plantillas_procesos={
            'general': {'incluir_base_legal': False, 'incluir_tabla_resumen': True,
                        'observaciones_texto': 'Tramitar con urgencia.'},
            'cambio_nivel': {'personalizado': True, 'asunto': 'Cambio de nivel de {nombre} hacia {destino}',
                             'exposicion': 'Se mueve a {nombre} desde {origen}.\n\nMotivo: {motivo}.'},
        },
    )
    config = mig.configuracion_efectiva(fila)
    from django.apps import apps
    mig.crear_plantillas_de(apps, config)

    dto = _emitir('cambio_nivel', almacen_=almacen)
    texto = _plano(texto_de(almacen.descargar(dto.documento_pdf_clave)))
    assert 'Cambio de nivel de EMPLEADO DE PRUEBA hacia OFICINA DESTINO' in texto
    assert 'Cambio de nivel de EMPLEADO DE PRUEBA hacia OFICINA DESTINO (DEPENDENCIA' not in texto  # sin el nivel
    assert 'Se mueve a EMPLEADO DE PRUEBA desde OFICINA ORIGEN.' in texto and 'Motivo: TRASLADO.' in texto
    assert 'BASE LEGAL' not in texto
    assert 'Servidor(a) Público(a): EMPLEADO DE PRUEBA (C.I. V-12345678)' in texto
    assert 'Ubicación de Destino: OFICINA DESTINO' in texto
    assert 'Tramitar con urgencia.' in texto
    assert 'JUAN PÉREZ' in texto and 'Jefe de Nómina' in texto
    # El resto de los procesos usa el texto general.
    assert PlantillaDocumentoModel.objects.filter(proceso__startswith='punto_cuenta:').count() == len(PROCESOS_PC)
    general = PlantillaDocumentoModel.objects.get(proceso='punto_cuenta:cambio_oficina')
    assert 'Aviso general.' in str(general.definicion)


# ───────────────────────── emisión por proceso ─────────────────────────

@pytest.mark.parametrize('proceso', sorted(PROCESOS_POR_DEFECTO))
def test_cada_proceso_genera_su_documento_con_la_plantilla_publicada(sembradas, almacen, proceso):
    repo = RepoPuntoCuentaMemoria()
    dto = _emitir(proceso, repo=repo, almacen_=almacen)
    documento = DocumentoGeneradoModel.objects.get(pk=dto.documento_generado_id)
    assert documento.plantilla.proceso == f'punto_cuenta:{proceso}' and documento.version.numero == 1
    assert documento.sujeto_tipo == 'punto_cuenta' and documento.sujeto_id == str(dto.id)
    assert documento.trabajador_cedula == 'V-12345678'
    assert len(documento.pdf_sha256) == 64 and documento.datos_snapshot['numero'] == '0001-2026'
    assert 'PUNTO DE CUENTA N.º 0001-2026' in _plano(texto_de(almacen.descargar(dto.documento_pdf_clave)))
    assert repo.filas[int(dto.id)].documento_generado_id == str(documento.id)


def test_sin_plantilla_activa_el_error_es_claro_y_no_se_crea_nada(sembradas, almacen):
    PlantillaDocumentoModel.objects.filter(proceso='punto_cuenta:cambio_oficina').update(activa=False)
    repo, secuencia = RepoPuntoCuentaMemoria(), SecuenciaMemoria()
    servicio = ServicioEmisionPuntoCuenta(repo=repo, repo_secuencia=secuencia, almacen=almacen)
    with pytest.raises(PlantillaPuntoCuentaFaltante) as exc:
        servicio.emitir(proceso='cambio_oficina', cargo_id=1, cedula='V-1', dependencia_origen_id=1,
                        dependencia_destino_id=2, motivo_id=None, usuario_id=None)
    assert 'Falta la plantilla del Punto de Cuenta de cambio de oficina' in str(exc.value)
    assert repo.filas == {} and secuencia.ultimo == 0 and not DocumentoGeneradoModel.objects.exists()


def test_una_plantilla_en_borrador_o_sin_publicar_no_sirve(almacen):
    PlantillaDocumentoModel.objects.create(
        codigo='PC_BORRADOR', nombre='Borrador', modo='formulario', proceso='punto_cuenta:cambio_oficina',
        definicion={'pagina': {'tamano': 'carta', 'orientacion': 'vertical'}, 'encabezado': {'tipo': 'ninguno'},
                    'bloques': []}, activa=True, ultima_version=0)
    with pytest.raises(PlantillaPuntoCuentaFaltante):
        _emitir('cambio_oficina', almacen_=almacen)


def test_el_pdf_ya_emitido_no_cambia_si_la_plantilla_se_republica(sembradas, almacen, admin):  # noqa: F811
    dto = _emitir('cambio_oficina', almacen_=almacen)
    original = almacen.descargar(dto.documento_pdf_clave)
    p = PlantillaDocumentoModel.objects.get(proceso='punto_cuenta:cambio_oficina')
    definicion = p.definicion
    definicion['encabezado']['titulo'] = 'OTRO TÍTULO'
    assert admin.put(f'{BASE_DOCUMENTOS}/plantillas/{p.id}/', {'definicion': definicion}, format='json').status_code == 200
    assert admin.post(f'{BASE_DOCUMENTOS}/plantillas/{p.id}/publicar/').status_code == 201
    assert almacen.descargar(dto.documento_pdf_clave) == original
    nuevo = _emitir('cambio_oficina', almacen_=almacen)
    assert DocumentoGeneradoModel.objects.get(pk=nuevo.documento_generado_id).version.numero == 2


# ───────────────────────── lista de plantillas y filtros ─────────────────────────

def test_la_lista_avisa_de_los_procesos_sin_plantilla_del_punto_de_cuenta(admin):  # noqa: F811
    r = admin.get(f'{BASE_DOCUMENTOS}/plantillas/?grupo=punto_cuenta&incluir_alertas=true')
    assert r.status_code == 200
    datos = r.json()['data']
    assert datos['plantillas'] == [] and len(datos['alertas']) == len(PROCESOS_PC)
    assert 'Falta la plantilla del Punto de Cuenta de cambio de oficina.' in {a['mensaje'] for a in datos['alertas']}


def test_con_las_plantillas_publicadas_no_hay_alertas_y_el_filtro_por_proceso_funciona(sembradas, admin):  # noqa: F811
    datos = admin.get(f'{BASE_DOCUMENTOS}/plantillas/?grupo=punto_cuenta&incluir_alertas=true').json()['data']
    assert datos['alertas'] == [] and len(datos['plantillas']) == len(PROCESOS_PC)
    una = admin.get(f'{BASE_DOCUMENTOS}/plantillas/?proceso=punto_cuenta:cambio_nivel').json()['data']
    assert [p['proceso'] for p in una] == ['punto_cuenta:cambio_nivel']
    assert una[0]['proceso_etiqueta'] == 'Punto de Cuenta: cambio de nivel' and una[0]['grupo'] == 'punto_cuenta'
    assert admin.get(f'{BASE_DOCUMENTOS}/plantillas/?proceso=inventado').status_code == 400


def test_activar_otra_plantilla_del_mismo_proceso_desactiva_la_anterior(sembradas, admin):  # noqa: F811
    anterior = PlantillaDocumentoModel.objects.get(proceso='punto_cuenta:cambio_oficina')
    copia = admin.post(f'{BASE_DOCUMENTOS}/plantillas/{anterior.id}/duplicar/').json()['data']
    assert admin.post(f'{BASE_DOCUMENTOS}/plantillas/{copia["id"]}/publicar/').status_code == 201
    assert admin.post(f'{BASE_DOCUMENTOS}/plantillas/{copia["id"]}/activar/', {'activa': True}, format='json').status_code == 200
    anterior.refresh_from_db()
    assert anterior.activa is False
    assert PlantillaDocumentoModel.objects.filter(proceso='punto_cuenta:cambio_oficina', activa=True).count() == 1


def test_el_dto_de_ejemplo_tiene_los_datos_del_catalogo():
    dto = PuntoCuentaDTO(
        id='1', cargo_id=1, empleado_cedula='V-1', empleado_nombre='A', dependencia_origen_id=None,
        dependencia_origen_nombre=None, dependencia_destino_id=None, dependencia_destino_nombre=None,
        motivo_id=None, motivo_nombre=None, usuario_id=None, fecha='2026-01-15T10:00:00',
        documento_pdf_clave=None, documento_generado=False,
    )
    datos, propios = datos_para_documento(dto)
    assert datos['nombre_completo'] == 'A' and datos['fecha_larga'] == '15 de enero de 2026'
    assert propios['frase_reserva'] == 'El puesto fue reservado para este ingreso.'
