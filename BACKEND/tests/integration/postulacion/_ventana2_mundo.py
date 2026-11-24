"""Piezas compartidas por las pruebas de la Ventana 2, la revisión final y la promoción (bloque G), contra la BD."""
from datetime import timedelta
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
    TipoPersonalModel,
    TipoProcedenciaModel,
)
from apps.catalogos.infrastructure.models.geografia_models import EstadoModel, MunicipioModel, ParroquiaModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CapacitacionModel,
    CarreraModel,
    CategoriaAlergiaModel,
    CategoriaDiscapacidadModel,
    CategoriaPatologiaModel,
    CondicionViviendaModel,
    DiscapacidadModel,
    GrupoSanguineoModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
    RegionTallaModel,
    TallaModel,
    TipoPrendaModel,
)
from apps.personal.infrastructure.models.idioma_models import IdiomaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.postulacion.infrastructure.models.credencial_models import CredencialPostulanteModel
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel
from tests.integration.postulacion._presupuesto_mundo import BASE, Almacen, Config, Notificador, crear_expediente

CLAVE_NUEVA = 'Clave-nueva-2026'
CAPTACION = (
    'postulacion.ver_bandeja', 'postulacion.verificar', 'postulacion.rechazar', 'postulacion.abrir_expediente',
    'postulacion.revision_final', 'postulacion.registrar_psicofisico', 'postulacion.crear_postulante',
)


class Personal:
    """Personal con permisos fijos; `pk` es el de una cuenta REAL (el movimiento INGRESO la referencia)."""

    is_authenticated = True
    is_active = True
    rol_id = None
    id = None

    def __init__(self, permisos, cedula='20000001', pk=1):
        self.pk = pk
        self.cedula_id = cedula
        self.nombre_completo = 'Carla Captación'
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente_personal(*permisos, cedula='20000001', pk=1, sin_excepciones=False):
    """`sin_excepciones`: un error no controlado vuelve como 500 en vez de relanzarse en la prueba."""
    c = APIClient(raise_request_exception=not sin_excepciones)
    c.force_authenticate(user=Personal(permisos, cedula, pk))
    return c


def foto(ancho=400, alto=500, formato='JPEG', nombre=None):
    """Imagen real de prueba como archivo subido."""
    buffer = BytesIO()
    Image.new('RGB', (ancho, alto), (120, 90, 60)).save(buffer, format=formato)
    return SimpleUploadedFile(nombre or ('foto.jpg' if formato == 'JPEG' else 'foto.png'), buffer.getvalue())


