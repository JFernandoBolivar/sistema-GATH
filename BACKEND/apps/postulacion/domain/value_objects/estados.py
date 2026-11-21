"""
Estados del Expediente de Postulación (FASE2_PROPUESTA_TECNICA §4.2). Sin Django.

El diagrama de §4.2 dibuja DIECISIETE estados distintos (la propuesta y el seguimiento dicen «16»):
PRE_REGISTRADO, EN_CAPTURA, ENVIADO_CAPTACION, EN_CORRECCION_DATOS, RECHAZADO_CAPTACION, EN_PRESUPUESTO,
EN_CORRECCION_CARGO, DIFERIDO_PRESUPUESTO, EN_DIRECCION_GENERAL, RECHAZADO_DIRECCION, APROBADO,
CONSOLIDANDO, EN_REVISION_FINAL, LISTO_PARA_ASIGNAR, CONTRATADO, EXPIRADO y DESISTIDO. Se implementan
todos los del diagrama: es la fuente más detallada y ninguno sobra.
"""
from enum import Enum


class EstadoExpediente(str, Enum):
    PRE_REGISTRADO = 'PRE_REGISTRADO'
    EN_CAPTURA = 'EN_CAPTURA'
    ENVIADO_CAPTACION = 'ENVIADO_CAPTACION'
    EN_CORRECCION_DATOS = 'EN_CORRECCION_DATOS'
    RECHAZADO_CAPTACION = 'RECHAZADO_CAPTACION'
    EN_PRESUPUESTO = 'EN_PRESUPUESTO'
    EN_CORRECCION_CARGO = 'EN_CORRECCION_CARGO'
    DIFERIDO_PRESUPUESTO = 'DIFERIDO_PRESUPUESTO'
    EN_DIRECCION_GENERAL = 'EN_DIRECCION_GENERAL'
    RECHAZADO_DIRECCION = 'RECHAZADO_DIRECCION'
    APROBADO = 'APROBADO'
    CONSOLIDANDO = 'CONSOLIDANDO'
    EN_REVISION_FINAL = 'EN_REVISION_FINAL'
    LISTO_PARA_ASIGNAR = 'LISTO_PARA_ASIGNAR'
    CONTRATADO = 'CONTRATADO'
    EXPIRADO = 'EXPIRADO'
    DESISTIDO = 'DESISTIDO'


# Un expediente terminal es inmutable: corregir exige uno nuevo (§4.2).
ESTADOS_TERMINALES: frozenset[EstadoExpediente] = frozenset({
    EstadoExpediente.CONTRATADO,
    EstadoExpediente.RECHAZADO_CAPTACION,
    EstadoExpediente.RECHAZADO_DIRECCION,
    EstadoExpediente.EXPIRADO,
    EstadoExpediente.DESISTIDO,
})

ESTADOS_ABIERTOS: frozenset[EstadoExpediente] = frozenset(EstadoExpediente) - ESTADOS_TERMINALES

# Valores de texto de los terminales, para el constraint del ORM (sin importar el enum allí).
VALORES_TERMINALES: tuple[str, ...] = tuple(sorted(e.value for e in ESTADOS_TERMINALES))

# Quién ejecuta una transición.
ACTOR_USUARIO = 'USUARIO'
ACTOR_POSTULANTE = 'POSTULANTE'
ACTOR_SISTEMA = 'SISTEMA'
