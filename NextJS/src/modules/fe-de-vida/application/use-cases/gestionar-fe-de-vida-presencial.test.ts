import { describe, expect, it, vi } from "vitest";
import type { RepoFeDeVida } from "../../domain/ports/repo-fe-de-vida";
import { solicitudFake } from "../../domain/services/fixtures-fe-de-vida";
import {
  buscarPasivosPresencial,
  descargarConstanciaBienestar,
  enviarPresencial,
  guardarBorradorPresencial,
  iniciarSolicitudPresencial,
  subirEvidenciaPresencial,
} from "./gestionar-fe-de-vida-presencial";

const pagina = { count: 0, limit: 10, offset: 0, results: [] };

function repoFake(): RepoFeDeVida {
  const s = solicitudFake();
  return {
    buscarPasivosPresencial: vi.fn().mockResolvedValue(pagina),
    iniciarSolicitudPresencial: vi.fn().mockResolvedValue({
      solicitud: s,
      cambios: [],
      ficha: {},
    }),
    guardarBorradorPresencial: vi.fn().mockResolvedValue({ solicitud: s, cambios: [] }),
    subirEvidenciaPresencial: vi.fn().mockResolvedValue(s),
    enviarPresencial: vi.fn().mockResolvedValue(s),
    descargarConstanciaBienestar: vi.fn().mockResolvedValue(new Blob()),
  } as unknown as RepoFeDeVida;
}

describe("gestionar-fe-de-vida-presencial", () => {
  it("buscarPasivosPresencial normaliza paginación y texto", async () => {
    const repo = repoFake();
    await buscarPasivosPresencial(repo, { texto: "  123456  ", limit: 999, offset: -5 });
    expect(repo.buscarPasivosPresencial).toHaveBeenCalledWith({
      texto: "123456",
      limit: 50,
      offset: 0,
    });
  });

  it("iniciarSolicitudPresencial recorta la cédula", async () => {
    const repo = repoFake();
    await iniciarSolicitudPresencial(repo, "  V-12345678  ");
    expect(repo.iniciarSolicitudPresencial).toHaveBeenCalledWith("V-12345678");
  });

  it("subirEvidenciaPresencial valida tipo y tamaño de archivo", async () => {
    const repo = repoFake();
    const archivoInvalido = new File([new Uint8Array(10)], "doc.pdf", { type: "application/pdf" });
    await expect(
      subirEvidenciaPresencial(repo, "sol-1", { archivo: archivoInvalido, origen: "ARCHIVO" }),
    ).rejects.toThrow(/JPG o PNG/);

    const archivoGigante = new File([new Uint8Array(6 * 1024 * 1024)], "foto.jpg", {
      type: "image/jpeg",
    });
    await expect(
      subirEvidenciaPresencial(repo, "sol-1", { archivo: archivoGigante, origen: "CAMARA" }),
    ).rejects.toThrow(/supera el tamaño máximo/);

    const archivoOk = new File([new Uint8Array(100)], "foto.jpg", { type: "image/jpeg" });
    await subirEvidenciaPresencial(repo, "sol-1", { archivo: archivoOk, origen: "CAMARA" });
    expect(repo.subirEvidenciaPresencial).toHaveBeenCalled();
  });

  it("guardarBorradorPresencial, enviarPresencial y descargarConstanciaBienestar delegan al repo", async () => {
    const repo = repoFake();
    const cambios = [{ seccion: "contacto", entidad: "employee", accion: "MODIFICAR", campo: "correo", valor: "a@b.com" }];
    await guardarBorradorPresencial(repo, "sol-1", cambios);
    expect(repo.guardarBorradorPresencial).toHaveBeenCalledWith("sol-1", cambios);

    await enviarPresencial(repo, "sol-1");
    expect(repo.enviarPresencial).toHaveBeenCalledWith("sol-1");

    await descargarConstanciaBienestar(repo, "sol-1");
    expect(repo.descargarConstanciaBienestar).toHaveBeenCalledWith("sol-1");
  });
});