def crear_catalogos_v2() -> dict:
    """Catálogos mínimos de la Ventana 2 (ids que usan los formularios y la promoción)."""
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    femenino = SexoModel.objects.get_or_create(sexo='F')[0]
    masculino = SexoModel.objects.get_or_create(sexo='M')[0]
    hijo = ParentescoModel.objects.create(descripcion_parentesco='HIJO(A)')
    conyuge = ParentescoModel.objects.create(descripcion_parentesco='CONYUGE')
    no_familiar = ParentescoModel.objects.create(descripcion_parentesco='AMIGO', aplica_familiar=False)
    condicion = CondicionViviendaModel.objects.create(condicion='PROPIA')
    estado = EstadoModel.objects.create(estado='MIRANDA')
    otro_estado = EstadoModel.objects.create(estado='ZULIA')
    municipio = MunicipioModel.objects.create(municipio='BARUTA', estadoid=estado)
    municipio_zulia = MunicipioModel.objects.create(municipio='MARACAIBO', estadoid=otro_estado)
    parroquia = ParroquiaModel.objects.create(parroquia='NUESTRA SENORA DEL ROSARIO', municipioid=municipio)
    sangre = GrupoSanguineoModel.objects.create(GrupoSanguineo='O+')
    alergia = AlergiaModel.objects.create(alergia='POLEN', categoria=CategoriaAlergiaModel.objects.create(nombre_categoria='AMBIENTAL'))
    patologia = PatologiaCronicaModel.objects.create(
        patologia='ASMA', categoria=CategoriaPatologiaModel.objects.create(nombre_categoria='RESPIRATORIA'))
    discapacidad = DiscapacidadModel.objects.create(
        discapacidad='AUDITIVA', categoria=CategoriaDiscapacidadModel.objects.create(nombre_categoria='SENSORIAL'))
    region = RegionTallaModel.objects.create(codigo='ADULTO')
    prendas = {n: TipoPrendaModel.objects.create(categoria=n) for n in ('CAMISA', 'PANTALON', 'ZAPATOS', 'CHAQUETA')}
    tallas = {n: TallaModel.objects.create(valor=v, region=region, tipo_prenda=prendas[n]) for n, v in (
        ('CAMISA', 'M'), ('PANTALON', '32'), ('ZAPATOS', '40'), ('CHAQUETA', 'L'))}
    nivel = NivelAcademicoModel.objects.create(nivelacademico='UNIVERSITARIO')
    otro_nivel = NivelAcademicoModel.objects.create(nivelacademico='BACHILLER')
    carrera = CarreraModel.objects.create(nombre_carrera='INGENIERIA EN SISTEMAS', nivel_academico_id=nivel)
    mencion = MencionModel.objects.create(carrera_id=carrera, nombre_mencion='REDES')
    otra_carrera = CarreraModel.objects.create(nombre_carrera='DERECHO', nivel_academico_id=nivel)
    institucion = InstitucionModel.objects.create(nombre_institucion='UNIVERSIDAD CENTRAL DE VENEZUELA')
    capacitacion = CapacitacionModel.objects.create(nombre_capacitacion='GERENCIA PUBLICA')
    organismo = OrganismoAdscritoModel.objects.create(Organismoadscrito='SENIAT')
    ingles = IdiomaModel.objects.create(nombre='Inglés')
    frances = IdiomaModel.objects.create(nombre='Francés')
    TipoProcedenciaModel.objects.get_or_create(tipo_procedencia='EXTERNA')
    return {
        'nivel': nivel, 'otro_nivel': otro_nivel, 'carrera': carrera, 'mencion': mencion, 'otra_carrera': otra_carrera,
        'institucion': institucion, 'capacitacion': capacitacion, 'organismo': organismo, 'ingles': ingles, 'frances': frances,
        'femenino': femenino, 'masculino': masculino, 'hijo': hijo, 'conyuge': conyuge, 'no_familiar': no_familiar,
        'condicion': condicion, 'estado': estado, 'otro_estado': otro_estado, 'municipio': municipio,
        'municipio_zulia': municipio_zulia, 'parroquia': parroquia, 'sangre': sangre, 'alergia': alergia,
        'patologia': patologia, 'discapacidad': discapacidad, 'tallas': tallas,
    }


