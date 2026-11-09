import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, patch, post, del } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get, patch, post, delete: del },
}));

import { reglasCatalogosApi } from "../infrastructure/http/reglas-catalogos-api";

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  post.mockReset();
  del.mockReset();
});

describe("Módulo Configuración - Reglas de Catálogos (A5)", () => {
  it("API client obtiene todas las reglas de catálogos", async () => {
    get.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        parentescos: [{ id: 1, descripcion: "HIJO(A)", aplica_familiar: true }],
        categorias_motivo: [{ id: 1, categoria: "INGRESO" }],
        motivos: [
          {
            id: 10,
            movimiento: "NUEVO INGRESO",
            categoria_id: 1,
            categoria_nombre: "INGRESO",
            es_reservado: false,
          },
        ],
        nominas: [{ id: 1, nomina: "EMPLEADOS", requiere_codig: true, es_activo: true }],
      },
    });

    const resultado = await reglasCatalogosApi.obtenerTodas();
    expect(get).toHaveBeenCalledWith("/api/v1/configuracion/reglas-catalogos/");
    expect(resultado.data.parentescos).toHaveLength(1);
    expect(resultado.data.motivos).toHaveLength(1);
    expect(resultado.data.nominas).toHaveLength(1);
  });

  it("API client actualiza marca de parentesco", async () => {
    patch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: 1, descripcion: "HIJO(A)", aplica_familiar: false },
    });

    const res = await reglasCatalogosApi.actualizarParentesco(1, { aplica_familiar: false });
    expect(patch).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/parentescos/1/",
      { aplica_familiar: false },
    );
    expect(res.data.aplica_familiar).toBe(false);
  });

  it("API client transfiere motivo a nueva categoría", async () => {
    patch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: 10,
        movimiento: "NUEVO INGRESO",
        categoria_id: 2,
        categoria_nombre: "TRASLADO",
        es_reservado: false,
      },
    });

    const res = await reglasCatalogosApi.cambiarCategoriaMotivo(10, 2);
    expect(patch).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/motivos/10/categoria/",
      { categoria_id: 2 },
    );
    expect(res.data.categoria_id).toBe(2);
  });

  it("API client crea nuevo motivo en una categoría", async () => {
    post.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: 20,
        movimiento: "CONTRATO DETERMINADO",
        categoria_id: 1,
        categoria_nombre: "INGRESO",
        es_reservado: false,
      },
    });

    const res = await reglasCatalogosApi.crearMotivo("CONTRATO DETERMINADO", 1);
    expect(post).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/motivos/",
      { movimiento: "CONTRATO DETERMINADO", categoria_id: 1 },
    );
    expect(res.data.id).toBe(20);
  });

  it("API client actualiza marcas de tipo de nómina", async () => {
    patch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: 1, nomina: "EMPLEADOS", requiere_codig: false, es_activo: true },
    });

    const res = await reglasCatalogosApi.actualizarNomina(1, { requiere_codig: false });
    expect(patch).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/nominas/1/",
      { requiere_codig: false },
    );
    expect(res.data.requiere_codig).toBe(false);
  });

  it("API client actualiza motivo completo (nombre, categoría y estado activo)", async () => {
    patch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: 15,
        movimiento: "DESTITUCION DISCIPLINARIA",
        categoria_id: 3,
        categoria_nombre: "EGRESO",
        es_reservado: false,
        activo: false,
      },
    });

    const res = await reglasCatalogosApi.actualizarMotivo(15, {
      movimiento: "DESTITUCION DISCIPLINARIA",
      activo: false,
    });
    expect(patch).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/motivos/15/",
      { movimiento: "DESTITUCION DISCIPLINARIA", activo: false },
    );
    expect(res.data.movimiento).toBe("DESTITUCION DISCIPLINARIA");
    expect(res.data.activo).toBe(false);
  });

  it("API client elimina motivo de movimiento", async () => {
    del.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: 15,
        movimiento: "MOTIVO OBSOLETO",
        categoria_id: 1,
        categoria_nombre: "INGRESO",
        es_reservado: false,
        activo: true,
      },
    });

    const res = await reglasCatalogosApi.eliminarMotivo(15);
    expect(del).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/motivos/15/",
    );
    expect(res.data.id).toBe(15);
  });

  it("API client crea un parentesco (O36)", async () => {
    post.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: 9, descripcion: "PRIMO HERMANO", aplica_familiar: true },
    });

    const res = await reglasCatalogosApi.crearParentesco("PRIMO HERMANO", true);
    expect(post).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/parentescos/",
      { descripcion: "PRIMO HERMANO", aplica_familiar: true },
    );
    expect(res.data.id).toBe(9);
  });

  it("API client edita y elimina un parentesco (O36)", async () => {
    patch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: 9, descripcion: "PRIMO", aplica_familiar: false },
    });
    del.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: 9, descripcion: "PRIMO", aplica_familiar: false },
    });

    await reglasCatalogosApi.actualizarParentesco(9, { descripcion: "PRIMO", aplica_familiar: false });
    await reglasCatalogosApi.eliminarParentesco(9);

    expect(patch).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/parentescos/9/",
      { descripcion: "PRIMO", aplica_familiar: false },
    );
    expect(del).toHaveBeenCalledWith("/api/v1/configuracion/reglas-catalogos/parentescos/9/");
  });

  it("API client crea y elimina un tipo de nómina (O36)", async () => {
    post.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: 8, nomina: "CONTRATO NUEVO", requiere_codig: true, es_activo: false },
    });
    del.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: 8, nomina: "CONTRATO NUEVO", requiere_codig: true, es_activo: false },
    });

    await reglasCatalogosApi.crearNomina("CONTRATO NUEVO", false, true);
    await reglasCatalogosApi.eliminarNomina(8);

    expect(post).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/nominas/",
      { nomina: "CONTRATO NUEVO", es_activo: false, requiere_codig: true },
    );
    expect(del).toHaveBeenCalledWith("/api/v1/configuracion/reglas-catalogos/nominas/8/");
  });

  it("API client reordena tipos de soporte en bloque (FIX-DIS2)", async () => {
    const putMock = vi.fn().mockResolvedValue({
      status: "success",
      message: "ok",
      data: [
        { id: 2, codigo: "DOC2", nombre: "Doc 2", orden: 1 },
        { id: 1, codigo: "DOC1", nombre: "Doc 1", orden: 2 },
      ],
    });
    vi.spyOn(reglasCatalogosApi, "reordenarTiposSoporte").mockImplementation(putMock);

    const res = await reglasCatalogosApi.reordenarTiposSoporte([
      { id: 2, orden: 1 },
      { id: 1, orden: 2 },
    ]);
    expect(putMock).toHaveBeenCalledWith([
      { id: 2, orden: 1 },
      { id: 1, orden: 2 },
    ]);
    expect(res.data).toHaveLength(2);
  });
});
