import { describe, expect, it } from "vitest";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import type { Carnet, PlantillaCarnet } from "../../domain/entities/carnet";
import { emitirCarnet, listarCarnets } from "./emitir-carnet";
import { validarCarnetPorHash } from "./validar-qr";

class RepoCarnetizacionMemoria implements RepoCarnetizacion {
  carnets: Carnet[] = [
    {
      id: 1,
      empleadoCedula: "12345678",
      empleadoNombres: "Pedro",
      empleadoApellidos: "Pérez",
      securityHash: "hash-abc-123",
      fechaEmision: "2026-01-01",
      motivoId: 1,
      motivoNombre: "Ingreso",
      activo: true,
      observaciones: null,
    },
  ];
  plantillas: PlantillaCarnet[] = [];

  async listarCarnets(cedula?: string) {
    return cedula ? this.carnets.filter((c) => c.empleadoCedula === cedula) : this.carnets;
  }
  async emitirCarnet(empleadoCedula: string, motivoId: number, observaciones?: string) {
    const c: Carnet = {
      id: 2,
      empleadoCedula,
      empleadoNombres: "Nuevo",
      empleadoApellidos: "Empleado",
      securityHash: "hash-new-456",
      fechaEmision: "2026-08-01",
      motivoId,
      motivoNombre: "Reposición",
      activo: true,
      observaciones: observaciones ?? null,
    };
    this.carnets.push(c);
    return c;
  }
  async validarPorHash(securityHash: string) {
    const carnet = this.carnets.find((c) => c.securityHash === securityHash);
    if (!carnet) return { esValido: false, mensaje: "Carnet no encontrado", carnet: null };
    return { esValido: carnet.activo, mensaje: "Carnet válido", carnet };
  }
  async validarPorId(carnetId: number) {
    const carnet = this.carnets.find((c) => c.id === carnetId);
    if (!carnet) return { esValido: false, mensaje: "Carnet no encontrado", carnet: null };
    return { esValido: carnet.activo, mensaje: "Carnet válido", carnet };
  }
  async listarPlantillas() {
    return this.plantillas;
  }
  async activarPlantilla(plantillaId: number) {
    const p = this.plantillas.find((x) => x.id === plantillaId)!;
    p.activo = true;
    return p;
  }
  async descargarPdf(_carnetId: number) {
    return new Blob(["%PDF-simulado"], { type: "application/pdf" });
  }
}

describe("Casos de uso de Carnetización", () => {
  it("listarCarnets y emitirCarnet operan sobre el dominio", async () => {
    const repo = new RepoCarnetizacionMemoria();
    const lista = await listarCarnets(repo);
    expect(lista.length).toBe(1);

    const nuevo = await emitirCarnet(repo, "87654321", 2, "Carnet de reposición");
    expect(nuevo.empleadoCedula).toBe("87654321");
    expect(nuevo.activo).toBe(true);
  });

  it("validarCarnetPorHash verifica autenticidad del carnet", async () => {
    const repo = new RepoCarnetizacionMemoria();
    const resValido = await validarCarnetPorHash(repo, "hash-abc-123");
    expect(resValido.esValido).toBe(true);
    expect(resValido.carnet?.empleadoNombres).toBe("Pedro");

    const resInvalido = await validarCarnetPorHash(repo, "hash-falso");
    expect(resInvalido.esValido).toBe(false);
    expect(resInvalido.carnet).toBeNull();
  });
});
