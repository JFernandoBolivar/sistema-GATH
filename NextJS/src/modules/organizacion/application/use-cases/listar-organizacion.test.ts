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
    return [{ id: 1, codigo: "DEP-01", nombre: "Despacho" }];
  }
  async listarDireccionesGenerales(dependenciaId?: number) {
    return [{ id: 10, codigo: "DG-01", nombre: "Dirección General de Planificación", dependenciaId: dependenciaId ?? 1 }];
  }
  async listarDireccionesLinea(direccionGeneralId?: number) {
    return [{ id: 20, codigo: "DL-01", nombre: "Dirección de TI", direccionGeneralId: direccionGeneralId ?? 10 }];
  }
  async listarCoordinaciones(direccionLineaId?: number) {
    return [{ id: 30, codigo: "COORD-01", nombre: "Coordinación de Desarrollo", direccionLineaId: direccionLineaId ?? 20 }];
  }
  async listarOrganismosAdscritos() {
    return [{ id: 40, nombre: "CANTV" }];
  }
  async crearDependencia(data: { codigo: string; nombre: string }) {
    return { id: 1, codigo: data.codigo, nombre: data.nombre };
  }
  async actualizarDependencia(id: number, data: { codigo: string; nombre: string }) {
    return { id, codigo: data.codigo, nombre: data.nombre };
  }
  async eliminarDependencia(_id: number) {
    return;
  }
  async crearDireccionGeneral(data: { codigo: string; nombre: string; dependenciaId: number | null }) {
    return { id: 10, codigo: data.codigo, nombre: data.nombre, dependenciaId: data.dependenciaId };
  }
  async actualizarDireccionGeneral(id: number, data: { codigo: string; nombre: string; dependenciaId: number | null }) {
    return { id, codigo: data.codigo, nombre: data.nombre, dependenciaId: data.dependenciaId };
  }
  async eliminarDireccionGeneral(_id: number) {
    return;
  }
  async crearDireccionLinea(data: { codigo: string; nombre: string; direccionGeneralId: number | null }) {
    return { id: 20, codigo: data.codigo, nombre: data.nombre, direccionGeneralId: data.direccionGeneralId };
  }
  async actualizarDireccionLinea(id: number, data: { codigo: string; nombre: string; direccionGeneralId: number | null }) {
    return { id, codigo: data.codigo, nombre: data.nombre, direccionGeneralId: data.direccionGeneralId };
  }
  async eliminarDireccionLinea(_id: number) {
    return;
  }
  async crearCoordinacion(data: { codigo: string; nombre: string; direccionLineaId: number | null }) {
    return { id: 30, codigo: data.codigo, nombre: data.nombre, direccionLineaId: data.direccionLineaId };
  }
  async actualizarCoordinacion(id: number, data: { codigo: string; nombre: string; direccionLineaId: number | null }) {
    return { id, codigo: data.codigo, nombre: data.nombre, direccionLineaId: data.direccionLineaId };
  }
  async eliminarCoordinacion(_id: number) {
    return;
  }
  async crearOrganismoAdscrito(data: { nombre: string; parentId: number | null }) {
    return { id: 40, nombre: data.nombre };
  }
  async actualizarOrganismoAdscrito(id: number, data: { nombre: string; parentId: number | null }) {
    return { id, nombre: data.nombre };
  }
  async eliminarOrganismoAdscrito(_id: number) {
    return;
  }
}

describe("Casos de uso de Organización", () => {
  const repo = new RepoOrganizacionMemoria();

  it("listarDependencias retorna DTOs formateados", async () => {
    const res = await listarDependencias(repo);
    expect(res).toEqual([{ id: 1, codigo: "DEP-01", nombre: "Despacho" }]);
  });

  it("listarDireccionesGenerales retorna jerarquía correcta", async () => {
    const res = await listarDireccionesGenerales(repo, 1);
    expect(res[0].dependenciaId).toBe(1);
    expect(res[0].codigo).toBe("DG-01");
    expect(res[0].nombre).toBe("Dirección General de Planificación");
  });

  it("listarDireccionesLinea retorna jerarquía", async () => {
    const res = await listarDireccionesLinea(repo, 10);
    expect(res[0].direccionGeneralId).toBe(10);
    expect(res[0].codigo).toBe("DL-01");
  });

  it("listarCoordinaciones retorna jerarquía", async () => {
    const res = await listarCoordinaciones(repo, 20);
    expect(res[0].direccionLineaId).toBe(20);
    expect(res[0].codigo).toBe("COORD-01");
  });

  it("listarOrganismosAdscritos retorna lista", async () => {
    const res = await listarOrganismosAdscritos(repo);
    expect(res[0].nombre).toBe("CANTV");
  });
});
