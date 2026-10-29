"""Dobles en memoria de los puertos de notificaciones (sin BD, sin Celery, sin SMTP)."""
from dataclasses import replace
from uuid import uuid4

from apps.notificaciones.domain.value_objects.estado_outbox import EstadoOutbox


class RepoNotifMem:
    def __init__(self):
        self.filas = []
        self.consultas = 0

    def crear_muchas(self, notificaciones):
        previas = {(n.destinatario_cedula, n.clave_unica) for n in self.filas if n.clave_unica}
        nuevas = [
            replace(n, id=str(uuid4())) for n in notificaciones
            if not n.clave_unica or (n.destinatario_cedula, n.clave_unica) not in previas
        ]
        self.filas += nuevas
        return len(nuevas)

    def listar(self, cedula, solo_no_leidas, limite, desplazamiento):
        propias = [n for n in self.filas if n.destinatario_cedula == cedula and not (solo_no_leidas and n.leida)]
        return propias[desplazamiento:desplazamiento + limite], len(propias)

    def contar_no_leidas(self, cedula):
        self.consultas += 1
        return sum(1 for n in self.filas if n.destinatario_cedula == cedula and not n.leida)

    def marcar_leida(self, cedula, notificacion_id, ahora):
        for i, n in enumerate(self.filas):
            if n.id == notificacion_id and n.destinatario_cedula == cedula:
                self.filas[i] = replace(n, leida=True, fecha_lectura=ahora)
                return True
        return False

    def marcar_todas_leidas(self, cedula, ahora):
        marcadas = 0
        for i, n in enumerate(self.filas):
            if n.destinatario_cedula == cedula and not n.leida:
                self.filas[i] = replace(n, leida=True, fecha_lectura=ahora)
                marcadas += 1
        return marcadas


class RepoOutboxMem:
    def __init__(self):
        self.filas = {}

    def agregar(self, mensaje):
        if any(m.idempotency_key == mensaje.idempotency_key for m in self.filas.values()):
            return None
        self.filas[mensaje.id] = mensaje
        return mensaje

    def obtener_bloqueado(self, outbox_id):
        return self.filas.get(outbox_id)

    def marcar_enviado(self, outbox_id, ahora):
        self.filas[outbox_id] = replace(self.filas[outbox_id], estado=EstadoOutbox.ENVIADO, enviado_en=ahora)

    def registrar_fallo(self, outbox_id, intentos, estado, proximo_intento, error):
        self.filas[outbox_id] = replace(
            self.filas[outbox_id], intentos=intentos, estado=estado, proximo_intento=proximo_intento, ultimo_error=error,
        )

    def ids_pendientes_vencidos(self, ahora, limite):
        return [
            i for i, m in self.filas.items()
            if m.estado is EstadoOutbox.PENDIENTE and (m.proximo_intento is None or m.proximo_intento <= ahora)
        ][:limite]


class ResolutorMem:
    def __init__(self, por_permiso=None, correos=None):
        self.por_permiso, self.correos = por_permiso or {}, correos or {}

    def cedulas_con_permiso(self, codigo):
        return list(self.por_permiso.get(codigo, []))

    def correo_de(self, cedula):
        return self.correos.get(cedula, '')


class CacheMem:
    def __init__(self):
        self.datos = {}

    def obtener(self, cedula):
        return self.datos.get(cedula)

    def guardar(self, cedula, total):
        self.datos[cedula] = total

    def invalidar(self, cedula):
        self.datos.pop(cedula, None)


class PlanificadorMem:
    def __init__(self):
        self.programados = []

    def programar(self, outbox_id):
        self.programados.append(outbox_id)


class EnviadorMem:
    def __init__(self, fallos=0):
        self.fallos, self.enviados = fallos, []

    def enviar(self, **kwargs):
        if self.fallos > 0:
            self.fallos -= 1
            raise ConnectionError('relay no disponible')
        self.enviados.append(kwargs)


class AlmacenMem:
    def __init__(self, objetos=None):
        self.objetos = objetos or {}

    def descargar(self, clave):
        return self.objetos[clave]
