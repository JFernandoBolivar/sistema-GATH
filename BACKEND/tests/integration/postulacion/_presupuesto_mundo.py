"""Piezas compartidas por las pruebas de Presupuesto, Dirección General y vencimientos (bloque E), contra la BD."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.postulacion.application.use_cases.postulantes import crear_postulante_con_expediente
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import BuscadorEmpleadosORM, RepoPostulacionORM

VISTAS = 'apps.postulacion.presentation.views'
BASE = '/api/v1/postulacion'
PDF = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'

PRESUPUESTO = (
    'postulacion.ver_solicitudes', 'postulacion.reservar_puesto', 'postulacion.declarar_disponibilidad',
    'postulacion.devolver_solicitud', 'postulacion.emitir_punto_cuenta',
)
DIRECCION = ('postulacion.ver_ingresos', 'postulacion.aprobar_ingreso')


class Personal:
    is_authenticated = True
    is_active = True
    rol_id = None
    id = None

    def __init__(self, permisos, cedula='20000001', nombre='María Gómez'):
        self.pk = 1
        self.cedula_id = cedula
        self.nombre_completo = nombre
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(*permisos, cedula='20000001', nombre='María Gómez'):
    c = APIClient()
    c.force_authenticate(user=Personal(permisos, cedula, nombre))
    return c


class Config:
    def __init__(self, psicofisico=False, requiere_presupuesto=True, requiere_direccion_general=True):
        self.valores = {
            'captacion.vigencia_ventana1_dias': 15, 'captacion.vigencia_ventana2_dias': 10,
            'captacion.vigencia_reserva_puesto_dias': 30, 'captacion.espera_diferido_dias': 90, 'captacion.horas_escalamiento_contacto': 48,
            'captacion.psicofisico_obligatorio': psicofisico,
            'captacion.requiere_presupuesto': requiere_presupuesto,
            'captacion.requiere_direccion_general': requiere_direccion_general,
        }

    def obtener_texto(self, clave):
        return str(self.valores[clave])

    def obtener_booleano(self, clave):
        return bool(self.valores[clave])

    def obtener_entero(self, clave):
        return int(self.valores[clave])


class Almacen:
    objetos: dict = {}
    falla_con_prefijo: str = ''

    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        if Almacen.falla_con_prefijo and clave.startswith(Almacen.falla_con_prefijo):
            raise RuntimeError('almacén caído')
        self.objetos[clave] = contenido
        return clave

    def eliminar(self, clave):
        self.objetos.pop(clave, None)

    def descargar_flujo(self, clave, tamano_bloque=65536):
        yield self.objetos[clave]


class Notificador:
    emitidas: list = []
    resueltas: list = []
    correos: list = []

    def enviar_correo_directo(self, solicitud):
        self.correos.append(solicitud)
        return True

    def notificar(self, solicitud):
        self.emitidas.append(solicitud)
        return 1

    def resolver_avisos(self, ref_tipo, ref_id, por_cedula, tipo=None):
        self.resueltas.append((ref_tipo, ref_id, por_cedula, tipo))
        return 1


def reiniciar_dobles():
    Almacen.objetos, Almacen.falla_con_prefijo = {}, ''
    Notificador.emitidas, Notificador.resueltas, Notificador.correos = [], [], []


def instalar_dobles(monkeypatch):
    """Config, almacén y notificador falsos en las vistas de Presupuesto, Dirección General y en el emisor del Punto de Cuenta."""
    reiniciar_dobles()
    for modulo in ('presupuesto_views', 'direccion_views'):
        monkeypatch.setattr(f'{VISTAS}.{modulo}.configuracion', lambda: Config(), raising=False)
        monkeypatch.setattr(f'{VISTAS}.{modulo}.obtener_notificador', lambda: Notificador(), raising=False)
    monkeypatch.setattr(f'{VISTAS}.presupuesto_views.SeaweedFSStorage', Almacen)
    monkeypatch.setattr(f'{VISTAS}.captacion_views.configuracion', lambda: Config())
    monkeypatch.setattr(f'{VISTAS}.captacion_views.obtener_notificador', lambda: Notificador())
    monkeypatch.setattr('core.infrastructure.storage.seaweedfs_storage.SeaweedFSStorage', Almacen)


def crear_mundo() -> dict:
    """Catálogos, una estructura organizativa y puestos: tres vacantes de ANALISTA en GESTION HUMANA, uno ocupado y uno de otro cargo."""
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.get_or_create(sexo='F')[0]
    estatus = EstatusModel.objects.get_or_create(estatus='VACANTE')[0]
    nomina = TipoNominaModel.objects.get_or_create(nomina='FIJO')[0]
    analista = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    chofer = DenominacionCargoModel.objects.create(cargo='CHOFER')
    esp = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dep = DependenciaModel.objects.create(Codigo='D1', dependencia='NIVEL CENTRAL')
    dg = DireccionGeneralModel.objects.create(Codigo='G1', direccion_general='GESTION HUMANA', dependenciaId=dep)
    otra_dg = DireccionGeneralModel.objects.create(Codigo='G2', direccion_general='LEGAL', dependenciaId=dep)
    linea = DireccionLineaModel.objects.create(Codigo='L1', direccion_linea='NOMINA', direccionGeneral=dg)
    coord = CoordinacionModel.objects.create(Codigo='C1', coordinacion='PAGOS', direccionLinea=linea)
    ocupante = EmployeeModel.objects.create(cedulaidentidad='9000001', nombres='Luis', apellidos='Ocupante', sexoid=sexo)

    def puesto(codigo, cargo=analista, dg_=dg, empleado=None):
        return AsigTrabajoModel.objects.create(
            codigo=codigo, employee=empleado, denominacioncargoid=cargo, denominacioncargoespecificoid=esp,
            tiponominaid=nomina, estatusid=estatus, Dependencia=dep, DireccionGeneral=dg_, DireccionLinea=linea,
            Coordinacion=coord,
        )

    return {
        'analista': analista, 'chofer': chofer, 'dep': dep, 'dg': dg, 'otra_dg': otra_dg, 'linea': linea,
        'p1': puesto('A-001'), 'p2': puesto('A-002'), 'p3': puesto('A-003'),
        'ocupado': puesto('A-OCU', empleado=ocupante), 'de_chofer': puesto('C-001', cargo=chofer),
        'de_legal': puesto('A-LEG', dg_=otra_dg), 'puesto': puesto,
    }


def crear_expediente(mundo=None, cedula='12345678', estado='EN_PRESUPUESTO', nombres='Ana María', apellidos='Pérez',
                     con_propuesta=True, requiere_presupuesto=True, requiere_direccion_general=True) -> str:
    """Expediente en `estado`, con la propuesta (cargo ANALISTA y oficina GESTION HUMANA) si hay `mundo`."""
    _, exp, _ = crear_postulante_con_expediente(
        RepoPostulacionORM(), BuscadorEmpleadosORM(), Config(
            requiere_presupuesto=requiere_presupuesto, requiere_direccion_general=requiere_direccion_general,
        ), cedula=cedula, nombres=nombres, apellidos=apellidos, creado_por='20000001',
    )
    campos = {'estado': estado}
    if mundo is not None and con_propuesta:
        campos.update(
            cargo_propuesto_id=mundo['analista'].pk, dependencia_id=mundo['dep'].pk, direccion_general_id=mundo['dg'].pk,
        )
    ExpedientePostulacionModel.objects.filter(pk=exp.id).update(**campos)
    return exp.id


def ahora_mas(**kw):
    return timezone.now() + timedelta(**kw)


def codigo(r):
    return (r.json().get('data') or {}).get('codigo')


def datos(r):
    return r.json()['data']


def reservar(c, exp, puesto):
    return c.post(f'{BASE}/solicitudes/{exp}/reserva/', {'puesto_id': puesto.pk}, format='json')


def declarar(c, exp, referencia='PART-2026-045', **extra):
    return c.post(f'{BASE}/solicitudes/{exp}/constancia/', {'referencia': referencia, **extra}, format='multipart')


def transicion_presupuesto(c, exp, destino, motivo=''):
    return c.post(f'{BASE}/solicitudes/{exp}/transicion/', {'destino': destino, 'motivo': motivo}, format='json')


def transicion_direccion(c, exp, destino, motivo=''):
    return c.post(f'{BASE}/ingresos/{exp}/transicion/', {'destino': destino, 'motivo': motivo}, format='json')


def listo_para_dg(mundo, exp, puesto_clave='p1', presupuesto=None) -> None:
    """Reserva + constancia + emisión del Punto de Cuenta por la API: deja el expediente EN_DIRECCION_GENERAL."""
    c = presupuesto or cliente(*PRESUPUESTO)
    assert reservar(c, exp, mundo[puesto_clave]).status_code == 200
    assert declarar(c, exp).status_code == 200
    r = transicion_presupuesto(c, exp, 'EN_DIRECCION_GENERAL')
    assert r.status_code == 200, r.content
