"""
Pruebas unitarias puras de Reglas de Catálogos (A5).
Verifica:
1. Listado y actualización de parentescos (aplica_familiar).
2. Bloqueo al mover motivos reservados (JUBILACION DE DERECHO, etc. en PASE A PASIVO).
3. Bloqueo al transferir un motivo dejando sin motivos una categoría requerida.
4. Alta de motivo en una categoría con validación de longitud y sin HTML.
5. Actualización de marcas de nómina (es_activo, requiere_codig).
"""
import pytest

from apps.configuracion.application.use_cases.gestionar_reglas_catalogos import (
    actualizar_motivo,
    actualizar_nomina,
    actualizar_parentesco,
    cambiar_categoria_motivo,
    crear_nuevo_motivo,
    eliminar_motivo,
    obtener_todas_las_reglas,
)
from apps.configuracion.domain.ports.repo_reglas_catalogos import RepoReglasCatalogos
from apps.configuracion.domain.reglas_catalogos import (
    CategoriaMotivoItem,
    ReglaMotivo,
    ReglaNomina,
    ReglaParentesco,
    es_motivo_reservado,
)
from core.domain.categorias_motivo import (
    CategoriaMotivo,
    MOTIVO_SISTEMA_JUBILACION,
)
from core.domain.exceptions import NotFoundError, ValidationError


class RepoReglasCatalogosMemoria(RepoReglasCatalogos):
    def __init__(self):
        self.parentescos = {
            1: ReglaParentesco(id=1, descripcion='HIJO(A)', aplica_familiar=True),
            2: ReglaParentesco(id=2, descripcion='AMIGO(A)', aplica_familiar=False),
        }
        self.categorias = {
            1: CategoriaMotivoItem(id=1, categoria='INGRESO'),
            2: CategoriaMotivoItem(id=2, categoria='PASE A PASIVO'),
            3: CategoriaMotivoItem(id=3, categoria='EGRESO'),
        }
        self.motivos = {
            10: ReglaMotivo(
                id=10,
                movimiento='NUEVO INGRESO ORDINARIO',
                categoria_id=1,
                categoria_nombre='INGRESO',
                es_reservado=False,
            ),
            11: ReglaMotivo(
                id=11,
                movimiento=MOTIVO_SISTEMA_JUBILACION,
                categoria_id=2,
                categoria_nombre='PASE A PASIVO',
                es_reservado=True,
            ),
            12: ReglaMotivo(
                id=12,
                movimiento='RENUNCIA VOLUNTARIA',
                categoria_id=3,
                categoria_nombre='EGRESO',
                es_reservado=False,
            ),
            13: ReglaMotivo(
                id=13,
                movimiento='DESTITUCION',
                categoria_id=3,
                categoria_nombre='EGRESO',
                es_reservado=False,
            ),
        }
        self.nominas = {
            1: ReglaNomina(id=1, nomina='EMPLEADOS FIJOS', requiere_codig=True, es_activo=True),
            2: ReglaNomina(id=2, nomina='JUBILADOS', requiere_codig=False, es_activo=False),
        }
        self.referencias_motivos: set[int] = {12}  # Motivo 12 tiene movimientos asociados

    def listar_parentescos(self):
        return list(self.parentescos.values())

    def obtener_parentesco(self, parentesco_id: int):
        if parentesco_id not in self.parentescos:
            raise NotFoundError('No encontrado')
        return self.parentescos[parentesco_id]

    def actualizar_parentesco(self, parentesco_id: int, aplica_familiar: bool):
        actual = self.obtener_parentesco(parentesco_id)
        nuevo = ReglaParentesco(id=actual.id, descripcion=actual.descripcion, aplica_familiar=aplica_familiar)
        self.parentescos[parentesco_id] = nuevo
        return nuevo

    def listar_categorias_motivo(self):
        return list(self.categorias.values())

    def obtener_categoria_motivo(self, categoria_id: int):
        if categoria_id not in self.categorias:
            raise NotFoundError('No encontrado')
        return self.categorias[categoria_id]

    def listar_motivos(self):
        return list(self.motivos.values())

    def obtener_motivo(self, motivo_id: int):
        if motivo_id not in self.motivos:
            raise NotFoundError('No encontrado')
        return self.motivos[motivo_id]

    def contar_motivos_en_categoria(self, categoria_id: int):
        return sum(1 for m in self.motivos.values() if m.categoria_id == categoria_id)

    def contar_motivos_activos_en_categoria(self, categoria_id: int):
        return sum(1 for m in self.motivos.values() if m.categoria_id == categoria_id and m.activo)

    def cambiar_categoria_motivo(self, motivo_id: int, nueva_categoria_id: int):
        return self.actualizar_motivo(motivo_id, categoria_id=nueva_categoria_id)

    def actualizar_motivo(
        self,
        motivo_id: int,
        movimiento: str | None = None,
        categoria_id: int | None = None,
        activo: bool | None = None,
    ):
        actual = self.obtener_motivo(motivo_id)
        cat_id = categoria_id if categoria_id is not None else actual.categoria_id
        cat = self.obtener_categoria_motivo(cat_id)
        nom = movimiento.strip().upper() if movimiento is not None else actual.movimiento
        act = activo if activo is not None else actual.activo

        # Unicidad en memoria
        for mid, m in self.motivos.items():
            if mid != motivo_id and m.categoria_id == cat_id and m.movimiento == nom:
                raise ValidationError(f'Ya existe un motivo «{nom}» en la categoría «{cat.categoria}».', campo='movimiento')

        nuevo = ReglaMotivo(
            id=actual.id,
            movimiento=nom,
            categoria_id=cat.id,
            categoria_nombre=cat.categoria,
            es_reservado=es_motivo_reservado(nom, cat.categoria),
            activo=act,
        )
        self.motivos[motivo_id] = nuevo
        return nuevo

    def motivo_tiene_referencias(self, motivo_id: int) -> bool:
        return motivo_id in self.referencias_motivos

    def eliminar_motivo(self, motivo_id: int) -> ReglaMotivo:
        actual = self.obtener_motivo(motivo_id)
        del self.motivos[motivo_id]
        return actual

    def crear_motivo(self, movimiento: str, categoria_id: int):
        cat = self.obtener_categoria_motivo(categoria_id)
        nuevo_id = max(self.motivos.keys(), default=0) + 1
        nuevo = ReglaMotivo(
            id=nuevo_id,
            movimiento=movimiento,
            categoria_id=cat.id,
            categoria_nombre=cat.categoria,
            es_reservado=False,
        )
        self.motivos[nuevo_id] = nuevo
        return nuevo

    def listar_nominas(self):
        return list(self.nominas.values())

    def obtener_nomina(self, nomina_id: int):
        if nomina_id not in self.nominas:
            raise NotFoundError('No encontrado')
        return self.nominas[nomina_id]

    def actualizar_nomina(self, nomina_id: int, es_activo: bool | None, requiere_codig: bool | None):
        actual = self.obtener_nomina(nomina_id)
        nuevo = ReglaNomina(
            id=actual.id,
            nomina=actual.nomina,
            requiere_codig=actual.requiere_codig if requiere_codig is None else requiere_codig,
            es_activo=actual.es_activo if es_activo is None else es_activo,
        )
        self.nominas[nomina_id] = nuevo
        return nuevo


