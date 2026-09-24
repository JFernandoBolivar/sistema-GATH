import { describe, expect, it } from "vitest";
import type { RepoFamiliares } from "../../domain/ports/repo-familiares";
import type { Familiar } from "../../domain/entities/familiar";
import { actualizarFamiliar, crearFamiliar, eliminarFamiliar } from "./gestionar-familiar";
import { listarFamiliaresPorEmpleado } from "./listar-familiares";

class RepoFamiliaresMemoria implements RepoFamiliares {
  familiares: Familiar[] = [
    {
      id: 1,
      empleadoCedula: "12345678",
      cedulaFamiliar: "87654321",
      primerNombre: "María",
      segundoNombre: null,
      primerApellido: "Pérez",
      segundoApellido: null,
      parentescoId: 1,
      parentescoNombre: "HIJO(A)",
      fechaNacimiento: "2015-05-10",
      sexoId: 2,
      sexoNombre: "FEMENINO",
      mismoEnte: false,
      heredero: true,
      observaciones: null,
    },
  ];

  async listarPorEmpleado(cedula: string) {
    return this.familiares.filter((f) => f.empleadoCedula === cedula);
  }
  async obtenerPorId(id: number) {
    return this.familiares.find((f) => f.id === id)!;
  }
  async crearFamiliar(data: any) {
    const f: Familiar = {
      id: 2,
      ...data,
      parentescoNombre: "HIJO(A)",
      sexoNombre: "MASCULINO",
    };
    this.familiares.push(f);
    return f;
  }
  async actualizarFamiliar(id: number, data: any) {
    const f = this.familiares.find((x) => x.id === id)!;
    Object.assign(f, data);
    return f;
  }
  async eliminarFamiliar(id: number) {
    this.familiares = this.familiares.filter((x) => x.id !== id);
  }
  async listarDocumentos() {
    return [];
  }
  async subirDocumento(familiarId: number, tipoDocumento: "cedula" | "partida_nacimiento") {
    return {
      id: 1,
      familiarId,
      tipoDocumento,
      rutaArchivo: "https://example.com/doc.pdf",
      fechaSubida: "2026-01-01",
    };
  }

  async listarCatalogos() {
    return {
      parentescos: [],
      sexos: [],
      nivelesAcademicos: [],
      carreras: [],
      menciones: [],
      instituciones: [],
      tiposPrenda: [],
      tallas: [],
      gruposSanguineos: [],
      alergias: [],
      patologias: [],
      discapacidades: [],
    };
  }
}

describe("Casos de uso de Cargas Familiares", () => {
  it("listarFamiliaresPorEmpleado retorna familiares del trabajador", async () => {
    const repo = new RepoFamiliaresMemoria();
    const res = await listarFamiliaresPorEmpleado(repo, "12345678");
    expect(res.length).toBe(1);
    expect(res[0].primerNombre).toBe("María");
  });

  it("crearFamiliar y actualizarFamiliar operan sobre DTOs", async () => {
    const repo = new RepoFamiliaresMemoria();
    const nuevo = await crearFamiliar(repo, {
      empleadoCedula: "12345678",
      primerNombre: "Pedro",
      primerApellido: "Pérez",
      parentescoId: 1,
      fechaNacimiento: "2018-01-01",
      sexoId: 1,
      mismoEnte: false,
      heredero: true,
    });
    expect(nuevo.primerNombre).toBe("Pedro");

    const editado = await actualizarFamiliar(repo, nuevo.id, { primerNombre: "Pedro José" });
    expect(editado.primerNombre).toBe("Pedro José");
  });

  it("eliminarFamiliar borra el registro", async () => {
    const repo = new RepoFamiliaresMemoria();
    await eliminarFamiliar(repo, 1);
    const res = await listarFamiliaresPorEmpleado(repo, "12345678");
    expect(res.length).toBe(0);
  });

  it("listarCatalogosFamiliar mapea todos los catálogos requeridos", async () => {
    const { listarCatalogosFamiliar } = await import("./listar-catalogos-familiar");
    const repo = new RepoFamiliaresMemoria();
    const cats = await listarCatalogosFamiliar(repo);
    expect(cats).toHaveProperty("parentescos");
    expect(cats).toHaveProperty("sexos");
    expect(cats).toHaveProperty("patologias");
    expect(cats).toHaveProperty("tallas");
    expect(cats).toHaveProperty("alergias");
    expect(cats).toHaveProperty("discapacidades");
    expect(cats).toHaveProperty("gruposSanguineos");
    expect(cats).toHaveProperty("nivelesAcademicos");
  });
});
