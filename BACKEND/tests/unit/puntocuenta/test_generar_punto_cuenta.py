"""
Tests unitarios de Punto de Cuenta. Puros, sin BD: repositorio en memoria
implementando el puerto `RepoPuntoCuenta`.
"""
from apps.puntocuenta.application.use_cases.generar_punto_cuenta import (
    adjuntar_documento_punto_cuenta,
    generar_punto_cuenta,
    listar_puntos_cuenta,
    obtener_punto_cuenta,
)
from apps.puntocuenta.domain.entities.punto_cuenta import PuntoCuenta


class RepoPuntoCuentaMemoria:
    def __init__(self):
        self.filas: dict[int, PuntoCuenta] = {}
        self.siguiente_id = 1

    def crear(self, *, cargo_id, cedula, dependencia_origen_id, dependencia_destino_id, motivo_id, usuario_id):
        entidad = PuntoCuenta(
            id=self.siguiente_id,
            cargo_id=cargo_id,
            empleado_cedula=cedula,
            empleado_nombre="EMPLEADO DE PRUEBA",
            dependencia_origen_id=dependencia_origen_id,
            dependencia_origen_nombre="DEPENDENCIA ORIGEN",
            dependencia_destino_id=dependencia_destino_id,
            dependencia_destino_nombre="DEPENDENCIA DESTINO",
            motivo_id=motivo_id,
            motivo_nombre="TRASLADO" if motivo_id else None,
            usuario_id=usuario_id,
            fecha="2026-01-15T10:00:00+00:00",
            documento_pdf_clave=None,
        )
        self.filas[entidad.id] = entidad
        self.siguiente_id += 1
        return entidad

    def adjuntar_documento(self, id, clave):
        from dataclasses import replace
        self.filas[id] = replace(self.filas[id], documento_pdf_clave=clave)
        return self.filas[id]

    def listar(self):
        return list(self.filas.values())

    def obtener_por_id(self, id):
        return self.filas.get(id)


def test_generar_punto_cuenta_crea_el_registro_sin_documento_todavia():
    repo = RepoPuntoCuentaMemoria()
    dto = generar_punto_cuenta(
        repo,
        cargo_id=10,
        cedula="12345678",
        dependencia_origen_id=1,
        dependencia_destino_id=2,
        motivo_id=5,
        usuario_id=99,
    )
    assert dto.id == 1
    assert dto.dependencia_origen_id == 1
    assert dto.dependencia_destino_id == 2
    assert dto.documento_generado is False
    assert dto.documento_pdf_clave is None


def test_adjuntar_documento_marca_documento_generado():
    repo = RepoPuntoCuentaMemoria()
    dto = generar_punto_cuenta(
        repo, cargo_id=10, cedula="12345678", dependencia_origen_id=1,
        dependencia_destino_id=2, motivo_id=5, usuario_id=99,
    )
    dto_con_pdf = adjuntar_documento_punto_cuenta(repo, dto.id, "puntocuenta/1.pdf")
    assert dto_con_pdf.documento_generado is True
    assert dto_con_pdf.documento_pdf_clave == "puntocuenta/1.pdf"


def test_listar_puntos_cuenta():
    repo = RepoPuntoCuentaMemoria()
    generar_punto_cuenta(repo, cargo_id=10, cedula="111", dependencia_origen_id=1, dependencia_destino_id=2, motivo_id=None, usuario_id=1)
    generar_punto_cuenta(repo, cargo_id=11, cedula="222", dependencia_origen_id=2, dependencia_destino_id=3, motivo_id=None, usuario_id=1)
    assert len(listar_puntos_cuenta(repo)) == 2


def test_obtener_punto_cuenta_inexistente_devuelve_none():
    repo = RepoPuntoCuentaMemoria()
    assert obtener_punto_cuenta(repo, 999) is None
