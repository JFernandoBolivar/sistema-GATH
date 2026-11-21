"""Helpers y parámetros compartidos del repositorio de carnetización."""
import logging
from typing import Any

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.carnetizacion.domain.services.resolver_color import (
    normalizar_clave,
    valor_segun_criterio,
)
from apps.carnetizacion.domain.services.vigencia_carnet import (
    TIPO_VIGENCIA_EXTERNO,
    TIPO_VIGENCIA_PASIVO,
    TIPO_VIGENCIA_TRABAJADOR,
    VIGENCIA_RESPALDO_MESES,
    calcular_vencimiento,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    PlantillaCarnetModel,
)
from core.domain.catalogos import (
    CONDICION_ACTIVO,
    CONDICION_PASIVO,
    CONDICION_SIN_ASIGNACION,
    TIPO_PERSONAL_PASIVO,
)
from core.domain.configuracion import (
    CLAVE_CARNETIZACION_SANGRADO_MM,
    CLAVE_CARNETIZACION_VENCIMIENTO_MESES,
    CLAVE_CARNETIZACION_VIGENCIA_EXTERNO_DIAS,
    CLAVE_CARNETIZACION_VIGENCIA_PASIVO_MESES,
    CLAVE_CARNETIZACION_VIGENCIA_TRABAJADOR_MESES,
)
from core.domain.exceptions import ValidationError
from core.infrastructure.providers import (
    obtener_lector_configuracion,
    obtener_resolutor_condicion,
)

logger = logging.getLogger('gath.carnetizacion')


_CLAVE_VIGENCIA_POR_TIPO = {
    TIPO_VIGENCIA_TRABAJADOR: CLAVE_CARNETIZACION_VIGENCIA_TRABAJADOR_MESES,
    TIPO_VIGENCIA_PASIVO: CLAVE_CARNETIZACION_VIGENCIA_PASIVO_MESES,
    TIPO_VIGENCIA_EXTERNO: CLAVE_CARNETIZACION_VIGENCIA_EXTERNO_DIAS,
}


def _entero_configurado(clave: str, defecto: int) -> int:
    lector = obtener_lector_configuracion()
    if lector is None:
        return defecto
    try:
        return int(lector.obtener_entero(clave))
    except Exception:
        logger.warning("No se pudo leer el parámetro %s; se usa %s.", clave, defecto, exc_info=True)
        return defecto


def sangrado_imprenta_mm() -> int:
    """Sangrado del PDF «formato imprenta», del parámetro del sistema (2 mm por defecto)."""
    return max(0, _entero_configurado(CLAVE_CARNETIZACION_SANGRADO_MM, 2))


def vencimiento_segun_parametros(emision: Any, tipo: str) -> Any:
    """Emisión + vigencia vigente del tipo (o el respaldo global si falta o vale 0)."""
    return calcular_vencimiento(
        emision,
        tipo=tipo,
        valor_tipo=_entero_configurado(_CLAVE_VIGENCIA_POR_TIPO[tipo], 0),
        respaldo_meses=_entero_configurado(
            CLAVE_CARNETIZACION_VENCIMIENTO_MESES, VIGENCIA_RESPALDO_MESES
        ),
    )


def condicion_titular(empleado: Any) -> str:
    """ACTIVO / PASIVO / SIN_ASIGNACION del titular, con el MISMO criterio que el resto del
    sistema (resolutor de `apps.identidad`). Antes el carnet tenía su propia regla y trataba
    como pasivo a cualquier egresado: alguien que egresó por abandono de cargo recibía el
    carnet de «jubilado / pensionado»."""
    cedula = str(getattr(empleado, 'cedulaidentidad', empleado) or '').strip()
    if not cedula:
        return CONDICION_SIN_ASIGNACION
    resolutor = obtener_resolutor_condicion()
    if resolutor is not None:
        return str(resolutor.condicion_de(cedula) or CONDICION_SIN_ASIGNACION)
    # Sin resolutor registrado (no debería ocurrir con `apps.identidad` instalada): solo la
    # asignación PASIVO cuenta como pasivo; nunca un egreso suelto.
    asignaciones = AsigTrabajoModel.objects.filter(employee_id=cedula)
    if asignaciones.filter(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO).exists():
        return CONDICION_PASIVO
    return CONDICION_ACTIVO if asignaciones.exists() else CONDICION_SIN_ASIGNACION


def _es_pasivo(empleado: Any) -> bool:
    return condicion_titular(empleado) == CONDICION_PASIVO


def tipo_credencial_para(condicion: str) -> str:
    """Tipo de credencial (catálogo de plantillas) que corresponde a la condición."""
    return 'pasivo' if condicion == CONDICION_PASIVO else 'trabajador'


def exigir_condicion_para_carnet(empleado: Any) -> str:
    """Condición del titular; rechaza a quien no tiene asignación vigente (egresado,
    abandono de cargo…): un carnet institucional no se emite a alguien que no pertenece al
    organismo."""
    condicion = condicion_titular(empleado)
    if condicion == CONDICION_SIN_ASIGNACION:
        raise ValidationError(
            'El titular no tiene una asignación vigente (activa o pasiva): no se puede emitir '
            'ni previsualizar su carnet.',
            campo='cedula',
        )
    return condicion