# -------------------------------------------------------------
# Pruebas de Parentescos
# -------------------------------------------------------------
def test_obtener_todas_las_reglas():
    repo = RepoReglasCatalogosMemoria()
    datos = obtener_todas_las_reglas(repo)
    assert len(datos['parentescos']) == 2
    assert len(datos['categorias_motivo']) == 3
    assert len(datos['motivos']) == 4
    assert len(datos['nominas']) == 2


def test_actualizar_parentesco_cambia_marca():
    repo = RepoReglasCatalogosMemoria()
    anterior, actualizado = actualizar_parentesco(repo, 2, True)
    assert anterior.aplica_familiar is False
    assert actualizado.aplica_familiar is True
    assert repo.parentescos[2].aplica_familiar is True


# -------------------------------------------------------------
# Pruebas de Motivos de Movimiento
# -------------------------------------------------------------
def test_cambiar_categoria_motivo_exitoso():
    repo = RepoReglasCatalogosMemoria()
    # Mover DESTITUCION (id 13) de EGRESO (que tiene 2 motivos: 12 y 13) a INGRESO (id 1)
    anterior, actualizado = cambiar_categoria_motivo(repo, 13, 1)
    assert anterior.categoria_id == 3
    assert actualizado.categoria_id == 1
    assert actualizado.categoria_nombre == 'INGRESO'


def test_bloqueo_mover_motivo_reservado_del_sistema():
    repo = RepoReglasCatalogosMemoria()
    # Motivo 11 es JUBILACION DE DERECHO en PASE A PASIVO
    with pytest.raises(ValidationError) as exc:
        cambiar_categoria_motivo(repo, 11, 1)
    assert 'motivo reservado' in str(exc.value)
    assert exc.value.campo == 'categoria_id'


