"""
Tests unitarios del Motor de Plantillas de Carnetización (O44 - E3).
Arquitectura Onion pura sin I/O ni base de datos.
"""
from typing import Any
import pytest

from apps.carnetizacion.application.use_cases.gestionar_plantillas import (
    activar_plantilla_motor,
    actualizar_borrador_plantilla,
    crear_plantilla_borrador,
    listar_plantillas_motor,
    listar_tipos_credencial,
    listar_versiones_plantilla,
    obtener_plantilla_activa,
    obtener_plantilla_detalle,
    publicar_plantilla,
)
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet
from apps.carnetizacion.domain.entities.tipo_credencial import TipoCredencial
from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_pasivo,
    plantilla_defecto_trabajador,
)
from core.domain.exceptions import NotFoundError, ValidationError


class RepoMotorPlantillasMemoria:
    """Implementación en memoria del puerto RepoCarnetizacion para pruebas puras."""

    def __init__(self):
        self.tipos = [
            TipoCredencial(
                codigo="trabajador",
                nombre="Trabajador Activo",
                descripcion="Credencial personal activo",
                ancho_mm=54.0,
                alto_mm=85.6,
                orientacion="vertical",
                activo=True,
                orden=1,
            ),
            TipoCredencial(
                codigo="pasivo",
                nombre="Pasivo / Jubilado / Pensionado",
                descripcion="Credencial personal pasivo",
                ancho_mm=54.0,
                alto_mm=85.6,
                orientacion="vertical",
                activo=True,
                orden=2,
            ),
        ]
        self.plantillas: list[PlantillaCarnet] = []
        self.carnets: list[Carnet] = []
        self._next_id = 1

    def listar_tipos_credencial(self, solo_activos: bool = True) -> list[TipoCredencial]:
        if solo_activos:
            return [t for t in self.tipos if t.activo]
        return list(self.tipos)

    def obtener_tipo_credencial(self, codigo: str) -> TipoCredencial | None:
        return next((t for t in self.tipos if t.codigo == codigo), None)

    def listar_plantillas(
        self,
        codigo_tipo: str | None = None,
        estado: str | None = None,
        solo_activas: bool = False,
    ) -> list[PlantillaCarnet]:
        res = list(self.plantillas)
        if codigo_tipo:
            res = [p for p in res if p.codigo_tipo == codigo_tipo]
        if estado:
            res = [p for p in res if p.estado == estado]
        if solo_activas:
            res = [p for p in res if p.activa]
        return res

    def obtener_plantilla(self, plantilla_id: str | int) -> PlantillaCarnet | None:
        return next((p for p in self.plantillas if str(p.id) == str(plantilla_id)), None)

    def obtener_plantilla_activa(
        self,
        codigo_tipo: str = "trabajador",
        regla_criterio: str = "todos",
        regla_valor: str = "*",
    ) -> PlantillaCarnet | None:
        match = next(
            (
                p for p in self.plantillas
                if p.codigo_tipo == codigo_tipo
                and p.regla_criterio == regla_criterio
                and p.regla_valor == regla_valor
                and p.activa
            ),
            None,
        )
        if match:
            return match
        return next((p for p in self.plantillas if p.codigo_tipo == codigo_tipo and p.activa), None)

    def crear_plantilla_borrador(
        self,
        nombre: str,
        codigo_tipo: str,
        definicion: dict[str, Any],
        ancho_mm: float = 54.0,
        alto_mm: float = 85.6,
        orientacion: str = "vertical",
        regla_criterio: str = "todos",
        regla_valor: str = "*",
        descripcion: str = "",
        creado_por: str | None = None,
    ) -> PlantillaCarnet:
        pid = f"uuid-{self._next_id}"
        self._next_id += 1
        obj = PlantillaCarnet(
            id=pid,
            nombre=nombre,
            codigo_tipo=codigo_tipo,
            ancho_mm=ancho_mm,
            alto_mm=alto_mm,
            orientacion=orientacion,
            regla_criterio=regla_criterio,
            regla_valor=regla_valor,
            estado="borrador",
            activa=False,
            version=1,
            definicion=definicion,
            plantilla_raiz_id=pid,
            creado_por=creado_por,
            descripcion=descripcion,
            creado="2026-11-07T00:00:00",
            actualizado="2026-11-07T00:00:00",
        )
        self.plantillas.append(obj)
        return obj

    def actualizar_borrador(
        self,
        plantilla_id: str | int,
        nombre: str | None = None,
        definicion: dict[str, Any] | None = None,
        ancho_mm: float | None = None,
        alto_mm: float | None = None,
        orientacion: str | None = None,
        regla_criterio: str | None = None,
        regla_valor: str | None = None,
        descripcion: str | None = None,
    ) -> PlantillaCarnet:
        obj = self.obtener_plantilla(plantilla_id)
        if not obj:
            raise NotFoundError(f"Plantilla {plantilla_id} no encontrada")
        if obj.estado != "borrador":
            raise ValidationError("Solo se pueden editar plantillas en estado borrador")

        idx = self.plantillas.index(obj)
        updated = PlantillaCarnet(
            id=obj.id,
            nombre=nombre if nombre is not None else obj.nombre,
            codigo_tipo=obj.codigo_tipo,
            ancho_mm=ancho_mm if ancho_mm is not None else obj.ancho_mm,
            alto_mm=alto_mm if alto_mm is not None else obj.alto_mm,
            orientacion=orientacion if orientacion is not None else obj.orientacion,
            regla_criterio=regla_criterio if regla_criterio is not None else obj.regla_criterio,
            regla_valor=regla_valor if regla_valor is not None else obj.regla_valor,
            estado=obj.estado,
            activa=obj.activa,
            version=obj.version,
            definicion=definicion if definicion is not None else obj.definicion,
            plantilla_raiz_id=obj.plantilla_raiz_id,
            creado_por=obj.creado_por,
            descripcion=descripcion if descripcion is not None else obj.descripcion,
            creado=obj.creado,
            actualizado="2026-11-07T01:00:00",
        )
        self.plantillas[idx] = updated
        return updated

    def publicar_plantilla(
        self,
        plantilla_id: str | int,
        activar: bool = True,
        publicado_por: str | None = None,
    ) -> PlantillaCarnet:
        obj = self.obtener_plantilla(plantilla_id)
        if not obj:
            raise NotFoundError(f"Plantilla {plantilla_id} no encontrada")

        if obj.estado == "borrador":
            idx = self.plantillas.index(obj)
            if activar:
                # Desactivar cualquier otra activa del mismo tipo y regla
                self._desactivar_coincidentes(obj.codigo_tipo, obj.regla_criterio, obj.regla_valor)
            pub = PlantillaCarnet(
                id=obj.id,
                nombre=obj.nombre,
                codigo_tipo=obj.codigo_tipo,
                ancho_mm=obj.ancho_mm,
                alto_mm=obj.alto_mm,
                orientacion=obj.orientacion,
                regla_criterio=obj.regla_criterio,
                regla_valor=obj.regla_valor,
                estado="publicada",
                activa=activar,
                version=obj.version,
                definicion=obj.definicion,
                plantilla_raiz_id=obj.plantilla_raiz_id,
                creado_por=obj.creado_por,
                descripcion=obj.descripcion,
                creado=obj.creado,
                actualizado="2026-11-07T02:00:00",
            )
            self.plantillas[idx] = pub
            return pub

        # Si ya estaba publicada, genera nueva versión
        if activar:
            self._desactivar_coincidentes(obj.codigo_tipo, obj.regla_criterio, obj.regla_valor)
        versiones = self.listar_versiones_plantilla(obj.plantilla_raiz_id or obj.id)
        max_ver = max(v.version for v in versiones) if versiones else obj.version
        pid = f"uuid-{self._next_id}"
        self._next_id += 1
        nueva_v = PlantillaCarnet(
            id=pid,
            nombre=obj.nombre,
            codigo_tipo=obj.codigo_tipo,
            ancho_mm=obj.ancho_mm,
            alto_mm=obj.alto_mm,
            orientacion=obj.orientacion,
            regla_criterio=obj.regla_criterio,
            regla_valor=obj.regla_valor,
            estado="publicada",
            activa=activar,
            version=max_ver + 1,
            definicion=obj.definicion,
            plantilla_raiz_id=obj.plantilla_raiz_id or obj.id,
            creado_por=publicado_por or obj.creado_por,
            descripcion=obj.descripcion,
            creado="2026-11-07T03:00:00",
            actualizado="2026-11-07T03:00:00",
        )
        self.plantillas.append(nueva_v)
        return nueva_v

    def _desactivar_coincidentes(self, tipo: str, criterio: str, valor: str):
        for i, p in enumerate(self.plantillas):
            if p.codigo_tipo == tipo and p.regla_criterio == criterio and p.regla_valor == valor and p.activa:
                self.plantillas[i] = PlantillaCarnet(
                    id=p.id,
                    nombre=p.nombre,
                    codigo_tipo=p.codigo_tipo,
                    ancho_mm=p.ancho_mm,
                    alto_mm=p.alto_mm,
                    orientacion=p.orientacion,
                    regla_criterio=p.regla_criterio,
                    regla_valor=p.regla_valor,
                    estado=p.estado,
                    activa=False,
                    version=p.version,
                    definicion=p.definicion,
                    plantilla_raiz_id=p.plantilla_raiz_id,
                    creado_por=p.creado_por,
                    descripcion=p.descripcion,
                    creado=p.creado,
                    actualizado=p.actualizado,
                )

    def activar_plantilla(self, plantilla_id: str | int) -> PlantillaCarnet:
        obj = self.obtener_plantilla(plantilla_id)
        if not obj:
            raise NotFoundError(f"Plantilla {plantilla_id} no encontrada")
        self._desactivar_coincidentes(obj.codigo_tipo, obj.regla_criterio, obj.regla_valor)
        idx = self.plantillas.index(obj)
        activa = PlantillaCarnet(
            id=obj.id,
            nombre=obj.nombre,
            codigo_tipo=obj.codigo_tipo,
            ancho_mm=obj.ancho_mm,
            alto_mm=obj.alto_mm,
            orientacion=obj.orientacion,
            regla_criterio=obj.regla_criterio,
            regla_valor=obj.regla_valor,
            estado=obj.estado,
            activa=True,
            version=obj.version,
            definicion=obj.definicion,
            plantilla_raiz_id=obj.plantilla_raiz_id,
            creado_por=obj.creado_por,
            descripcion=obj.descripcion,
            creado=obj.creado,
            actualizado=obj.actualizado,
        )
        self.plantillas[idx] = activa
        return activa

    def listar_versiones_plantilla(self, plantilla_raiz_id: str | int) -> list[PlantillaCarnet]:
        return [
            p for p in self.plantillas
            if str(p.plantilla_raiz_id) == str(plantilla_raiz_id) or str(p.id) == str(plantilla_raiz_id)
        ]

    def emitir_carnet(
        self,
        empleado_cedula: str,
        motivo_id: int,
        observaciones: str | None = None,
        plantilla_id: str | int | None = None,
    ) -> Carnet:
        plantilla = self.obtener_plantilla(plantilla_id) if plantilla_id else self.obtener_plantilla_activa("trabajador")
        cid = len(self.carnets) + 1
        carnet = Carnet(
            id=cid,
            empleado_cedula=empleado_cedula,
            empleado_nombres="Titular",
            empleado_apellidos="Prueba",
            security_hash=f"hash-{cid}",
            fecha_emision="2026-11-07",
            motivo_id=motivo_id,
            motivo_nombre="EMISION INICIAL",
            activo=True,
            observaciones=observaciones,
            plantilla_id=str(plantilla.id) if plantilla else None,
            plantilla_version=plantilla.version if plantilla else 1,
            plantilla_snapshot=plantilla.definicion if plantilla else None,
        )
        self.carnets.append(carnet)
        return carnet


