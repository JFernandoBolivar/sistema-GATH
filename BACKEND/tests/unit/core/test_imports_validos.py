"""Guardián: todo `import` de `apps`/`core` apunta a algo que existe.

Incluye los imports diferidos dentro de funciones, que solo fallan al ejecutarse
(p. ej. «Guardar configuración» de punto de cuenta respondía 500 por importar
`guardar_parametro`, que ya no existía).
"""
import ast
import importlib
import pathlib

import pytest

RAIZ = pathlib.Path(__file__).resolve().parents[3]


def _imports_internos():
    for carpeta in ('apps', 'core'):
        for archivo in (RAIZ / carpeta).rglob('*.py'):
            relativo = archivo.relative_to(RAIZ)
            if 'migrations' in relativo.parts or 'tests' in relativo.parts:
                continue
            paquete = list(relativo.with_suffix('').parts[:-1])
            arbol = ast.parse(archivo.read_text(encoding='utf-8-sig'))
            for nodo in ast.walk(arbol):
                if isinstance(nodo, ast.ImportFrom):
                    modulo = nodo.module or ''
                    if nodo.level:
                        base = paquete[: len(paquete) - nodo.level + 1]
                        modulo = '.'.join(base + ([modulo] if modulo else []))
                    if modulo.split('.')[0] in ('apps', 'core'):
                        for alias in nodo.names:
                            yield f'{relativo}:{nodo.lineno}', modulo, alias.name
                elif isinstance(nodo, ast.Import):
                    for alias in nodo.names:
                        if alias.name.split('.')[0] in ('apps', 'core'):
                            yield f'{relativo}:{nodo.lineno}', alias.name, None


@pytest.mark.unidad
def test_todos_los_imports_internos_existen():
    rotos = []
    for donde, modulo, nombre in _imports_internos():
        try:
            mod = importlib.import_module(modulo)
        except Exception as error:  # noqa: BLE001 - se reporta el fallo
            rotos.append(f'{donde}: no se puede importar {modulo} ({type(error).__name__})')
            continue
        if nombre in (None, '*') or hasattr(mod, nombre):
            continue
        try:
            importlib.import_module(f'{modulo}.{nombre}')
        except Exception:  # noqa: BLE001
            rotos.append(f'{donde}: {modulo} no tiene {nombre}')
    assert not rotos, 'Imports rotos:\n' + '\n'.join(rotos)
