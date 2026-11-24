"""Datos que viajan por el puerto de promoción del postulante a trabajador (G-4). Sin Django."""
from dataclasses import dataclass, field
from datetime import date, datetime

# Motivos por los que NO se creó o reactivó una cuenta en la promoción (la cuenta es opcional).
CUENTA_SIN_CORREO = 'sin_correo'
CUENTA_SIN_CORREO_INSTITUCIONAL = 'sin_correo_institucional'   # solo tiene un correo personal (queda como alternativo)
CUENTA_YA_EXISTIA = 'ya_existia'
CUENTA_NO_APLICA = 'no_aplica'


@dataclass(frozen=True)
class SolicitudPromocion:
    """Todo lo que el expediente aporta para dar de alta al trabajador. La identidad del actor va por `usuario_id`."""

    expediente_id: str
    numero: str
    cedula: str
    nombres: str
    apellidos: str
    puesto_id: int
    datos_ventana1: dict
    datos_ventana2: dict
    correo: str = ''
    telefono_movil: str = ''
    foto_clave: str = ''
    usuario_id: int | None = None      # cuenta de quien asigna (queda en el movimiento INGRESO)
    ahora: datetime | None = None
    hoy: date | None = None


@dataclass(frozen=True)
class CuentaPromocion:
    """Qué pasó con la cuenta de acceso del trabajador. No lleva contraseñas: la inicial es su cédula (política vigente)."""

    creada: bool = False
    reactivada: bool = False
    motivo: str = ''                   # por qué no se creó (CUENTA_*), si no se creó
    correo: str = ''                   # el de acceso (institucional) del Employee
    correo_alternativo: str = ''       # el correo personal del postulante, si quedó guardado como alternativo
    dias_vigencia_clave_inicial: int | None = None


@dataclass(frozen=True)
class ResultadoPromocion:
    employee_id: int
    cedula: str
    es_reingreso: bool
    puesto_codigo: str = ''
    familiares_copiados: int = 0
    # F-8: lo que se sumó a la ficha además de los familiares (`estudios`, `cursos`, `antecedentes`, `idiomas`, `rif`).
    ficha_copiada: dict = field(default_factory=dict)
    cuenta: CuentaPromocion = field(default_factory=CuentaPromocion)
