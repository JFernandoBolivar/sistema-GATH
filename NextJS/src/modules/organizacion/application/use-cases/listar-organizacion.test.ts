import { describe, expect, it } from "vitest";
import type { RepoOrganizacion } from "../../domain/ports/repo-organizacion";
import {
  listarCoordinaciones,
  listarDependencias,
  listarDireccionesGenerales,
  listarDireccionesLinea,
  listarOrganismosAdscritos,
} from "./listar-organizacion";

class RepoOrganizacionMemoria implements RepoOrganizacion {
  async listarDependencias() {
    return [{ id: 1, nombre: "Despacho" }];
  }
  async listarDireccionesGenerales(dependenciaId?: number) {
    return [{ id: 10, nombre: "Dirección General de Planificación", dependenciaId: dependenciaId ?? 1 }];
  }
  async listarDireccionesLinea(direccionGeneralId?: number) {
    return [{ id: 20, nombre: "Dirección de TI", direccionGeneralId: direccionGeneralId ?? 10 }];
  }
  async listarCoordinaciones(direccionLineaId?: number) {
    return [{ id: 30, nombre: "Coordinación de Desarrollo", direccionLineaId: direccionLineaId ?? 20 }];
  }
  async listarOrganismosAdscritos() {
    return [{ id: 40, nombre: "CANTV" }];
  }
}

describe("Casos de uso de Organización", () => {
  const repo = new RepoOrganizacionMemoria();

  it("listarDependencias retorna DTOs formateados", async () => {
    const res = await listarDependencias(repo);
    expect(res).toEqual([{ id: 1, nombre: "Despacho" }]);
  });

  it("listarDireccionesGenerales retorna jerarquía correcta", async () => {
    const res = await listarDireccionesGenerales(repo, 1);
    expect(res[0].dependenciaId).toBe(1);
    expect(res[0].nombre).toBe("Dirección General de Planificación");
  });

  it("listarDireccionesLinea retorna jerarquía", async () => {
    const res = await listarDireccionesLinea(repo, 10);
    expect(res[0].direccionGeneralId).toBe(10);
  });

  it("listarCoordinaciones retorna jerarquía", async () => {
    const res = await listarCoordinaciones(repo, 20);
    expect(res[0].direccionLineaId).toBe(20);
  });

  it("listarOrganismosAdscritos retorna lista", async () => {
    const res = await listarOrganismosAdscritos(repo);
    expect(res[0].nombre).toBe("CANTV");
  });
});
