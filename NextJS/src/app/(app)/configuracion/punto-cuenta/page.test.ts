import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (...args: unknown[]) => redirectMock(...args) }));

import Page from "./page";

describe("ruta heredada de Punto de Cuenta", () => {
  it("redirige al listado canónico filtrado sin conservar el editor legacy", () => {
    Page();
    expect(redirectMock).toHaveBeenCalledWith("/documentos/plantillas?grupo=punto_cuenta");
  });
});
