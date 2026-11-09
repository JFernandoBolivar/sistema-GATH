import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post, put, postForm } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  postForm: vi.fn(),
}));

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get, post, put, postForm },
}));

import { familiaresApi, type FamiliarApiItem } from "./familiares-api";

const FAMILIAR: FamiliarApiItem = {
  id: 7,
  empleado_cedula: "12345678",
  cedula_familiar: "87654321",
  primer_nombre: "MARÍA",
  segundo_nombre: null,
  primer_apellido: "PÉREZ",
  segundo_apellido: null,
  parentesco_id: 1,
  parentesco_nombre: "HIJO(A)",
  fecha_nacimiento: "2010-01-01",
  sexo_id: 2,
  sexo_nombre: "FEMENINO",
  mismo_ente: false,
  heredero: true,
  observaciones: null,
};

/** Sobre C-1 real del backend. */
const sobre = <T,>(data: T) => ({
  status: "success",
  message: "Operación exitosa.",
  data,
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  postForm.mockReset();
});

describe("familiaresApi desenvuelve el sobre C-1", () => {
  it("getPorEmpleado devuelve la lista, no el sobre", async () => {
    get.mockResolvedValue(sobre([FAMILIAR]));

    const resultado = await familiaresApi.getPorEmpleado("12345678");

    expect(get).toHaveBeenCalledWith("/api/v1/familiares/empleado/12345678/");
    expect(Array.isArray(resultado)).toBe(true);
    expect(resultado).toEqual([FAMILIAR]);
  });

  it("getPorId, crear y actualizar devuelven el familiar", async () => {
    get.mockResolvedValue(sobre(FAMILIAR));
    post.mockResolvedValue(sobre(FAMILIAR));
    put.mockResolvedValue(sobre(FAMILIAR));

    expect(await familiaresApi.getPorId(7)).toEqual(FAMILIAR);
    expect(await familiaresApi.crear("12345678", {})).toEqual(FAMILIAR);
    expect(await familiaresApi.actualizar(7, {})).toEqual(FAMILIAR);
  });

  it("getDocumentos devuelve la lista de documentos", async () => {
    const documento = {
      id: 1,
      familiar_id: 7,
      tipo_documento: "PARTIDA",
      ruta_archivo: "a/b.pdf",
      fecha_subida: "2026-01-01T00:00:00Z",
    };
    get.mockResolvedValue(sobre([documento]));

    expect(await familiaresApi.getDocumentos(7)).toEqual([documento]);
  });
});
