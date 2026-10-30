import { describe, expect, it, vi } from "vitest";
import type { RepoFeDeVida } from "../../domain/ports/repo-fe-de-vida";
import { solicitudFake } from "../../domain/services/fixtures-fe-de-vida";
import {
  aprobarDirecto,
  devolverSolicitud,
  listarBandeja,
  rechazarSolicitud,
} from "./gestionar-fe-de-vida-bienestar";
import { subirEvidencia } from "./gestionar-fe-de-vida-pasivo";
import { crearProceso, listarCobertura, prorrogarProceso } from "./gestionar-procesos";
import { normalizarPagina } from "./paginacion";

const pagina = { count: 0, limit: 10, offset: 0, results: [] };
function repoFake(): RepoFeDeVida {
  const s = solicitudFake();
  return {
    listarBandeja: vi.fn().mockResolvedValue(pagina),
    listarCobertura: vi.fn().mockResolvedValue(pagina),
    devolver: vi.fn().mockResolvedValue(s),
    rechazar: vi.fn().mockResolvedValue(s),
    aprobarDirecto: vi.fn().mockResolvedValue(s),
    crearProceso: vi.fn().mockResolvedValue({}),
    prorrogar: vi.fn().mockResolvedValue({}),
    subirEvidencia: vi.fn().mockResolvedValue(s),
  } as unknown as RepoFeDeVida;
}

describe("normalizarPagina", () => {
  it("limita a 1..50 y offset >= 0", () => {
    expect(normalizarPagina()).toEqual({ limit: 10, offset: 0 });
    expect(normalizarPagina(500, -3)).toEqual({ limit: 50, offset: 0 });
    expect(normalizarPagina(0, 20)).toEqual({ limit: 1, offset: 20 });
  });
});

describe("revisión", () => {
  it("devolver, rechazar y aprobar directo exigen texto", async () => {
    const repo = repoFake();
    await expect(devolverSolicitud(repo, "i", "  ", false)).rejects.toThrow(/obligatorio/);
    await expect(rechazarSolicitud(repo, "i", "")).rejects.toThrow(/obligatorio/);
    await expect(aprobarDirecto(repo, "i", " ")).rejects.toThrow(/justificación/i);
    await devolverSolicitud(repo, "i", " Foto borrosa ", true);
    expect(repo.devolver).toHaveBeenCalledWith("i", "Foto borrosa", true);
  });
  it("la bandeja normaliza filtros y valida el rango de fechas", async () => {
    const repo = repoFake();
    await listarBandeja(repo, { texto: " 123 ", estado: "", limit: 999 });
    expect(repo.listarBandeja).toHaveBeenCalledWith(
      expect.objectContaining({ texto: "123", estado: undefined, limit: 50, offset: 0 }),
    );
    await expect(listarBandeja(repo, { desde: "2026-02-01", hasta: "2026-01-01" })).rejects.toThrow(/inválido/);
  });
});

describe("evidencia", () => {
  const archivo = (tipo: string, tam: number) => new File([new Uint8Array(tam)], "f", { type: tipo });
  it("rechaza tipo y tamaño inválidos antes de llamar al servidor", async () => {
    const repo = repoFake();
    await expect(
      subirEvidencia(repo, "i", { archivo: archivo("application/pdf", 10), origen: "ARCHIVO" }),
    ).rejects.toThrow(/JPG o PNG/);
    await expect(
      subirEvidencia(repo, "i", { archivo: archivo("image/png", 6 * 1024 * 1024), origen: "ARCHIVO" }),
    ).rejects.toThrow(/MB/);
    expect(repo.subirEvidencia).not.toHaveBeenCalled();
    await subirEvidencia(repo, "i", { archivo: archivo("image/jpeg", 10), origen: "CAMARA" });
    expect(repo.subirEvidencia).toHaveBeenCalled();
  });
});

describe("procesos y prórrogas", () => {
  const base = {
    nombre: " FV 2026 ",
    apertura: "2026-11-01T08:00",
    cierre: "2026-12-01T08:00",
    tiposNomina: [1, 1, 2],
    diasRecordatorio: [7],
  };
  it("crea con nombre recortado y tipos únicos (vacío = todos)", async () => {
    const repo = repoFake();
    await crearProceso(repo, base);
    expect(repo.crearProceso).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "FV 2026", tiposNomina: [1, 2] }),
    );
  });
  it("exige cierre posterior a la apertura", async () => {
    await expect(crearProceso(repoFake(), { ...base, cierre: base.apertura })).rejects.toThrow(/posterior/);
  });
  it("la prórroga exige fecha y motivo; sin cédula es general", async () => {
    const repo = repoFake();
    await expect(prorrogarProceso(repo, "p", { nuevaFechaLimite: "", motivo: "x" })).rejects.toThrow(/fecha/);
    await expect(
      prorrogarProceso(repo, "p", { nuevaFechaLimite: "2026-12-10T08:00", motivo: " " }),
    ).rejects.toThrow(/obligatorio/);
    await expect(
      prorrogarProceso(repo, "p", { nuevaFechaLimite: "2026-12-10T08:00", motivo: "m", cedula: "abc" }),
    ).rejects.toThrow(/cédula/);
    await prorrogarProceso(repo, "p", { nuevaFechaLimite: "2026-12-10T08:00", motivo: "m", cedula: "" });
    expect(repo.prorrogar).toHaveBeenCalledWith("p", expect.objectContaining({ cedula: undefined }));
  });
  it("la cobertura omite los filtros falsos", async () => {
    const repo = repoFake();
    await listarCobertura(repo, { sinCorreo: false, sinCuenta: true, tipoNominaId: 0 });
    expect(repo.listarCobertura).toHaveBeenCalledWith(
      expect.objectContaining({ sinCorreo: undefined, sinCuenta: true, tipoNominaId: undefined }),
    );
  });
});
