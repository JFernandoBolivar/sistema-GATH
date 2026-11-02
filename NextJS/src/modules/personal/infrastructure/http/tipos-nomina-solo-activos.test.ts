import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get },
}));

import { autogestionApi } from "../../../autogestion/infrastructure/http/autogestion-api";
import { cargosApi } from "../../../cargos/infrastructure/http/cargos-api";
import { personalApi } from "./personal-api";

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ status: "success", message: "", data: [] });
});

describe("A-12: catálogo de nóminas solo para activos", () => {
  it("cargos (alta, filtros y modal de cargo) pide solo_activos", async () => {
    await cargosApi.getTiposNomina();

    expect(get).toHaveBeenCalledWith("/api/v1/catalogos/tipos-nomina/", {
      params: { solo_activos: true },
    });
  });

  it("personal (filtro y alta) pide solo_activos", async () => {
    await personalApi.getTiposNomina();

    expect(get).toHaveBeenCalledWith("/api/v1/catalogos/tipos-nomina/", {
      params: { solo_activos: true },
    });
  });

  it("censo de vivienda pide solo_activos", async () => {
    await autogestionApi.getNominaGeneral();

    expect(get).toHaveBeenCalledWith("/api/v1/catalogos/tipos-nomina/?solo_activos=true");
  });
});
