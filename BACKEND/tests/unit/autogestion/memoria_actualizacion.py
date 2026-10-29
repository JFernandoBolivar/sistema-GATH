"""
Dobles en memoria de los puertos de la solicitud de actualización (D-09): las reglas de negocio
se prueban sin Django ni PostgreSQL.
"""
import uuid
from dataclasses import replace
from datetime import datetime, timezone

from apps.autogestion.domain.entities.solicitud_actualizacion import SeccionAutogestionable
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from core.domain.exceptions import ConflictError

AHORA = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)
TRABAJADOR = '20111234'
BIENESTAR = '20222222'


class RepoSolicitudesMem:
    def __init__(self):
        self.filas, self.reservas, self.prorrogas = {}, {}, []

    def crear(self, solicitud):
        for s in solicitud.secciones_solicitadas:
            if (solicitud.cedula, s) in self.reservas:
                raise ConflictError('Ya existe una solicitud abierta')
        nueva = replace(solicitud, id=uuid.uuid4().hex, fecha_solicitud=AHORA)
        self.filas[nueva.id] = nueva
        for s in nueva.secciones_solicitadas:
            self.reservas[(nueva.cedula, s)] = nueva.id
        return nueva

    def obtener(self, solicitud_id, bloquear=False):
        return self.filas.get(solicitud_id)

    def guardar(self, solicitud, version_esperada):
        if self.filas[solicitud.id].version != version_esperada:
            raise ConflictError('versión')
        guardada = replace(solicitud, version=version_esperada + 1)
        self.filas[solicitud.id] = guardada
        return guardada

    def liberar_secciones(self, solicitud_id, secciones=None):
        for clave, sid in list(self.reservas.items()):
            if sid == solicitud_id and (secciones is None or clave[1] in secciones):
                del self.reservas[clave]

    def listar_de_cedula(self, cedula):
        return [s for s in self.filas.values() if s.cedula == cedula]

    def listar(self, estado, cedula, limite, desplazamiento):
        items = [s for s in self.filas.values() if (not estado or s.estado.value == estado) and (not cedula or s.cedula == cedula)]
        return items[desplazamiento:desplazamiento + limite], len(items)

    def listar_habilitadas_vencidas(self, ahora):
        return [s for s in self.filas.values() if s.estado is EstadoSolicitud.HABILITADA and s.ventana_fin < ahora]

    def listar_habilitadas_por_vencer(self, ahora, hasta):
        return [s for s in self.filas.values() if s.estado is EstadoSolicitud.HABILITADA and ahora <= s.ventana_fin <= hasta]

    def agregar_prorroga(self, prorroga):
        self.prorrogas.append(prorroga)
        return prorroga

    def listar_prorrogas(self, solicitud_id):
        return [p for p in self.prorrogas if p.solicitud_id == solicitud_id]


class RepoCambiosMem:
    def __init__(self):
        self.filas = {}

    def reemplazar(self, origen_tipo, origen_id, cambios, conservar_secciones=()):
        for cid, c in list(self.filas.items()):
            if c.origen_id == origen_id and c.seccion not in conservar_secciones:
                del self.filas[cid]
        for c in cambios:
            nuevo = replace(c, id=uuid.uuid4().hex)
            self.filas[nuevo.id] = nuevo

    def listar(self, origen_tipo, origen_id):
        return [c for c in self.filas.values() if c.origen_id == origen_id]

    def guardar_decisiones(self, cambios):
        for c in cambios:
            self.filas[c.id] = c

    def eliminar_de_seccion(self, origen_tipo, origen_id, seccion):
        for cid, c in list(self.filas.items()):
            if c.origen_id == origen_id and c.seccion == seccion:
                del self.filas[cid]

    def guardar(self, cambio):
        nuevo = replace(cambio, id=uuid.uuid4().hex)
        self.filas[nuevo.id] = nuevo
        return nuevo


class RepoSoportesMem:
    def __init__(self):
        self.filas = {}

    def agregar(self, soporte):
        nuevo = replace(soporte, id=uuid.uuid4().hex)
        self.filas[nuevo.id] = nuevo
        return nuevo

    def obtener(self, soporte_id):
        return self.filas.get(soporte_id)

    def listar(self, origen_tipo, origen_id):
        return [s for s in self.filas.values() if s.origen_id == origen_id]

    def eliminar(self, soporte_id):
        self.filas.pop(soporte_id, None)


class RepoSeccionesMem:
    def __init__(self):
        self.filas = {
            'contacto': SeccionAutogestionable('contacto', 'Contacto', False),
            'vivienda': SeccionAutogestionable('vivienda', 'Vivienda', False),
            'formacion': SeccionAutogestionable('formacion', 'Formación', True),
            'familiar': SeccionAutogestionable('familiar', 'Familiares', True),
            'foto': SeccionAutogestionable('foto', 'Foto', False),
        }

    def listar(self, solo_activas=True):
        return [s for s in self.filas.values() if s.activa or not solo_activas]

    def obtener(self, codigo):
        return self.filas.get(codigo)

    def guardar(self, seccion):
        self.filas[seccion.codigo] = seccion
        return seccion


class FichaMem:
    """Ficha vigente simulada: lector (solo lectura) y aplicador (único que escribe)."""

    def __init__(self):
        self.datos = {
            ('employee', None): {'telefono_movil': '04141111111', 'telefono_habitacion': '02121111111', 'profile': 'perfiles/viejo.jpg'},
            ('familiar', '7'): {'primer_nombre': 'ANA', 'parentesco_id': 3},
            ('datos_complementarios', None): {'correo_alternativo': None},
        }
        self.aplicaciones = []

    # LectorFicha
    def valor_actual(self, cedula, entidad, entidad_id, campo):
        return self.datos.get((entidad, entidad_id), {}).get(campo)

    def pertenece_al_trabajador(self, cedula, entidad, entidad_id):
        return (entidad, entidad_id) in self.datos

    def existe_registro_unico(self, cedula, entidad):
        return (entidad, None) in self.datos

    def validar_referencias(self, valores):
        return None

    # AplicadorCambios
    def aplicar(self, cedula, cambios, soportes, actor_cedula):
        self.aplicaciones.append([c.campo for c in cambios])
        for c in cambios:
            self.datos.setdefault((c.entidad_destino, c.entidad_id), {})[c.campo] = c.valor_propuesto


class AlmacenMem:
    def __init__(self):
        self.objetos = {}

    def subir(self, clave, contenido, mime_type):
        self.objetos[clave] = contenido
        return clave

    def eliminar(self, clave):
        self.objetos.pop(clave, None)


class PublicadorMem:
    def __init__(self):
        self.eventos = []

    def publicar(self, evento):
        self.eventos.append(evento)

    @property
    def tipos(self):
        return [e.tipo.value.split('.')[1] for e in self.eventos]


class Mundo:
    """Un escenario completo con todos los puertos en memoria."""

    def __init__(self):
        self.solicitudes, self.cambios, self.soportes = RepoSolicitudesMem(), RepoCambiosMem(), RepoSoportesMem()
        self.secciones, self.ficha, self.almacen, self.publicador = RepoSeccionesMem(), FichaMem(), AlmacenMem(), PublicadorMem()