def datos_v2(cat: dict, **cambios) -> dict:
    """Ventana 2 COMPLETA y válida (un cónyuge y un hijo menor sin cédula)."""
    datos = {
        'familiares': [
            {'primer_nombre': 'Luis', 'primer_apellido': 'Gómez', 'cedula': '9876543', 'parentesco_id': cat['conyuge'].pk,
             'sexo_id': cat['masculino'].pk, 'fecha_nacimiento': '1988-02-10', 'depende_economicamente': False},
            {'primer_nombre': 'Sofía', 'segundo_nombre': 'Ana', 'primer_apellido': 'Gómez', 'orden_hijo': 1,
             'parentesco_id': cat['hijo'].pk, 'sexo_id': cat['femenino'].pk,
             'fecha_nacimiento': f'{timezone.now().year - 5}-03-01', 'depende_economicamente': True},
        ],
        'vivienda': {
            'condicion_vivienda_id': cat['condicion'].pk, 'estado_id': cat['estado'].pk,
            'municipio_id': cat['municipio'].pk, 'parroquia_id': cat['parroquia'].pk,
            'direccion_exacta': 'Av. Principal, Torre B, piso 3, apto 3-C', 'ciudad_region': 'Caracas',
        },
        'salud': {
            'grupo_sanguineo_id': cat['sangre'].pk, 'alergias': [cat['alergia'].pk],
            'patologias_cronicas': [cat['patologia'].pk], 'discapacidades': [],
        },
        'tallas': {
            'talla_camisa_id': cat['tallas']['CAMISA'].pk, 'talla_pantalon_id': cat['tallas']['PANTALON'].pk,
            'talla_zapatos_id': cat['tallas']['ZAPATOS'].pk,
        },
        'estudios': [{
            'nivel_academico_id': cat['nivel'].pk, 'carrera_id': cat['carrera'].pk, 'mencion_id': cat['mencion'].pk,
            'institucion_id': cat['institucion'].pk,
        }],
        'cursos': [{
            'capacitacion_id': cat['capacitacion'].pk, 'institucion_id': cat['institucion'].pk,
            'fecha_inicio': '2023-02-01', 'fecha_fin': '2023-03-01', 'horas': 40,
        }],
        'antecedentes': [{'organismo_id': cat['organismo'].pk, 'fecha_ingreso': '2015-01-05', 'fecha_egreso': '2020-12-31'}],
        'trabajo_antes_en_conatel': False,
        'idiomas': [{'idioma_id': cat['ingles'].pk, 'nivel': 'BIEN'}, {'otro_idioma': 'Guaraní', 'nivel': 'POCO'}],
        'rif': 'V-12345678-9',
    }
    datos.update(cambios)
    return datos


class Mundo2:
    """Escenario completo: catálogos de la V2, estructura y puestos (`crear_mundo`), roles y la cuenta de quien asigna."""

    def __init__(self, mundo: dict):
        self.mundo = mundo
        self.cat = crear_catalogos_v2()
        EstatusModel.objects.get_or_create(estatus='ACTIVO')
        TipoPersonalModel.objects.get_or_create(tipo_personal='ACTIVO')
        RolModel.objects.get_or_create(id=3, defaults={'nombre_rol': 'AUTOGESTION'})
        empleado = EmployeeModel.objects.create(
            cedulaidentidad='20000001', nombres='Carla', apellidos='Captación', sexoid=self.cat['femenino'])
        self.cuenta = CuentaModel.objects.create_user(cedula=empleado, password='Clave-Segura-2026', rol_id=3)

    def captacion(self, *permisos, sin_excepciones=False):
        return cliente_personal(*(permisos or CAPTACION), cedula='20000001', pk=self.cuenta.pk, sin_excepciones=sin_excepciones)


def completar_ventana2(exp_id: str, cat: dict, con_foto=True, **cambios) -> None:
    """Deja el expediente en CONSOLIDANDO (ventana 2 vigente) con la Ventana 2 completa, directo en la BD."""
    campos = dict(
        estado='CONSOLIDANDO', ventana=2, ventana_vence_el=timezone.now() + timedelta(days=5),
        datos_ventana1={'fecha_nacimiento': '1990-05-17', 'sexo': 'F', 'nacionalidad': 'V'},
        datos_ventana2=datos_v2(cat),
    )
    if con_foto:
        campos.update(foto_clave='postulacion/foto/semilla.jpg', foto_sha256='0' * 64, foto_tamano=10, foto_subida_el=timezone.now())
    campos.update(cambios)
    ExpedientePostulacionModel.objects.filter(pk=exp_id).update(**campos)
    CredencialPostulanteModel.objects.filter(expediente_id=exp_id).update(ventana=2, vence_el=campos['ventana_vence_el'])


