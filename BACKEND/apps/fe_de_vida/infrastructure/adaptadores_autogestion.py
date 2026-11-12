"""
Adaptadores de fe de vida sobre los mecanismos de autogestión (B1 `CambioPropuesto`, B3 `aplicar_cambios_aprobados`).

La capa `infrastructure` es la única autorizada a tocar otro módulo (B16): aquí se reutilizan, sin
duplicar tablas, el modelo de cambios propuestos (`origen_tipo = FE_DE_VIDA`), la lista blanca de campos,
el lector de la ficha y el aplicador transaccional de cambios aprobados.
"""
from datetime import datetime

from apps.autogestion.application.use_cases.decision_bienestar import aplicar_cambios_aprobados
from apps.autogestion.domain.entities.solicitud_actualizacion import CambioPropuesto
from apps.autogestion.domain.services.validacion_cambios import (
    validar_estructura,
    validar_registro_nuevo,
    validar_valor,
    validar_vivienda_condicional,
)
from apps.autogestion.domain.value_objects.secciones import (
    CAMPO_REGISTRO_NUEVO,
    CAMPOS_POR_SECCION,
    CAMPOS_PROHIBIDOS,
    ENTIDADES_UNICAS,
    Accion,
    DecisionCambio,
)
from apps.autogestion.infrastructure.repositories.aplicador_cambios_orm import AplicadorCambiosORM
from apps.autogestion.infrastructure.repositories.lector_ficha_orm import LectorFichaORM
from apps.autogestion.infrastructure.repositories.repo_cambios_soportes_orm import RepoCambiosPropuestosORM
from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.value_objects.estados import ORIGEN_FE_DE_VIDA
from apps.fe_de_vida.domain.value_objects.lista_blanca import CAMPOS_ADICIONALES_ACTA
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError


# Secciones de autogestión que la fe de vida no hereda: identidad (solo nombres/apellidos/fecha, vía CAMPOS_ADICIONALES_ACTA) y salud.
SECCIONES_SOLO_AUTOGESTION = frozenset({'identidad', 'salud'})


def _unir_listas() -> dict[str, dict[str, frozenset[str]]]:
    """Lista blanca del acta = la de autogestión + los campos adicionales de fe de vida (sin modificar la original)."""
    unida = {sec: dict(ents) for sec, ents in CAMPOS_POR_SECCION.items() if sec not in SECCIONES_SOLO_AUTOGESTION}
    for seccion, entidades in CAMPOS_ADICIONALES_ACTA.items():
        destino = unida.setdefault(seccion, {})
        for entidad, campos in entidades.items():
            destino[entidad] = destino.get(entidad, frozenset()) | campos
    return unida


CAMPOS_ACTA = _unir_listas()

# Campos del familiar que dependen entre sí para validar el estado final (FIX-FAM2).
CAMPOS_FAMILIAR_VALIDADOS = frozenset({
    'parentesco_id', 'fecha_nacimiento', 'sexo_id', 'cedula_familiar',
})


def _validar_estructura_acta(seccion: str, entidad: str, accion: Accion, campo: str, entidad_id) -> None:
    """Estructura contra la lista blanca de fe de vida. El CREAR sigue las reglas de autogestión (no crea identidad)."""
    if accion is Accion.CREAR:
        validar_estructura(seccion, entidad, accion, campo, entidad_id)
        return
    if campo not in CAMPOS_ACTA.get(seccion, {}).get(entidad, frozenset()):
        if str(campo).lower() in CAMPOS_PROHIBIDOS:
            raise ValidationError(f"El campo '{campo}' no es modificable en la fe de vida.")
        raise ValidationError(f"El campo '{campo}' de '{entidad}' no es modificable en la sección '{seccion}'.")
    if entidad in ENTIDADES_UNICAS and entidad_id is not None:
        raise ValidationError(f"'{entidad}' es un registro único: no lleva identificador.")
    if entidad not in ENTIDADES_UNICAS and entidad_id is None:
        raise ValidationError(f"Debe indicar el identificador del registro de '{entidad}' a modificar.")


def _a_cambio_propuesto(solicitud_id: str, c: CambioActa) -> CambioPropuesto:
    return CambioPropuesto(
        id='', origen_tipo=ORIGEN_FE_DE_VIDA, origen_id=solicitud_id, seccion=c.seccion, accion=c.accion,
        entidad_destino=c.entidad_destino, entidad_id=c.entidad_id, campo=c.campo,
        valor_anterior=c.valor_anterior, valor_propuesto=c.valor_propuesto,
    )


