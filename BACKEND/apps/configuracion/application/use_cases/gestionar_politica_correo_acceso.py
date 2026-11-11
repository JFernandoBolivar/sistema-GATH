"""
Casos de uso para la administración de la Política de Correo de Acceso y Aplicación Masiva (A7).
"""
from __future__ import annotations

from typing import Callable, Sequence

from apps.configuracion.domain.correo_acceso import (
    GrupoTrabajadores,
    PoliticaCorreoAcceso,
    ResumenVistaPrevia,
    generar_vista_previa_masiva,
    resolver_correo_para_trabajador,
)
from apps.configuracion.domain.ports.repo_politica_correo_acceso import (
    RepoPoliticaCorreoAcceso,
)
from core.domain.exceptions import ValidationError


def obtener_politica_correo_acceso(
    repo: RepoPoliticaCorreoAcceso,
) -> PoliticaCorreoAcceso:
    return repo.obtener_politica()


def actualizar_politica_correo_acceso(
    repo: RepoPoliticaCorreoAcceso,
    datos: dict,
    actor_id: int | None = None,
) -> tuple[PoliticaCorreoAcceso, PoliticaCorreoAcceso]:
    # O39: el alternativo no es login de un pasivo.
    if datos.get('politica_pasivos') == 'alternativo':
        raise ValidationError(
            'El correo de acceso de los pasivos no puede ser el alternativo: use el correo principal.',
            campo='politica_pasivos',
        )
    return repo.actualizar_politica(datos, actor_id=actor_id)


def obtener_vista_previa_masiva(
    repo: RepoPoliticaCorreoAcceso,
    grupo: str,
    incluir_excepciones: bool = False,
) -> ResumenVistaPrevia:
    politica = repo.obtener_politica()
    trabajadores = repo.listar_trabajadores_por_grupo(grupo)
    return generar_vista_previa_masiva(
        trabajadores, politica, incluir_excepciones=incluir_excepciones
    )


def aplicar_politica_masiva(
    repo: RepoPoliticaCorreoAcceso,
    grupo: str,
    motivo: str,
    incluir_excepciones: bool = False,
    auditar_cuenta: Callable[[str, str, str | None, str], None] | None = None,
    notificar_cuenta: Callable[[str, str, str], None] | None = None,
) -> dict:
    """
    Aplica la política de correo de acceso a todos los trabajadores del grupo.
    - Valida motivo obligatorio.
    - Respeta excepciones salvo que se marque incluir_excepciones.
    - Audita cada cambio por cuenta.
    """
    motivo_limpio = (motivo or '').strip()
    if len(motivo_limpio) < 5:
        raise ValidationError(
            'El motivo de la aplicación masiva es obligatorio y debe tener al menos 5 caracteres.',
            campo='motivo',
        )

    politica = repo.obtener_politica()
    trabajadores = repo.listar_trabajadores_por_grupo(grupo)
    vista_previa = generar_vista_previa_masiva(
        trabajadores, politica, incluir_excepciones=incluir_excepciones
    )

    actualizados = 0
    sin_cambio = 0
    sin_cuenta = 0
    conflictos = 0

    for item in vista_previa.items:
        if item.es_excepcion_manual and not incluir_excepciones:
            continue

        if item.quedara_sin_cuenta:
            sin_cuenta += 1
            if item.cambiara:
                # Se limpia el correo si antes tenía uno inválido/no elegible
                repo.aplicar_correo_a_empleado(item.cedula, '')
                actualizados += 1
                if auditar_cuenta:
                    auditar_cuenta(item.cedula, item.correo_actual, None, motivo_limpio)
        elif item.cambiara and item.correo_propuesto:
            # `Employee.correo` es unique: si otro trabajador ya usa ese correo se
            # reporta el conflicto y se continúa con el resto (no se rompe el lote).
            if repo.correo_en_uso_por_otro(item.cedula, item.correo_propuesto):
                conflictos += 1
                continue
            repo.aplicar_correo_a_empleado(item.cedula, item.correo_propuesto)
            actualizados += 1
            if auditar_cuenta:
                auditar_cuenta(item.cedula, item.correo_actual, item.correo_propuesto, motivo_limpio)
            if notificar_cuenta and politica.avisar_al_aplicar_masivo:
                notificar_cuenta(item.cedula, item.correo_propuesto, motivo_limpio)
        else:
            sin_cambio += 1

    return {
        'actualizados': actualizados,
        'sin_cambio': sin_cambio,
        'sin_cuenta': sin_cuenta,
        'conflictos': conflictos,
        'total': len(vista_previa.items),
    }