def listo_para_asignar(m2: Mundo2, cedula='12345678', puesto='p1', correo='ana.perez@conatel.gob.ve', foto_en_almacen=True) -> str:
    """Un expediente LISTO_PARA_ASIGNAR con la Ventana 2 completa, reserva ACTIVA del puesto y la foto en el almacén."""
    from apps.postulacion.infrastructure.models.expediente_models import PostulanteModel
    from apps.postulacion.infrastructure.models.presupuesto_models import ReservaPuestoModel

    exp = crear_expediente(m2.mundo, cedula)
    PostulanteModel.objects.filter(cedula=cedula).update(correo=correo, telefono_movil='04141234567')
    completar_ventana2(exp, m2.cat, estado='LISTO_PARA_ASIGNAR', reserva_vence_el=timezone.now() + timedelta(days=20))
    ReservaPuestoModel.objects.create(
        expediente_id=exp, puesto_id=m2.mundo[puesto].pk, reservado_por='20000001', vence_el=timezone.now() + timedelta(days=20),
    )
    # La credencial de la Ventana 2 (suspendida mientras el expediente está en revisión): la promoción debe revocarla.
    from apps.postulacion.application.use_cases.credenciales import emitir_credencial
    from apps.postulacion.infrastructure.hasheador_django import HasheadorDjango
    from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM

    emitir_credencial(RepoPostulacionORM(), HasheadorDjango(), expediente_id=exp, emitida_por='20000001')
    if foto_en_almacen:
        Almacen.objetos['postulacion/foto/semilla.jpg'] = b'\xff\xd8\xff-foto'
    return exp


def instalar_dobles_g(monkeypatch):
    """Config, almacén y notificador falsos en TODAS las vistas del bloque G (postulante y Captación)."""
    from tests.integration.postulacion._presupuesto_mundo import instalar_dobles

    instalar_dobles(monkeypatch)
    vistas = 'apps.postulacion.presentation.views'
    monkeypatch.setattr(f'{vistas}.postulante_views.configuracion', lambda: Config())
    monkeypatch.setattr(f'{vistas}.postulante_views.obtener_notificador', lambda: Notificador())
    monkeypatch.setattr(f'{vistas}.postulante_views.SeaweedFSStorage', Almacen)
    monkeypatch.setattr(f'{vistas}.captacion_views.SeaweedFSStorage', Almacen)


def postulante_en_ventana2(m2: Mundo2, cedula='12345678', con_foto=False, completa=False):
    """Alta por la API, acceso, cambio de clave y reapertura de la Ventana 2. Devuelve `(cliente_postulante, exp_id)`."""
    captacion = m2.captacion()
    alta = captacion.post(f'{BASE}/postulantes/', {
        'cedula': cedula, 'nombres': 'Ana María', 'apellidos': 'Pérez', 'correo': 'ana@ejemplo.invalid',
        'telefono_movil': '04141234567'}, format='json').json()['data']
    exp = alta['expediente']['id']
    ExpedientePostulacionModel.objects.filter(pk=exp).update(estado='APROBADO')
    r = captacion.post(f'{BASE}/expedientes/{exp}/transicion/', {'destino': 'CONSOLIDANDO'}, format='json')
    assert r.status_code == 200, r.content
    clave = r.json()['data']['credencial']['clave_temporal']
    anonimo = APIClient()
    r = anonimo.post(f'{BASE}/acceso/', {'cedula': cedula, 'password': clave}, format='json')
    assert r.status_code == 200, r.content
    token = r.json()['data']['token']
    r = anonimo.post(f'{BASE}/cambiar-clave/', {'clave_actual': clave, 'clave_nueva': CLAVE_NUEVA}, format='json',
                     HTTP_AUTHORIZATION=f'Bearer {token}')
    assert r.status_code == 200, r.content
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['data']['token']}")
    if completa:
        ExpedientePostulacionModel.objects.filter(pk=exp).update(
            datos_ventana1={'fecha_nacimiento': '1990-05-17', 'sexo': 'F', 'nacionalidad': 'V'},
            datos_ventana2=datos_v2(m2.cat),
        )
    if con_foto or completa:
        assert c.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart').status_code == 200
    return c, exp
