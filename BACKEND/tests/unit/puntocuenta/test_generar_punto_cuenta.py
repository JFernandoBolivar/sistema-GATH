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

    def crear(self, *, cargo_id, cedula, dependencia_origen_id, dependencia_destino_id, motivo_id, usuario_id,
              oficina_origen_id=None, oficina_destino_id=None, **kwargs):
        division_origen_id = kwargs.get('division_origen_id')
        division_destino_id = kwargs.get('division_destino_id')
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
            oficina_origen_id=oficina_origen_id,
            oficina_origen_nombre="OFICINA ORIGEN" if oficina_origen_id else None,
            oficina_destino_id=oficina_destino_id,
            oficina_destino_nombre="OFICINA DESTINO" if oficina_destino_id else None,
            division_origen_id=division_origen_id,
            division_origen_nombre="DIVISION ORIGEN" if division_origen_id else None,
            division_destino_id=division_destino_id,
            division_destino_nombre="DIVISION DESTINO" if division_destino_id else None,
            numero=kwargs.get('numero'),
            anio=kwargs.get('anio'),
            secuencia=kwargs.get('secuencia'),
            configuracion_version=kwargs.get('configuracion_version'),
            snapshot_formato=kwargs.get('snapshot_formato'),
        )
        self.filas[entidad.id] = entidad
        self.siguiente_id += 1
        return entidad

    def adjuntar_documento(self, id, clave):
        from dataclasses import replace
        key = int(id) if str(id).isdigit() else id
        self.filas[key] = replace(self.filas[key], documento_pdf_clave=clave)
        return self.filas[key]

    def listar(self, filtros=None):
        return list(self.filas.values())

    def obtener_por_id(self, id):
        key = int(id) if str(id).isdigit() else id
        return self.filas.get(key)


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
    assert str(dto.id) == "1"
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


def test_generar_punto_cuenta_expone_las_oficinas_ademas_del_nivel():
    repo = RepoPuntoCuentaMemoria()
    dto = generar_punto_cuenta(
        repo, cargo_id=10, cedula="123", dependencia_origen_id=1, dependencia_destino_id=1,
        oficina_origen_id=7, oficina_destino_id=8, motivo_id=None, usuario_id=1,
    )
    assert dto.oficina_origen == "OFICINA ORIGEN"
    assert dto.oficina_destino == "OFICINA DESTINO"
    assert dto.oficina_origen_id == 7 and dto.oficina_destino_id == 8