# ==============================================================================
# TESTS
# ==============================================================================

def test_catalogo_tipos_credencial():
    repo = RepoMotorPlantillasMemoria()
    tipos = listar_tipos_credencial(repo)
    assert len(tipos) == 2
    codigos = [t.codigo for t in tipos]
    assert "trabajador" in codigos
    assert "pasivo" in codigos


def test_crear_plantilla_borrador_y_editar():
    repo = RepoMotorPlantillasMemoria()
    def_trabajador = plantilla_defecto_trabajador()
    assert "anverso" in def_trabajador
    assert "reverso" in def_trabajador

    # Crear borrador
    borrador = crear_plantilla_borrador(
        repo=repo,
        nombre="Plantilla Prueba Borrador",
        codigo_tipo="trabajador",
        definicion=def_trabajador,
        ancho_mm=54.0,
        alto_mm=85.6,
        orientacion="vertical",
    )
    assert borrador.estado == "borrador"
    assert borrador.activa is False
    assert borrador.version == 1

    # Actualizar borrador
    editado = actualizar_borrador_plantilla(
        repo=repo,
        plantilla_id=borrador.id,
        nombre="Plantilla Prueba Modificada",
        ancho_mm=55.0,
    )
    assert editado.nombre == "Plantilla Prueba Modificada"
    assert editado.ancho_mm == 55.0