def plantilla_legacy() -> Any:
    """Plantilla v1 LEGACY sembrada: respaldo de los carnets anteriores al versionado.

    No se marca activa ni publicada a propósito: nunca se usa para emitir carnets nuevos;
    solo se resuelve cuando un carnet emitido no tiene snapshot ni plantilla recuperable.
    """
    return (
        PlantillaCarnetModel.objects.filter(estado='LEGACY')
        .order_by('version', 'created_at')
        .first()
    )


def definicion_plantilla_legacy() -> dict[str, Any] | None:
    """Definición de la maqueta heredada, o None si la siembra no está disponible."""
    plantilla = plantilla_legacy()
    definicion = plantilla.definicion if plantilla else None
    return definicion if isinstance(definicion, dict) and definicion else None


def asignacion_vigente(empleado: Any) -> Any:
    """Asignación más reciente del titular, con lo que usan el PDF y las reglas."""
    if empleado is None:
        return None
    return (
        AsigTrabajoModel.objects.select_related(
            'denominacioncargoid', 'DireccionGeneral', 'tiponominaid', 'Dependencia',
        )
        .filter(employee=empleado)
        .order_by('-fecha_actualizacion')
        .first()
    )


def nomina_y_nivel(asignacion: Any) -> tuple[str, str]:
    """Tipo de nómina (p. ej. CONTRATADO, OBRERO FIJO, JUBILADO) y nivel (dependencia) de la
    asignación. Antes el PDF no recibía la nómina y todos salían con el color de Funcionario."""
    nomina = asignacion.tiponominaid.nomina if asignacion and asignacion.tiponominaid_id else ''
    nivel = asignacion.Dependencia.dependencia if asignacion and asignacion.Dependencia_id else ''
    return str(nomina or ''), str(nivel or '')


def datos_para_reglas(asignacion: Any) -> dict[str, str]:
    """Datos del titular con los que se evalúan las reglas (de color y de plantilla)."""
    cargo, departamento = cargo_y_departamento(asignacion)
    nomina, nivel = nomina_y_nivel(asignacion)
    return {
        'nomina': nomina, 'cargo': cargo, 'oficina': departamento,
        'departamento': departamento, 'nivel': nivel,
    }


def _es_regla_generica(plantilla: Any) -> bool:
    return (plantilla.regla_criterio or 'todos') in ('todos', 'unico', '') or (plantilla.regla_valor or '*') == '*'


def plantilla_vigente(codigo_tipo: str, persona: dict[str, Any] | None = None) -> Any:
    """Plantilla con la que se emite: activa y publicada del tipo. Si alguna tiene una regla
    de uso que coincide con el titular (p. ej. nómina = CONTRATADO), gana esa; si no, la
    genérica (valor «*» o criterio «todos»); por último, la activa más reciente. Un borrador
    nunca se usa para emitir aunque esté marcado como activo."""
    activas = list(
        PlantillaCarnetModel.objects.filter(
            tipo_credencial_id=codigo_tipo, activa=True, estado='publicada',
        ).order_by('-created_at', '-version')
    )
    if persona:
        for plantilla in activas:
            if _es_regla_generica(plantilla):
                continue
            valor = valor_segun_criterio(plantilla.regla_criterio, persona)
            if valor and normalizar_clave(valor) == normalizar_clave(plantilla.regla_valor):
                return plantilla
    genericas = [p for p in activas if _es_regla_generica(p)]
    return (genericas or activas or [None])[0]


def plantilla_elegida_para_emitir(
    plantilla_id: str | None, codigo_tipo: str, persona: dict[str, Any] | None = None,
) -> Any:
    """La plantilla indicada (debe estar publicada) o, si no se indica, la vigente del tipo
    para ese titular (según las reglas de uso)."""
    if not plantilla_id:
        return plantilla_vigente(codigo_tipo, persona)
    plantilla = PlantillaCarnetModel.objects.filter(pk=plantilla_id).first()
    if plantilla is None:
        raise ValidationError('La plantilla indicada no existe.', campo='plantilla_id')
    if plantilla.estado != 'publicada':
        raise ValidationError(
            'Solo se emite con plantillas publicadas; publique el borrador antes de usarlo.',
            campo='plantilla_id',
        )
    return plantilla


def vencimiento_de_carnet(carnet: Any) -> Any:
    """Fecha guardada al emitir; en carnets anteriores (NULL) se calcula con el parámetro vigente."""
    if carnet.fecha_vencimiento:
        return carnet.fecha_vencimiento
    if not carnet.fecha_emision:
        return None
    tipo = TIPO_VIGENCIA_PASIVO if _es_pasivo(carnet.employee) else TIPO_VIGENCIA_TRABAJADOR
    return vencimiento_segun_parametros(carnet.fecha_emision, tipo)


def cargo_y_departamento(asignacion: Any) -> tuple[str, str]:
    """Cargo y oficina tal como los usa el PDF (`datos.cargo`/`datos.departamento`)."""
    cargo = (
        str(asignacion.denominacioncargoid)
        if asignacion and asignacion.denominacioncargoid else ''
    )
    departamento = (
        asignacion.DireccionGeneral.direccion_general
        if asignacion and asignacion.DireccionGeneral else ''
    )
    return cargo, departamento
