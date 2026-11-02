import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEmpleados } = vi.hoisted(() => ({ getEmpleados: vi.fn() }));

// Se mockea el cliente HTTP (server-only) para probar solo el consumidor.
vi.mock("../http/personal-api", () => ({
  personalApi: { getEmpleados },
}));

import { repoPersonalApi } from "./repo-personal-api";

const FILA = {
  id: 1,
  cedula: "12345678",
  nombres: "JOSÉ",
  apellidos: "PÉREZ",
  nombre_completo: "JOSÉ PÉREZ",
  sexo_id: 1,
  sexo_nombre: "MASCULINO",
  fecha_nacimiento: "1990-01-01",
  contrato_actual: null,
};

beforeEach(() => getEmpleados.mockReset());

describe("repoPersonalApi.listarEmpleados", () => {
  it("pide la página al servidor y desenvuelve results/total", async () => {
    getEmpleados.mockResolvedValue({
      results: [FILA],
      total: 42,
      page: 2,
      page_size: 10,
    });

    const pagina = await repoPersonalApi.listarEmpleados({
      busqueda: "Pérez",
      page: 2,
      pageSize: 10,
    });

    expect(getEmpleados).toHaveBeenCalledWith(
      expect.objectContaining({ q: "Pérez", page: 2, page_size: 10 }),
    );
    expect(pagina.total).toBe(42);
    expect(pagina.page).toBe(2);
    expect(pagina.pageSize).toBe(10);
    expect(pagina.items).toHaveLength(1);
    expect(pagina.items[0].cedula).toBe("12345678");
  });

  it("usa página 1 y tamaño 10 por defecto", async () => {
    getEmpleados.mockResolvedValue({
      results: [],
      total: 0,
      page: 1,
      page_size: 10,
    });

    await repoPersonalApi.listarEmpleados();

    expect(getEmpleados).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 10 }),
    );
  });
});