def test_publicar_plantilla_y_versionado():
    repo = RepoMotorPlantillasMemoria()
    def_trabajador = plantilla_defecto_trabajador()

    # 1. Crear borrador
    borrador = crear_plantilla_borrador(
        repo=repo,
        nombre="Credencial CONATEL",
        codigo_tipo="trabajador",
        definicion=def_trabajador,
    )

    # 2. Publicar primera versión
    v1 = publicar_plantilla(repo=repo, plantilla_id=borrador.id, activar=True)
    assert v1.estado == "publicada"
    assert v1.activa is True
    assert v1.version == 1

    # 3. Publicar segunda versión sobre la misma raíz
    v2 = publicar_plantilla(repo=repo, plantilla_id=v1.id, activar=True)
    assert v2.version == 2
    assert v2.activa is True
    assert v2.plantilla_raiz_id == v1.id

    # La versión 1 se desactiva automáticamente por la regla "una activa por tipo y regla"
    v1_recuperada = obtener_plantilla_detalle(repo=repo, plantilla_id=v1.id)
    assert v1_recuperada.activa is False

    # Historial de versiones contiene v1 y v2
    historial = listar_versiones_plantilla(repo=repo, plantilla_raiz_id=v1.id)
    assert len(historial) == 2
    assert [v.version for v in historial] == [1, 2]


