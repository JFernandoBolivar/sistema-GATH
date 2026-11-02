"""
C20: alta de pensionados por sobrevivencia (casos de uso con repo en memoria).
"""
import pytest

from apps.pasivos.application.dtos.pasivos_dtos import CrearSobrevivientesDTO, ProcesarEgresoDTO
from apps.pasivos.application.use_cases.crear_sobrevivientes import (
    ejecutar_creacion_sobrevivientes,
)
from apps.pasivos.application.use_cases.procesar_egreso import procesar_egreso
from apps.pasivos.domain.entities.pasivo import Pasivo
from apps.pasivos.domain.entities.sobreviviente import (
    FamiliarBeneficiario,
    ResultadoAltaSobreviviente,
)
from core.domain.exceptions import NotFoundError, ValidationError


class RepoSobrevivientesMemoria:
    def __init__(self, fallecidos=("V1",), familiares=None, ya_pasivos=()):
        self.fallecidos = set(fallecidos)
        self.familiares = familiares if familiares is not None else [
            FamiliarBeneficiario(1, "V100", "Ana", "Pérez", True),
            FamiliarBeneficiario(2, "V200", "Luis", "Pérez", False),
        ]
        self.pasivos = set(ya_pasivos)
        self.altas: list[str] = []
        self.nominas: list[int] = []

    def resolver_tipo_nomina_sobrevivencia(self, tipo_nomina_id):
        if tipo_nomina_id is None:
            return 9
        if tipo_nomina_id != 9:
            raise ValidationError('La nómina no es de pensión por sobrevivencia.')
        return 9

    def titular_fallecido(self, cedula_titular):
        return cedula_titular in self.fallecidos

    def listar_familiares_beneficiarios(self, cedula_titular, familiar_ids=None):
        if familiar_ids:
            return [f for f in self.familiares if f.id in familiar_ids]
        return [f for f in self.familiares if f.heredero]

    def crear_pasivo_sobreviviente(self, cedula_titular, familiar_id, tipo_nomina_id, usuario_id=None):
        f = next(x for x in self.familiares if x.id == familiar_id)
        if f.cedula in self.pasivos:
            return ResultadoAltaSobreviviente(f.cedula, f.nombres, False, "P-1")
        self.pasivos.add(f.cedula)
        self.altas.append(f.cedula)
        self.nominas.append(tipo_nomina_id)
        return ResultadoAltaSobreviviente(f.cedula, f.nombres, True, "P-1")


def _dto(**kw):
    base = dict(cedula_titular="V1", tipo_nomina_id=9, usuario_id=9)
    base.update(kw)
    return CrearSobrevivientesDTO(**base)


def test_crea_pasivo_para_los_herederos():
    repo = RepoSobrevivientesMemoria()
    res = ejecutar_creacion_sobrevivientes(repo, _dto())
    assert [r.cedula for r in res] == ["V100"]
    assert res[0].creado is True
    assert repo.altas == ["V100"]


def test_familiares_explicitos():
    repo = RepoSobrevivientesMemoria()
    res = ejecutar_creacion_sobrevivientes(repo, _dto(familiar_ids=(1, 2)))
    assert {r.cedula for r in res} == {"V100", "V200"}


def test_idempotente_no_duplica():
    repo = RepoSobrevivientesMemoria(ya_pasivos=("V100",))
    res = ejecutar_creacion_sobrevivientes(repo, _dto())
    assert res[0].creado is False
    assert repo.altas == []


def test_titular_no_fallecido_se_rechaza():
    repo = RepoSobrevivientesMemoria(fallecidos=())
    with pytest.raises(ValidationError):
        ejecutar_creacion_sobrevivientes(repo, _dto())
    assert repo.altas == []


def test_familiar_ajeno_al_titular():
    repo = RepoSobrevivientesMemoria()
    with pytest.raises(NotFoundError):
        ejecutar_creacion_sobrevivientes(repo, _dto(familiar_ids=(99,)))


def test_sin_herederos():
    repo = RepoSobrevivientesMemoria(familiares=[FamiliarBeneficiario(1, "V100", "Ana", "P", False)])
    with pytest.raises(NotFoundError):
        ejecutar_creacion_sobrevivientes(repo, _dto())


def test_familiar_sin_cedula_se_rechaza_sin_crear_nada():
    repo = RepoSobrevivientesMemoria(familiares=[
        FamiliarBeneficiario(1, "V100", "Ana", "P", True),
        FamiliarBeneficiario(2, None, "Bebé", "P", True),
    ])
    with pytest.raises(ValidationError):
        ejecutar_creacion_sobrevivientes(repo, _dto())
    assert repo.altas == []


class RepoEgresoMemoria(RepoSobrevivientesMemoria):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.egresos = []

    def procesar_egreso_a_pasivo(self, cedula, motivo_movimiento_id, tipo_nomina_id, liberar_activos,
                                 usuario_id=None):
        self.egresos.append(cedula)
        return Pasivo(id=1, cedula=cedula, nombres="T", apellidos="T", tipo_pasivo="PASIVO")


def test_procesar_egreso_encadena_sobrevivientes():
    repo = RepoEgresoMemoria()
    procesar_egreso(repo, ProcesarEgresoDTO(
        cedula="V1", motivo_movimiento_id=1, tipo_nomina_id=5, sobrevivientes_familiar_ids=(1,)))
    assert repo.egresos == ["V1"]
    assert repo.altas == ["V100"]


def test_procesar_egreso_sin_ids_no_toca_sobrevivientes():
    repo = RepoEgresoMemoria()
    procesar_egreso(repo, ProcesarEgresoDTO(cedula="V1", motivo_movimiento_id=1, tipo_nomina_id=5))
    assert repo.altas == []


def test_nomina_por_defecto_es_la_de_sobrevivencia():
    repo = RepoSobrevivientesMemoria()
    ejecutar_creacion_sobrevivientes(repo, _dto(tipo_nomina_id=None))
    assert repo.nominas == [9]


def test_nomina_que_no_es_de_sobrevivencia_se_rechaza():
    repo = RepoSobrevivientesMemoria()
    with pytest.raises(ValidationError):
        ejecutar_creacion_sobrevivientes(repo, _dto(tipo_nomina_id=15))
    assert repo.altas == []


def test_egreso_usa_nomina_de_sobrevivencia_no_la_del_titular():
    repo = RepoEgresoMemoria()
    procesar_egreso(repo, ProcesarEgresoDTO(
        cedula="V1", motivo_movimiento_id=1, tipo_nomina_id=15, sobrevivientes_familiar_ids=(1,)))
    assert repo.nominas == [9]


def test_egreso_devuelve_resultados_para_auditoria():
    repo = RepoEgresoMemoria()
    salida: list = []
    procesar_egreso(repo, ProcesarEgresoDTO(
        cedula="V1", motivo_movimiento_id=1, tipo_nomina_id=15, sobrevivientes_familiar_ids=(1,)), salida)
    assert [r.cedula for r in salida] == ["V100"]
