import { describe, expect, it, vi } from "vitest";

import type { VersionImagenCintillo } from "../../domain/entities/configuracion-visual";
import type { RepoConfiguracionVisual } from "../../domain/ports/repo-configuracion-visual";
import { listarVersionesImagen, restaurarVersionImagen } from "./gestionar-configuracion-visual";

const version = (id: string, subidoEn: string, esVigente = false): VersionImagenCintillo => ({
  id,
  campo: "logo_principal_clave",
  mime: "image/png",
  tamano: 10,
  subidoEn,
  subidoPorCedula: "V1",
  subidoPorNombre: "Ana Pérez",
  esVigente,
  url: `/v/${id}`,
});

describe("versiones de imagen del cintillo", () => {
  it("lista de la más reciente a la más antigua", async () => {
    const repo = {
      listarVersiones: vi.fn().mockResolvedValue([
        version("a", "2026-11-01T10:00:00Z"),
        version("c", "2026-11-03T10:00:00Z", true),
        version("b", "2026-11-02T10:00:00Z"),
      ]),
    } as unknown as RepoConfiguracionVisual;

    const lista = await listarVersionesImagen(repo, "logo_principal_clave");

    expect(lista.map((v) => v.id)).toEqual(["c", "b", "a"]);
    expect(lista[0].esVigente).toBe(true);
  });

  it("restaurar devuelve la configuración con la URL de la imagen", async () => {
    const restaurarVersion = vi.fn().mockResolvedValue({
      id: 1,
      tipoCintillo: "FIJO",
      nombreEmpresa: "X",
      logoPrincipalClave: "k",
      logoPrincipalUrl: "/api/logo",
      logoSecundarioClave: null,
      logoSecundarioUrl: null,
      cintilloPieClave: null,
      cintilloPieUrl: null,
      colorFondo: null,
      actualizadoPorId: 1,
      actualizadoEn: null,
    });
    const repo = { restaurarVersion } as unknown as RepoConfiguracionVisual;

    const dto = await restaurarVersionImagen(repo, "logo_principal_clave", "id-1");

    expect(restaurarVersion).toHaveBeenCalledWith("logo_principal_clave", "id-1");
    expect(dto.logoPrincipalUrl).toBe("/api/logo");
  });
});
