"""
Alta del postulante y apertura de su expediente (D-1). Sin Django.

Reingreso (C-1): si la cédula ya pertenece a un `Employee` (egresado que vuelve) o a un postulante previo, NO se
duplica la persona: se reutiliza el postulante (o se crea uno enlazado al empleado por cédula) y se abre un
expediente NUEVO. Un postulante no puede tener dos expedientes abiertos a la vez.

Notificaciones: la emisión de `CREDENCIAL_GENERADA` y demás avisos de §5.6 pertenece a D-9; no se emiten aquí.
"""
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, leer_vigencias
from apps.postulacion.application.use_cases._comun import texto_normalizado as _texto
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante, TransicionRegistrada
from apps.postulacion.domain.ports.repos import BuscadorEmpleados, RepoPostulacion
from apps.postulacion.domain.services.efectos import vencimiento_ventana1
from apps.postulacion.domain.value_objects.estados import ACTOR_USUARIO, EstadoExpediente
from core.domain.catalogos import CONDICION_ACTIVO
from core.domain.exceptions import ConflictError, ValidationError
from core.domain.ports import LectorConfiguracion
from core.domain.validacion_personas import validar_cedula


def crear_postulante_con_expediente(
    repo: RepoPostulacion, empleados: BuscadorEmpleados, config: LectorConfiguracion, *,
    cedula: str, nombres: str, apellidos: str, creado_por: str, correo: str = '', telefono_movil: str = '',
    ahora: datetime | None = None,
) -> tuple[Postulante, ExpedientePostulacion, bool]:
    """Devuelve `(postulante, expediente, es_reingreso)`. El expediente nace PRE_REGISTRADO con la Ventana 1."""
    try:
        cedula = validar_cedula(cedula)
    except ValueError as e:
        raise ValidationError(str(e), campo='cedula') from e
    if not cedula:
        raise ValidationError("La cédula es obligatoria.", campo='cedula')
    nombres = _texto(nombres, "Los nombres", maximo=150)
    apellidos = _texto(apellidos, "Los apellidos", maximo=150)
    correo = _texto(correo, "El correo", maximo=254, obligatorio=False)
    telefono_movil = _texto(telefono_movil, "El teléfono", maximo=20, obligatorio=False)
    ahora = ahora or ahora_utc()
    vigencias = leer_vigencias(config)

    with repo.transaccion():
        empleado = empleados.por_cedula(cedula)
        # C-1 aplica a quien ya no trabaja en el organismo (egresado o pasivo). Un trabajador con
        # asignación vigente no puede postularse: sería un movimiento de personal, no un ingreso.
        if empleado and empleado.condicion == CONDICION_ACTIVO:
            raise ConflictError(
                'La cédula pertenece a un trabajador activo de CONATEL: no puede postularse mientras '
                'tenga una asignación vigente.'
            )
        postulante = repo.obtener_postulante_por_cedula(cedula, bloquear=True)
        if postulante is None:
            postulante = repo.crear_postulante(Postulante(
                id='', cedula=cedula, nombres=nombres, apellidos=apellidos, correo=correo,
                telefono_movil=telefono_movil, employee_cedula=empleado.cedula if empleado else '',
                creado_por=creado_por,
            ))
        elif empleado and not postulante.employee_cedula:
            postulante = repo.vincular_empleado(postulante.id, empleado.cedula)
        if repo.tiene_expediente_abierto(postulante.id):
            raise ConflictError("El postulante ya tiene un expediente abierto.", campo='cedula')
        expediente = repo.crear_expediente(ExpedientePostulacion(
            id='', numero='', postulante_id=postulante.id, estado=EstadoExpediente.PRE_REGISTRADO,
            creado_por=creado_por, ventana=1, ventana_vence_el=vencimiento_ventana1(ahora, vigencias),
            fecha_apertura=ahora,
        ))
        repo.registrar_transicion(TransicionRegistrada(
            id='', expediente_id=expediente.id, estado_origen='', estado_destino=expediente.estado.value,
            actor_cedula=creado_por, actor_tipo=ACTOR_USUARIO, fecha=ahora,
            motivo='Alta del postulante', datos_extra={'reingreso': bool(postulante.employee_cedula)},
        ))
    return postulante, expediente, bool(postulante.employee_cedula)
