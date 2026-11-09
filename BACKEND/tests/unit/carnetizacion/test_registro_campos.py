"""
Pruebas unitarias para el Registro de Campos autorizados y personalizados (O44 - E5).
"""
import pytest
from apps.carnetizacion.application.use_cases.gestionar_campos import (
    crear_campo_personalizado_uc,
    eliminar_campo_personalizado_uc,
    listar_campos_credencial_uc,
)
from apps.carnetizacion.domain.entities.campo_credencial import (
    CAMPOS_AUTORIZADOS_EXPEDIENTE,
    CampoCredencial,
)
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from core.domain.exceptions import NotFoundError, ValidationError


class RepoCamposMemoria:
    def __init__(self):
        self.personalizados: dict[str, CampoCredencial] = {}

    def listar_campos_credencial(self, tipo_credencial: str = "trabajador") -> list[CampoCredencial]:
        nativos = [
            c for c in CAMPOS_AUTORIZADOS_EXPEDIENTE
            if c.tipo_credencial in ("todos", tipo_credencial)
        ]
        pers = [
            c for c in self.personalizados.values()
            if c.tipo_credencial in ("todos", tipo_credencial)
        ]
        return nativos + pers

    def crear_campo_personalizado(
        self,
        codigo: str,
        etiqueta: str,
        grupo: str = "personalizado",
        tipo_credencial: str = "todos",
        sensible: bool = False,
        descripcion: str = "",
        valor_ejemplo: str = "",
    ) -> CampoCredencial:
        campo = CampoCredencial(
            codigo=codigo,
            etiqueta=etiqueta,
            grupo=grupo,  # type: ignore[arg-type]
            tipo_credencial=tipo_credencial,
            sensible=sensible,
            es_personalizado=True,
            descripcion=descripcion,
            valor_ejemplo=valor_ejemplo,
        )
        self.personalizados[codigo] = campo
        return campo

    def eliminar_campo_personalizado(self, codigo: str) -> bool:
        if codigo not in self.personalizados:
            raise NotFoundError(f"Campo {codigo} no existe")
        del self.personalizados[codigo]
        return True


def test_campos_autorizados_expediente_sensibilidad_y_tipos():
    repo = RepoCamposMemoria()
    campos_trabajador = listar_campos_credencial_uc(repo, tipo_credencial="trabajador")

    codigos = {c.codigo for c in campos_trabajador}
    assert "nombre" in codigos
    assert "cedula" in codigos
    assert "cargo" in codigos
    assert "sangre" in codigos

    # Verificar banderas de sensibilidad
    mapa = {c.codigo: c for c in campos_trabajador}
    assert mapa["cedula"].sensible is True
    assert mapa["nac"].sensible is True
    assert mapa["sangre"].sensible is True
    assert mapa["alerg"].sensible is True
    assert mapa["emer"].sensible is True
    assert mapa["nombre"].sensible is False
    assert mapa["cargo"].sensible is False


def test_campos_autorizados_filtro_por_tipo_pasivo():
    repo = RepoCamposMemoria()
    campos_pasivo = listar_campos_credencial_uc(repo, tipo_credencial="pasivo")
    codigos = {c.codigo for c in campos_pasivo}

    # Pasivos tienen nombre, cédula, sangre, nómina... pero no cargo activo
    assert "nombre" in codigos
    assert "cedula" in codigos
    assert "cargo" not in codigos
    assert "ingreso" not in codigos


def test_crear_campo_personalizado_rechaza_colision_con_expediente():
    repo = RepoCamposMemoria()
    with pytest.raises(ValidationError, match="campo reservado"):
        crear_campo_personalizado_uc(
            repo,
            codigo="cedula",
            etiqueta="Mi Cédula",
            grupo="personalizado",
        )


def test_crear_campo_personalizado_valida_formato_slug():
    repo = RepoCamposMemoria()
    with pytest.raises(ValidationError, match="letras minúsculas"):
        crear_campo_personalizado_uc(
            repo,
            codigo="CAMPO CON ESPACIOS!",
            etiqueta="Invalido",
        )


def test_crear_campo_personalizado_valida_etiqueta_obligatoria():
    repo = RepoCamposMemoria()
    with pytest.raises(ValidationError, match="obligatoria"):
        crear_campo_personalizado_uc(
            repo,
            codigo="valido_slug",
            etiqueta="   ",
        )


def test_eliminar_campo_personalizado_rechaza_eliminar_nativos():
    repo = RepoCamposMemoria()
    with pytest.raises(ValidationError, match="campo reservado"):
        eliminar_campo_personalizado_uc(repo, codigo="nombre")


@pytest.mark.django_db
def test_orm_guardar_listar_y_eliminar_campo_personalizado():
    repo = RepoCarnetizacionORM()

    campo = repo.crear_campo_personalizado(
        codigo="turno_laboral",
        etiqueta="Turno Laboral",
        grupo="laboral",
        tipo_credencial="trabajador",
        sensible=False,
        descripcion="Horario asignado",
        valor_ejemplo="Diurno (8am - 4pm)",
    )
    assert campo.codigo == "turno_laboral"
    assert campo.es_personalizado is True

    # Listar debe incluir nativos + el personalizado creado
    todos = repo.listar_campos_credencial(tipo_credencial="trabajador")
    mapa = {c.codigo: c for c in todos}
    assert "turno_laboral" in mapa
    assert mapa["turno_laboral"].etiqueta == "Turno Laboral"

    # Eliminar
    ok = repo.eliminar_campo_personalizado("turno_laboral")
    assert ok is True

    todos_post = repo.listar_campos_credencial(tipo_credencial="trabajador")
    assert "turno_laboral" not in {c.codigo for c in todos_post}
