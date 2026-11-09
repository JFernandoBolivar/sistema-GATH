"""FIX-QA10: ninguna vista puede exigir un permiso que no exista en el seed.

Recorre el código de `apps/` con AST, resuelve las constantes de módulo y
compara los códigos pasados a `HasPermission`/`HasAnyPermission` con
`PERMISOS_CATALOGO`. Así un `configuracion.ver` sin catalogar vuelve a fallar
en CI en vez de aparecer como «Acceso denegado» en producción.
"""
import ast
from pathlib import Path

from apps.identidad.management.commands.seed_permisos import PERMISOS_CATALOGO

RAIZ_APPS = Path(__file__).resolve().parents[3] / 'apps'
FABRICAS = frozenset({'HasPermission', 'HasAnyPermission'})


def _constantes_de_texto(arbol: ast.Module) -> dict[str, str]:
    """Asignaciones de módulo `NOMBRE = 'texto'` (las que usan las vistas)."""
    constantes: dict[str, str] = {}
    for nodo in arbol.body:
        if not isinstance(nodo, ast.Assign):
            continue
        if not (isinstance(nodo.value, ast.Constant) and isinstance(nodo.value.value, str)):
            continue
        for destino in nodo.targets:
            if isinstance(destino, ast.Name):
                constantes[destino.id] = nodo.value.value
    return constantes


def _codigos_usados() -> set[str]:
    usados: set[str] = set()
    for archivo in RAIZ_APPS.rglob('*.py'):
        arbol = ast.parse(archivo.read_text(encoding='utf-8-sig'))
        constantes = _constantes_de_texto(arbol)
        for nodo in ast.walk(arbol):
            if not isinstance(nodo, ast.Call):
                continue
            funcion = nodo.func
            nombre = funcion.id if isinstance(funcion, ast.Name) else getattr(funcion, 'attr', None)
            if nombre not in FABRICAS:
                continue
            for argumento in nodo.args:
                if isinstance(argumento, ast.Constant) and isinstance(argumento.value, str):
                    codigo = argumento.value
                elif isinstance(argumento, ast.Name):
                    codigo = constantes.get(argumento.id)
                else:
                    codigo = None
                if codigo and '.' in codigo:
                    usados.add(codigo)
    return usados


def test_toda_vista_usa_un_permiso_del_catalogo():
    catalogo = {codigo for codigo, _ in PERMISOS_CATALOGO}
    usados = _codigos_usados()
    assert len(usados) > 20, f'El escaneo no encontró permisos: {sorted(usados)}'
    faltantes = sorted(usados - catalogo)
    assert not faltantes, f'Permisos exigidos por vistas que no existen en seed_permisos: {faltantes}'


def test_configuracion_ver_existe_y_se_usa():
    """Regresión FIX-QA10: la pantalla de correo de acceso exige este código."""
    catalogo = {codigo for codigo, _ in PERMISOS_CATALOGO}
    assert 'configuracion.ver' in catalogo
    assert 'configuracion.ver' in _codigos_usados()
