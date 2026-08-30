import { describe, expect, it } from "vitest";
import type { RepoCatalogos } from "../../domain/ports/repo-catalogos";
import {
  listarEstados,
  listarMunicipios,
  listarParentescos,
  listarRegiones,
  listarSexos,
  listarCategoriasMovimiento,
  listarTiposMovimiento,
} from "./listar-catalogos";

class RepoCatalogosMemoria implements RepoCatalogos {
  async listarRegiones() {
    return [{ id: 1, nombre: "Capital" }];
  }
  async listarEstados(regionId?: number) {
    return [{ id: 10, nombre: "Distrito Capital", regionId: regionId ?? 1 }];
  }
  async listarMunicipios(estadoId?: number) {
    return [{ id: 100, nombre: "Libertador", estadoId: estadoId ?? 10 }];
  }
  async listarParroquias() {
    return [];
  }
  async listarSexos() {
    return [{ id: 1, nombre: "MASCULINO" }, { id: 2, nombre: "FEMENINO" }];
  }
  async listarEstatus() {
    return [{ id: 1, nombre: "ACTIVO" }];
  }
  async listarTiposPersonal() {
    return [{ id: 1, nombre: "EMPLEADO FIJO" }];
  }
  async listarTiposNomina() {
    return [{ id: 1, nombre: "ALTO NIVEL" }];
  }
  async listarParentescos() {
    return [{ id: 1, nombre: "HIJO(A)" }];
  }
  async listarTiposProcedencia() {
    return [{ id: 1, nombre: "NUEVO INGRESO" }];
  }
  async listarGrados() {
    return [{ id: 1, nombre: "LICENCIATURA" }];
  }
  async listarCategoriasMovimiento() {
    return [{ id: 1, nombre: "MOVIMIENTO DE PERSONAL" }];
  }
  async listarTiposMovimiento() {
    return [{ id: 1, nombre: "TRANSFERENCIA" }];
  }
  async listarEstadosCiviles() {
    return [{ id: 1, nombre: "SOLTERO(A)" }];
  }
  async listarPoliticas() {
    return [{ id: 1, nombre: "POLITICA DE CONTRATACION" }];
  }
  async listarCondicionesVivienda() {
    return [{ id: 1, nombre: "PROPIA" }];
  }
  async listarCodigosPostales() {
    return [{ id: 1, nombre: "1010" }];
  }
  async listarGruposSanguineos() {
    return [{ id: 1, nombre: "O+" }];
  }
  async listarNivelesAcademicos() {
    return [{ id: 1, nombre: "LICENCIATURA" }];
  }
  async listarCarreras() {
    return [{ id: 1, nombre: "INGENIERIA" }];
  }
  async listarMenciones() {
    return [{ id: 1, nombre: "SISTEMAS" }];
  }
  async listarInstituciones() {
    return [{ id: 1, nombre: "UNIVERSIDAD CENTRAL" }];
  }
  async listarTiposPrenda() {
    return [{ id: 1, nombre: "CAMISA" }];
  }
  async listarRegionesTalla() {
    return [{ id: 1, nombre: "ADULTO" }];
  }
  async listarTallas() {
    return [{ id: 1, nombre: "M" }];
  }
  async listarCapacitaciones() {
    return [{ id: 1, nombre: "CURSO DE LIDERAZGO" }];
  }
  async listarGruposCapacitacion() {
    return [{ id: 1, nombre: "GRUPO A" }];
  }
  async listarAlergias() {
    return [{ id: 1, nombre: "POLEN" }];
  }
  async listarPatologias() {
    return [{ id: 1, nombre: "ASMA" }];
  }
  async listarDiscapacidades() {
    return [{ id: 1, nombre: "MOTORA" }];
  }
}

describe("Casos de uso de Catálogos", () => {
  const repo = new RepoCatalogosMemoria();

  it("listarRegiones retorna lista DTO", async () => {
    const res = await listarRegiones(repo);
    expect(res).toEqual([{ id: 1, nombre: "Capital" }]);
  });

  it("listarEstados retorna estados con regionId", async () => {
    const res = await listarEstados(repo, 1);
    expect(res[0].regionId).toBe(1);
    expect(res[0].nombre).toBe("Distrito Capital");
  });

  it("listarMunicipios retorna municipios", async () => {
    const res = await listarMunicipios(repo, 10);
    expect(res[0].estadoId).toBe(10);
  });

  it("listarSexos y listarParentescos retornan catálogos maestros", async () => {
    const sexos = await listarSexos(repo);
    expect(sexos.length).toBe(2);

    const parentescos = await listarParentescos(repo);
    expect(parentescos[0].nombre).toBe("HIJO(A)");
  });

  it("listarCategoriasMovimiento y listarTiposMovimiento retornan catálogos", async () => {
    const categorias = await listarCategoriasMovimiento(repo);
    expect(categorias[0].nombre).toBe("MOVIMIENTO DE PERSONAL");

    const tipos = await listarTiposMovimiento(repo);
    expect(tipos[0].nombre).toBe("TRANSFERENCIA");
  });
});