def test_bloqueo_dejar_categoria_sin_motivos():
    repo = RepoReglasCatalogosMemoria()
    # Categoria INGRESO (id 1) tiene SOLO 1 motivo (id 10)
    with pytest.raises(ValidationError) as exc:
        cambiar_categoria_motivo(repo, 10, 3)
    assert 'quedaría sin ningún motivo' in str(exc.value)
    assert exc.value.campo == 'categoria_id'


def test_crear_motivo_exitoso():
    repo = RepoReglasCatalogosMemoria()
    creado = crear_nuevo_motivo(repo, 'contrato por tiempo determinado', 1)
    assert creado.movimiento == 'CONTRATO POR TIEMPO DETERMINADO'
    assert creado.categoria_id == 1
    assert creado.es_reservado is False


def test_crear_motivo_valida_longitud_y_caracteres():
    repo = RepoReglasCatalogosMemoria()
    with pytest.raises(ValidationError):
        crear_nuevo_motivo(repo, 'ab', 1)

    with pytest.raises(ValidationError):
        crear_nuevo_motivo(repo, 'motivo <invalido>', 1)


# -------------------------------------------------------------
# Pruebas de Tipos de Nómina
# -------------------------------------------------------------
def test_actualizar_marcas_nomina():
    repo = RepoReglasCatalogosMemoria()
    anterior, actualizado = actualizar_nomina(repo, 1, es_activo=False, requiere_codig=False)
    assert anterior.es_activo is True
    assert anterior.requiere_codig is True
    assert actualizado.es_activo is False
    assert actualizado.requiere_codig is False


# -------------------------------------------------------------
# O29: Pruebas de CRUD de Motivos (Edición, Desactivación y Eliminación)
# -------------------------------------------------------------
def test_actualizar_motivo_renombrar_y_desactivar():
    repo = RepoReglasCatalogosMemoria()
    anterior, actualizado = actualizar_motivo(repo, 13, movimiento='DESTITUCION DISCIPLINARIA', activo=False)
    assert anterior.movimiento == 'DESTITUCION'
    assert anterior.activo is True
    assert actualizado.movimiento == 'DESTITUCION DISCIPLINARIA'
    assert actualizado.activo is False


def test_actualizar_motivo_reservado_no_permite_renombrar_ni_desactivar():
    repo = RepoReglasCatalogosMemoria()
    with pytest.raises(ValidationError) as exc1:
        actualizar_motivo(repo, 11, movimiento='NUEVO NOMBRE')
    assert 'motivo reservado' in str(exc1.value)
    assert exc1.value.campo == 'movimiento'

    with pytest.raises(ValidationError) as exc2:
        actualizar_motivo(repo, 11, activo=False)
    assert 'motivo reservado' in str(exc2.value)
    assert exc2.value.campo == 'activo'


def test_actualizar_motivo_no_permite_desactivar_ultimo_activo_en_categoria_sistema():
    repo = RepoReglasCatalogosMemoria()
    # INGRESO solo tiene el motivo 10
    with pytest.raises(ValidationError) as exc:
        actualizar_motivo(repo, 10, activo=False)
    assert 'quedaría sin ningún motivo activo' in str(exc.value)
    assert exc.value.campo == 'activo'


def test_eliminar_motivo_sin_referencias_exitoso():
    repo = RepoReglasCatalogosMemoria()
    # Motivo 13 no tiene referencias
    eliminado = eliminar_motivo(repo, 13)
    assert eliminado.id == 13
    assert 13 not in repo.motivos


def test_eliminar_motivo_con_referencias_rechaza_con_mensaje_claro():
    repo = RepoReglasCatalogosMemoria()
    # Motivo 12 tiene referencias
    with pytest.raises(ValidationError) as exc:
        eliminar_motivo(repo, 12)
    assert 'tiene movimientos asociados en el historial' in str(exc.value)
    assert 'Puede desactivarlo en su lugar' in str(exc.value)
    assert exc.value.campo == 'motivo'


def test_eliminar_motivo_reservado_rechaza():
    repo = RepoReglasCatalogosMemoria()
    # Motivo 11 es reservado
    with pytest.raises(ValidationError) as exc:
        eliminar_motivo(repo, 11)
    assert 'motivo reservado' in str(exc.value)
    assert exc.value.campo == 'motivo'
