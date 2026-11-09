"""Detección de correos repetidos entre el institucional (`Employee.correo`) y el alternativo.

Lógica pura (sin framework): la reutilizan los comandos de RRHH `listar_correos_duplicados` y
`sincronizar_cuentas_trabajadores --duplicados`.
"""
from dataclasses import dataclass

CedulasPorCorreo = dict[str, set[str]]


@dataclass(frozen=True)
class ColisionCorreo:
    correo: str
    cedulas_institucional: frozenset[str]
    cedulas_alternativo: frozenset[str]

    @property
    def cedulas(self) -> frozenset[str]:
        return self.cedulas_institucional | self.cedulas_alternativo


def agrupar_por_correo(pares: list[tuple[object, object]]) -> CedulasPorCorreo:
    """Agrupa pares (cédula, correo) por correo normalizado (minúsculas, sin espacios)."""
    agrupado: CedulasPorCorreo = {}
    for cedula, correo in pares:
        limpio = str(correo or '').strip().lower()
        if limpio:
            agrupado.setdefault(limpio, set()).add(str(cedula))
    return agrupado


def detectar_colisiones(
    inst_por_correo: CedulasPorCorreo, alt_por_correo: CedulasPorCorreo,
) -> list[ColisionCorreo]:
    """Correos usados por más de un trabajador, o a la vez como institucional y alternativo."""
    colisiones: list[ColisionCorreo] = []
    for correo in sorted(set(inst_por_correo) | set(alt_por_correo)):
        inst = frozenset(inst_por_correo.get(correo, set()))
        alt = frozenset(alt_por_correo.get(correo, set()))
        if len(inst | alt) > 1 or (inst & alt):
            colisiones.append(ColisionCorreo(correo, inst, alt))
    return colisiones


def cedulas_en_conflicto(
    correo: str, cedula: str, inst_por_correo: CedulasPorCorreo, alt_por_correo: CedulasPorCorreo,
) -> set[str]:
    """Otras cédulas que ya usan `correo` (como institucional o alternativo), distintas de `cedula`."""
    clave = correo.strip().lower()
    return (inst_por_correo.get(clave, set()) | alt_por_correo.get(clave, set())) - {str(cedula)}