def _a_cambio_acta(c: CambioPropuesto) -> CambioActa:
    return CambioActa(
        id=c.id, seccion=c.seccion, accion=c.accion, entidad_destino=c.entidad_destino, campo=c.campo,
        valor_propuesto=c.valor_propuesto, entidad_id=c.entidad_id, valor_anterior=c.valor_anterior,
    )


class RepoCambiosActaORM:
    """Persiste las respuestas del acta como `CambioPropuesto` con origen FE_DE_VIDA."""

    def __init__(self):
        self._repo = RepoCambiosPropuestosORM()

    def reemplazar(self, solicitud_id: str, cambios: list[CambioActa]) -> None:
        self._repo.reemplazar(ORIGEN_FE_DE_VIDA, solicitud_id, [_a_cambio_propuesto(solicitud_id, c) for c in cambios])

    def listar(self, solicitud_id: str) -> list[CambioActa]:
        return [_a_cambio_acta(c) for c in self._repo.listar(ORIGEN_FE_DE_VIDA, solicitud_id)]


class ValidadorCambiosActaORM:
    """Lista blanca propia del acta (la de autogestión más nombres, apellidos y fecha de nacimiento) y la misma validación de valores."""

    def __init__(self):
        self._lector = LectorFichaORM()

    def validar(self, cedula: str, cambio: CambioActa) -> CambioActa | None:
        try:
            accion = Accion(cambio.accion)
        except ValueError:
            raise ValidationError(f"Acción inválida: '{cambio.accion}'.") from None
        entidad_id = str(cambio.entidad_id) if cambio.entidad_id not in (None, '') else None
        _validar_estructura_acta(cambio.seccion, cambio.entidad_destino, accion, cambio.campo, entidad_id)
        if accion is Accion.CREAR:
            pais_id = None
            if cambio.entidad_destino == 'datos_vivienda' and isinstance(cambio.valor_propuesto, dict):
                pais_id = cambio.valor_propuesto.get('pais_id')
            es_venezuela = getattr(self._lector, 'es_pais_venezuela', lambda _pais: True)(pais_id)
            valor = validar_registro_nuevo(
                cambio.seccion, cambio.entidad_destino, cambio.valor_propuesto, es_venezuela=es_venezuela
            )
            self._lector.validar_referencias(valor)
            if cambio.entidad_destino == 'familiar':
                self._lector.validar_familiar_alta(cedula, valor)
            return CambioActa(cambio.seccion, accion.value, cambio.entidad_destino, CAMPO_REGISTRO_NUEVO, valor)
        if entidad_id is not None and not self._lector.pertenece_al_trabajador(cedula, cambio.entidad_destino, entidad_id):
            raise NotFoundError(f"El registro {entidad_id} de '{cambio.entidad_destino}' no pertenece al trabajador.")
        valor = validar_valor(cambio.campo, cambio.valor_propuesto)
        if cambio.entidad_destino == 'familiar' and cambio.campo == 'cedula_familiar' and not valor:
            raise ValidationError('La cédula del familiar es obligatoria.', campo='cedula_familiar')
        if cambio.entidad_destino == 'employee' and cambio.campo == 'telefono_movil' and not valor:
            raise ValidationError('El teléfono celular es obligatorio.', campo='telefono_movil')
        if cambio.campo == 'correo_alternativo' and valor:
            self._lector.validar_correo_alternativo(cedula, valor)
        self._lector.validar_referencias({cambio.campo: valor})
        anterior = self._lector.valor_actual(cedula, cambio.entidad_destino, entidad_id, cambio.campo)
        if valor == anterior:
            return None
        return CambioActa(
            cambio.seccion, accion.value, cambio.entidad_destino, cambio.campo, valor,
            entidad_id=entidad_id, valor_anterior=anterior,
        )

    def validar_conjunto(self, cedula: str, cambios: list[CambioActa]) -> None:
        """Valida el estado final de cada familiar con TODOS sus cambios juntos.

        Un familiar puede cambiar parentesco, fecha de nacimiento y sexo en la misma
        acta; validar cada campo aislado contra el dato guardado rechaza casos
        válidos (una madre con la fecha corregida en el mismo guardado).
        """
        grupos: dict[str, dict] = {}
        for cambio in cambios:
            if (
                cambio.accion != Accion.MODIFICAR.value
                or cambio.entidad_destino != 'familiar'
                or cambio.entidad_id in (None, '')
                or cambio.campo not in CAMPOS_FAMILIAR_VALIDADOS
            ):
                continue
            grupos.setdefault(str(cambio.entidad_id), {})[cambio.campo] = cambio.valor_propuesto
        for entidad_id, valores in grupos.items():
            self._lector.validar_familiar_cambio(cedula, entidad_id, valores)
        self._validar_familiares_nuevos(cedula, cambios)
        self._validar_vivienda(cedula, cambios)

    def _validar_familiares_nuevos(self, cedula: str, cambios: list[CambioActa]) -> None:
        """L2-13: duplicados y parentescos no permitidos entre las altas del borrador."""
        validador = getattr(self._lector, 'validar_familiares_nuevos', None)
        if not callable(validador):
            return
        altas = [
            c.valor_propuesto for c in cambios
            if c.entidad_destino == 'familiar' and c.accion == Accion.CREAR.value
            and isinstance(c.valor_propuesto, dict)
        ]
        if altas:
            validador(cedula, altas)

    def _validar_vivienda(self, cedula: str, cambios: list[CambioActa]) -> None:
        """L2-16: coherencia del estado FINAL de la vivienda al modificarla o crearla."""
        de_vivienda = [c for c in cambios if c.entidad_destino == 'datos_vivienda']
        if not de_vivienda:
            return
        leer = getattr(self._lector, 'valores_vivienda', None)
        valores = dict(leer(cedula)) if callable(leer) else {}
        for cambio in de_vivienda:
            if cambio.accion == Accion.CREAR.value and isinstance(cambio.valor_propuesto, dict):
                valores.update(cambio.valor_propuesto)
            elif cambio.accion == Accion.MODIFICAR.value:
                valores[cambio.campo] = cambio.valor_propuesto
        limpios = {k: v for k, v in valores.items() if v not in (None, '')}
        es_venezuela = self._lector.es_pais_venezuela(limpios.get('pais_id'))
        validar_vivienda_condicional(limpios, es_venezuela)
        cadena = getattr(self._lector, 'validar_cadena_geografica', None)
        if callable(cadena):
            cadena(
                limpios.get('estado_id'), limpios.get('municipio_id'), limpios.get('parroquia_id'),
            )


