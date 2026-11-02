"""
Caso de uso canónico de gestión de contratos de personal activo (R-09,
inventario de reubicación §I.2.2).

Puerto de repositorio inyectado (D-09, B21): este caso de uso NO importa
Django ni el ORM directamente — solo depende de `RepoContratos` (Protocol).
La decisión de negocio (número de contrato, estatus) viene de
`apps.personal.shared.domain.services.contrato_rules`, el mismo módulo
puro que usa `RAC/services/profile_services.py::upsert_contrato` (el punto
de entrada legado). Ver la cabecera de `profile_services.py` para la
explicación completa de por qué ambos NO pueden compartir la misma función
de I/O (modelos ORM distintos por `AUTH_USER_MODEL`/`INSTALLED_APPS`).
"""
from datetime import date
from typing import Protocol

from apps.personal.shared.domain.services.contrato_rules import (
    decidir_estatus_contrato,
    es_tercer_contrato,
    generar_numero_contrato,
)
from core.domain.exceptions import ValidationError


class RepoContratos(Protocol):
    def contar_contratos_de_empleado(self, cedula: str) -> int: ...

    def buscar_contrato_por_numero(self, cedula: str, n_contrato: str) -> dict | None: ...

    def obtener_organismo_conatel(self):
        """Devuelve el id/instancia del organismo adscrito 'CONATEL'."""
        ...

    def guardar_contrato(self, cedula: str, datos: dict) -> dict:
        """
        Crea o actualiza el antecedente de servicio + contrato del
        empleado con `datos` (n_contrato, fecha_ingreso, fecha_culminacion,
        politica_id, estatus_id, es_fijo, antecedente) y devuelve el
        contrato resultante como dict.
        """
        ...


def upsert_contrato(repo: RepoContratos, cedula: str, contrato_data: list[dict] | dict | None) -> dict | None:
    """
    Crea o actualiza contratos para un empleado. Réplica funcional exacta
    de `RAC/services/profile_services.py::upsert_contrato` sobre el puerto
    de repositorio de `apps.personal` (D-09).

    Regla FIJO: al registrar el 3er contrato, se marca automáticamente
    como `es_fijo=True` y `fecha_culminacion=None`.
    """
    if not contrato_data:
        return None

    if isinstance(contrato_data, dict):
        contrato_data = [contrato_data]

    organismo_conatel = repo.obtener_organismo_conatel()
    if organismo_conatel is None:
        raise ValidationError(
            "El organismo 'CONATEL' no está registrado en el sistema. "
            "Regístrelo antes de gestionar contratos."
        )

    resultado = None
    for item in contrato_data:
        n_contrato_externo = item.get('n_contrato')
        fecha_ingreso = item.get('fecha_ingreso')
        politica_id = item.get('politica_id')
        fecha_culminacion = item.get('fecha_culminacion')

        if not fecha_ingreso or not politica_id:
            continue

        cantidad_actual = repo.contar_contratos_de_empleado(cedula)

        existente = None
        if n_contrato_externo:
            existente = repo.buscar_contrato_por_numero(cedula, n_contrato_externo)

        tercer_contrato = es_tercer_contrato(cantidad_actual, existe_previo=bool(existente))
        if tercer_contrato:
            fecha_culminacion = None

        es_fijo = existente['es_fijo'] if existente else tercer_contrato
        if existente and existente['es_fijo']:
            fecha_culminacion = None

        if existente:
            n_contrato = existente['n_contrato']
        elif n_contrato_externo:
            n_contrato = n_contrato_externo
        else:
            # Bug de regresión corregido (Fase 2.2, `PLAN_REPARACION_GATH.md`):
            # ningún llamador poblaba `politica_nombre`, así que la inicial
            # del número de contrato siempre caía al default `'C'` sin
            # importar la política real. `politica_id` ya llega resuelto a
            # una instancia de `PoliticaModel` (tanto desde
            # `ContratoEscrituraSerializer` como desde
            # `carga_masiva_expediente.py`), así que se deriva el nombre de
            # ahí en vez de depender de una clave extra que nadie enviaba.
            politica_nombre = item.get('politica_nombre') or getattr(politica_id, 'tipo_politica', '')
            n_contrato = generar_numero_contrato(
                inicial_politica=politica_nombre,
                cedula=cedula,
                correlativo=cantidad_actual + 1,
            )

        clave_estatus = decidir_estatus_contrato(
            es_fijo=es_fijo,
            fecha_culminacion=fecha_culminacion,
            hoy=item.get('hoy') or date.today(),
        )

        resultado = repo.guardar_contrato(cedula, {
            'n_contrato': n_contrato,
            'fecha_ingreso': fecha_ingreso,
            'fecha_culminacion': fecha_culminacion,
            'politica_id': politica_id,
            'es_fijo': es_fijo,
            'clave_estatus': clave_estatus,
            'organismo_conatel': organismo_conatel,
            'existente': existente,
        })

    return resultado