def test_activar_y_reactivar_version_previa():
    repo = RepoMotorPlantillasMemoria()
    def_trabajador = plantilla_defecto_trabajador()

    borrador = crear_plantilla_borrador(repo=repo, nombre="T", codigo_tipo="trabajador", definicion=def_trabajador)
    v1 = publicar_plantilla(repo=repo, plantilla_id=borrador.id, activar=True)
    v2 = publicar_plantilla(repo=repo, plantilla_id=v1.id, activar=True)

    assert v2.activa is True
    assert obtener_plantilla_detalle(repo=repo, plantilla_id=v1.id).activa is False

    # Reactivar v1
    v1_reactivada = activar_plantilla_motor(repo=repo, plantilla_id=v1.id)
    assert v1_reactivada.activa is True
    assert v1_reactivada.version == 1

    # v2 debe quedar inactiva
    assert obtener_plantilla_detalle(repo=repo, plantilla_id=v2.id).activa is False


def test_carnet_emitido_conserva_version_de_plantilla():
    repo = RepoMotorPlantillasMemoria()
    def_trabajador = plantilla_defecto_trabajador()

    borrador = crear_plantilla_borrador(repo=repo, nombre="Oficial", codigo_tipo="trabajador", definicion=def_trabajador)
    v1 = publicar_plantilla(repo=repo, plantilla_id=borrador.id, activar=True)

    # Emitir carnet bajo v1
    carnet_v1 = repo.emitir_carnet("11223344", motivo_id=1, plantilla_id=v1.id)
    assert carnet_v1.plantilla_id == v1.id
    assert carnet_v1.plantilla_version == 1
    assert carnet_v1.plantilla_snapshot is not None

    # Publicar v2 y activarla
    v2 = publicar_plantilla(repo=repo, plantilla_id=v1.id, activar=True)

    # Emitir carnet bajo v2
    carnet_v2 = repo.emitir_carnet("99887766", motivo_id=1, plantilla_id=v2.id)
    assert carnet_v2.plantilla_version == 2

    # El carnet emitido previamente conserva v1 inalterada
    assert carnet_v1.plantilla_version == 1
