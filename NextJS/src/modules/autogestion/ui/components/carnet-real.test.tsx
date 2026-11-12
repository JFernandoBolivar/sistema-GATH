import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { CarnetReal } from "./carnet-real";

function respuesta(png: Blob | null, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    blob: () => Promise.resolve(png as Blob),
  } as Response);
}

describe("CarnetReal (T1)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respuesta(new Blob(["png"], { type: "image/png" }))),
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:carnet-real"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("muestra «Cargando…» y luego la imagen real del mismo origen", async () => {
    render(<CarnetReal cedula="V-1" alt="Carnet de prueba" />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando");

    const imagen = await screen.findByRole("img", { name: "Carnet de prueba" });
    expect(imagen).toHaveAttribute("src", "blob:carnet-real");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/autogestion/mi-carnet/vista-previa/",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("si no hay carnet (404) muestra el aviso", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respuesta(null, 404)));

    render(<CarnetReal cedula="V-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No posee un carnet activo emitido.",
      );
    });
  });

  it("si la petición falla muestra un mensaje claro", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respuesta(null, 500)));

    render(<CarnetReal cedula="V-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No fue posible cargar la imagen del carnet",
      );
    });
  });

  it("si la red falla también muestra el mensaje de error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

    render(<CarnetReal cedula="V-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No fue posible cargar la imagen del carnet",
      );
    });
  });
});
