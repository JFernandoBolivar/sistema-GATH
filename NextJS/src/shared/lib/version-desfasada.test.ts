import { describe, expect, it, vi } from "vitest";
import { esVersionDesfasada, recargarSiVersionDesfasada } from "./version-desfasada";

function almacen() {
  const datos = new Map<string, string>();
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) };
}

describe("versión desfasada tras un despliegue", () => {
  it("reconoce la acción de servidor inexistente y los fragmentos perdidos", () => {
    expect(esVersionDesfasada(new Error('Failed to find Server Action "abc"'))).toBe(true);
    expect(esVersionDesfasada({ name: "ChunkLoadError", message: "Loading chunk 12 failed" })).toBe(true);
    expect(esVersionDesfasada(new Error("Sesión expirada"))).toBe(false);
  });

  it("recarga una sola vez por minuto", () => {
    const a = almacen();
    const recargar = vi.fn();
    const err = new Error("Failed to find Server Action");
    expect(recargarSiVersionDesfasada(err, 1_000_000, a, recargar)).toBe(true);
    expect(recargarSiVersionDesfasada(err, 1_030_000, a, recargar)).toBe(false);
    expect(recargarSiVersionDesfasada(err, 1_070_000, a, recargar)).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(2);
  });

  it("no recarga por otros errores", () => {
    const recargar = vi.fn();
    expect(recargarSiVersionDesfasada(new Error("boom"), 1, almacen(), recargar)).toBe(false);
    expect(recargar).not.toHaveBeenCalled();
  });
});
