"""Dobles en memoria de los puertos de fe de vida (D-09): las reglas se prueban sin Django ni PostgreSQL."""
import itertools
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.entities.solicitud import ActorRevision
from apps.fe_de_vida.domain.value_objects.estados import RolRevision
from core.domain.exceptions import AlmacenamientoNoDisponible, ConflictError

AHORA = datetime(2026, 11, 2, 12, 0, tzinfo=timezone.utc)
APERTURA = AHORA - timedelta(days=1)
CIERRE = AHORA + timedelta(days=30)
PASIVO = '5111111'
OTRO_PASIVO = '5222222'
ANALISTA = ActorRevision('20000001', RolRevision.ANALISTA)
ADMINISTRADORA = ActorRevision('20000002', RolRevision.ADMINISTRADORA)
OTRA_ADMINISTRADORA = ActorRevision('20000003', RolRevision.ADMINISTRADORA)
OTRA_ANALISTA = ActorRevision('20000004', RolRevision.ANALISTA)


class RepoProcesosMem:
    def __init__(self):
        self.filas, self.prorrogas, self._ids = {}, [], itertools.count(1)

    def crear(self, proceso):
        p = replace(proceso, id=f'p{next(self._ids)}')
        self.filas[p.id] = p
        return p

    def obtener(self, proceso_id, bloquear=False):
        return self.filas.get(proceso_id)

    def guardar(self, proceso):
        self.filas[proceso.id] = proceso
        return proceso

    def listar(self, estado=None):
        return [p for p in self.filas.values() if estado is None or p.estado.value == estado]

    def listar_con_prorroga_vigente(self, cedula, ahora):
        ids = {p.proceso_id for p in self.prorrogas if p.alcanza(cedula) and p.vigente(ahora)}
        return [p for p in self.filas.values() if p.id in ids and p.estado.value != 'BORRADOR']

    def listar_abiertos_vencidos(self, ahora):
        return [p for p in self.filas.values() if p.vencido(ahora)]

    def agregar_prorroga(self, prorroga):
        p = replace(prorroga, id=f'pr{len(self.prorrogas) + 1}')
        self.prorrogas.append(p)
        return p

    def listar_prorrogas(self, proceso_id):
        return [p for p in self.prorrogas if p.proceso_id == proceso_id]


class RepoSolicitudesMem:
    def __init__(self):
        self.filas, self._ids = {}, itertools.count(1)

    def crear(self, solicitud):
        if any(s.proceso_id == solicitud.proceso_id and s.cedula == solicitud.cedula for s in self.filas.values()):
            raise ConflictError('Ya existe una solicitud en el proceso.')
        s = replace(solicitud, id=f's{next(self._ids)}')
        self.filas[s.id] = s
        return s

    def obtener(self, solicitud_id, bloquear=False):
        return self.filas.get(solicitud_id)

    def obtener_de(self, proceso_id, cedula, bloquear=False):
        return next((s for s in self.filas.values() if s.proceso_id == proceso_id and s.cedula == cedula), None)

    def guardar(self, solicitud, version_esperada):
        if self.filas[solicitud.id].version != version_esperada:
            raise ConflictError('La solicitud cambió.')
        s = replace(solicitud, version=version_esperada + 1)
        self.filas[s.id] = s
        return s

    def listar_de_cedula(self, cedula):
        return [s for s in self.filas.values() if s.cedula == cedula]

    def listar_de_proceso(self, proceso_id, estados=None):
        return [s for s in self.filas.values() if s.proceso_id == proceso_id and (not estados or s.estado.value in estados)]

    def listar(self, filtro, limite, desplazamiento):
        filas = [
            s for s in self.filas.values()
            if (not filtro.proceso_id or s.proceso_id == filtro.proceso_id)
            and (not filtro.estado or s.estado.value == filtro.estado)
            and (not filtro.texto or filtro.texto in s.cedula)
        ]
        return filas[desplazamiento:desplazamiento + limite], len(filas)


class RepoCambiosActaMem:
    def __init__(self):
        self.por_solicitud = {}

    def reemplazar(self, solicitud_id, cambios):
        self.por_solicitud[solicitud_id] = list(cambios)

    def listar(self, solicitud_id):
        return list(self.por_solicitud.get(solicitud_id, []))


class ValidadorMem:
    """Rechaza campos fuera de lista blanca simulada y descarta los que no difieren del dato actual."""

    def __init__(self):
        self.actuales = {('employee', 'telefono_movil'): '0414-0000000'}

    def validar(self, cedula, cambio: CambioActa):
        if cambio.campo == 'cedulaidentidad':
            from core.domain.exceptions import ValidationError
            raise ValidationError('El campo no es autogestionable.')
        if self.actuales.get((cambio.entidad_destino, cambio.campo)) == cambio.valor_propuesto:
            return None
        return cambio


