import { beforeEach, describe, expect, it, vi } from "vitest";

const accion = vi.fn();

vi.mock("../actions/personal-actions", () => ({
  getCatalogosExpedienteAction: () => accion(),
}));

import {
  catalogosEnMemoria,
  limpiarCatalogosExpediente,
  obtenerCatalogosExpediente,
} from "./catalogos-expediente-cache";

const CATALOGOS = { estados: [] } as never;

describe("caché compartida de catálogos", () => {
  beforeEach(() => {
    limpiarCatalogosExpediente();
    accion.mockReset();
    accion.mockResolvedValue(CATALOGOS);
  });

  it("deduplica dos peticiones concurrentes en una sola acción", async () => {
    const [primera, segunda] = await Promise.all([
      obtenerCatalogosExpediente(),
      obtenerCatalogosExpediente(),
    ]);

    expect(accion).toHaveBeenCalledTimes(1);
    expect(primera).toBe(CATALOGOS);
    expect(segunda).toBe(CATALOGOS);
  });

  it("reutiliza la caché entre pantallas sin volver a pedir los catálogos", async () => {
    await obtenerCatalogosExpediente();
    await obtenerCatalogosExpediente();
    await obtenerCatalogosExpediente();

    expect(accion).toHaveBeenCalledTimes(1);
    expect(catalogosEnMemoria()).toBe(CATALOGOS);
  });

  it("vuelve a pedirlos después de invalidar la caché", async () => {
    await obtenerCatalogosExpediente();
    limpiarCatalogosExpediente();
    await obtenerCatalogosExpediente();

    expect(accion).toHaveBeenCalledTimes(2);
  });
});