class AplicadorCambiosActaORM:
    """
    C19: al VALIDARSE el acta, la doble aprobación (o la directa) cubre TODAS las respuestas: se marcan
    APROBADAS y se escriben en los datos reales con `aplicar_cambios_aprobados` (toma el lock del
    trabajador). Debe invocarse dentro de la transacción de la decisión (todo o nada).
    """

    def aplicar(self, solicitud_id: str, cedula: str, actor_cedula: str, ahora: datetime) -> int:
        repo = RepoCambiosPropuestosORM()
        pendientes = [c for c in repo.listar(ORIGEN_FE_DE_VIDA, solicitud_id) if c.decision is DecisionCambio.PENDIENTE]
        # L2-04: no pisar correcciones de RR. HH. hechas después de proponer el acta.
        # Se compara cada MODIFICAR con el valor real de hoy, igual que autogestión.
        self._exigir_sin_conflictos(cedula, pendientes)
        repo.guardar_decisiones([c.con_decision(DecisionCambio.APROBADO, '', actor_cedula, ahora) for c in pendientes])
        return aplicar_cambios_aprobados(
            AplicadorCambiosORM(), cedula=cedula, cambios=repo.listar(ORIGEN_FE_DE_VIDA, solicitud_id),
            soportes=[], actor=actor_cedula,
        )

    def _exigir_sin_conflictos(self, cedula: str, cambios) -> None:
        from apps.autogestion.domain.services.validacion_cambios import mismo_valor

        lector = LectorFichaORM()
        for cambio in cambios:
            if cambio.accion != Accion.MODIFICAR.value:
                continue
            actual = lector.valor_actual(cedula, cambio.entidad_destino, cambio.entidad_id, cambio.campo)
            sin_conflicto = (
                mismo_valor(cambio.campo, actual, cambio.valor_anterior)
                or mismo_valor(cambio.campo, cambio.valor_anterior, actual)
            )
            if not sin_conflicto:
                raise ConflictError(
                    f"El dato '{cambio.campo}' cambió en la ficha después de la propuesta: "
                    'devuelva la solicitud o pida al pasivo una nueva.'
                )


class LectorValorActualORM:
    """Valor real de hoy de cada dato propuesto, para el comparativo de Bienestar."""

    def __init__(self):
        self._lector = LectorFichaORM()

    def valor_actual(self, cedula: str, cambio: CambioActa) -> object:
        if cambio.accion != Accion.MODIFICAR.value:
            return None
        return self._lector.valor_actual(cedula, cambio.entidad_destino, cambio.entidad_id, cambio.campo)