class AplicadorMem:
    def __init__(self, cuantos=3):
        self.llamadas, self.cuantos = [], cuantos

    def aplicar(self, solicitud_id, cedula, actor_cedula, ahora):
        self.llamadas.append((solicitud_id, cedula, actor_cedula))
        return self.cuantos


class AlcanceMem:
    """Tipo de nómina por cédula y catálogo de pasivos (ids 1 y 2); `tipos` mapea cédula -> tipo."""

    CATALOGO = {1: 'JUBILADO', 2: 'PENSIONADO'}

    def __init__(self, tipos=None):
        self.tipos = tipos if tipos is not None else {PASIVO: 1, OTRO_PASIVO: 2}

    def tipo_nomina_de(self, cedula):
        return self.tipos.get(cedula)

    def cedulas_en_alcance(self, tipos_nomina):
        return sorted(c for c, t in self.tipos.items() if not tipos_nomina or t in tipos_nomina)

    def tipos_pension(self):
        from apps.fe_de_vida.domain.entities.pasivo import TipoPension
        return [TipoPension(i, n) for i, n in self.CATALOGO.items()]

    def nombres_tipos(self, ids):
        return {i: self.CATALOGO[i] for i in ids if i in self.CATALOGO}


class VerificadorMem:
    def __init__(self, pasivos=(PASIVO, OTRO_PASIVO)):
        self.pasivos = set(pasivos)

    def es_pasivo(self, cedula):
        return cedula in self.pasivos


class StorageMem:
    def __init__(self, falla=False):
        self.objetos, self.falla = {}, falla

    def subir(self, clave, contenido, mime_type):
        if self.falla:
            raise AlmacenamientoNoDisponible('sin almacenamiento')
        self.objetos[clave] = (contenido, mime_type)
        return clave

    def url_firmada(self, clave, expira_segundos=300):
        return f'https://s3.test/{clave}?exp={expira_segundos}'


class LectorPasivosMem:
    def datos(self, cedula):
        from apps.fe_de_vida.domain.entities.pasivo import DatosPasivo
        return DatosPasivo(cedula, f'Nombre {cedula}', 'JUBILADO', f'{cedula}@correo.test', f'alterno{cedula}@correo.test')

    def nombre_de(self, cedula):
        return f'Nombre {cedula}'

    def nombres_de(self, cedulas):
        return {c: self.nombre_de(c) for c in cedulas}


class PublicadorMem:
    def __init__(self):
        self.eventos = []

    def publicar(self, evento):
        self.eventos.append(evento)

    def tipos(self):
        return [e.tipo.value for e in self.eventos]


class Mundo:
    """Repos + puertos en memoria con un proceso ABIERTO listo."""

    def __init__(self):
        from apps.fe_de_vida.application.use_cases.procesos import abrir_proceso, crear_proceso

        self.procesos, self.solicitudes, self.cambios = RepoProcesosMem(), RepoSolicitudesMem(), RepoCambiosActaMem()
        self.validador, self.aplicador, self.verificador = ValidadorMem(), AplicadorMem(), VerificadorMem()
        self.alcance = AlcanceMem()
        self.storage, self.publicador = StorageMem(), PublicadorMem()
        self.proceso = abrir_proceso(
            self.procesos, self.publicador, proceso_id=crear_proceso(
                self.procesos, nombre='Fe de vida 2026-2027', fecha_apertura=APERTURA, fecha_cierre=CIERRE, actor='20000002',
            ).id, actor='20000002',
        )

    def solicitud_enviada(self, cedula=PASIVO):
        """Camino feliz del pasivo hasta PENDIENTE_REVISION."""
        from apps.fe_de_vida.application.use_cases import solicitudes_pasivo as sp

        s = sp.iniciar_solicitud(self.procesos, self.solicitudes, self.verificador, self.alcance, proceso_id=self.proceso.id, cedula=cedula, ahora=AHORA)
        sp.subir_evidencia(
            self.procesos, self.solicitudes, self.storage, solicitud_id=s.id, cedula=cedula,
            contenido=b'\xff\xd8\xffselfie', mime='image/jpeg', origen='CAMARA', metadatos=None, ahora=AHORA,
        )
        return sp.enviar_solicitud(self.procesos, self.solicitudes, self.publicador, solicitud_id=s.id, cedula=cedula, ahora=AHORA)
