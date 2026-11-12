import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlantillaMotor } from "../../domain/entities/carnet";
import { useDisenadorEditor } from "./use-disenador-editor";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../../infrastructure/actions/carnetizacion-actions", () => ({
  buscarEmpleadoParaCarnetAction: vi.fn(),
}));

function rect(id: string) {
  return { id, tipo: "rect", x: 0, y: 0, w: 10, h: 10, props: { fill: "#fff" } };
}

const plantilla = {
  id: "p1",
  definicion: {
    anverso: [rect("a1"), rect("a2"), rect("a3")],
    reverso: [rect("r1"), rect("r2")],
  },
} as unknown as PlantillaMotor;

function montar() {
  return renderHook(() => useDisenadorEditor({ plantilla, anchoMm: 54, altoMm: 85.6 }));
}

const ids = (r: ReturnType<typeof montar>["result"]) => r.current.elementos.map((e) => e.id);

describe("Limpiar diseño", () => {
  it("limpiar solo una cara deja la otra intacta y deshacer restaura", () => {
    const { result } = montar();
    act(() => result.current.limpiarDiseno("cara-actual")); // cara activa: anverso
    expect(ids(result)).toEqual(["r1", "r2"]);
    act(() => result.current.handleDeshacer());
    expect(ids(result)).toEqual(["a1", "a2", "a3", "r1", "r2"]);
  });

  it("limpiar ambas caras vacía todo y se puede deshacer", () => {
    const { result } = montar();
    act(() => result.current.limpiarDiseno("ambas"));
    expect(ids(result)).toEqual([]);
    act(() => result.current.handleDeshacer());
    expect(ids(result)).toHaveLength(5);
  });
});

describe("Selección múltiple", () => {
  it("Ctrl+clic agrega y quita de la selección", () => {
    const { result } = montar();
    act(() => result.current.seleccionarElemento("a1"));
    act(() => result.current.seleccionarElemento("a2", true));
    expect(result.current.seleccionIds).toEqual(["a1", "a2"]);
    act(() => result.current.seleccionarElemento("a1", true));
    expect(result.current.seleccionIds).toEqual(["a2"]);
    expect(result.current.elementoSeleccionadoId).toBe("a2");
  });

  it("eliminar 2 seleccionados deja los demás y un solo deshacer los restaura", () => {
    const { result } = montar();
    act(() => result.current.seleccionarVarios(["a1", "a3"]));
    act(() => result.current.eliminarElemento());
    expect(ids(result)).toEqual(["a2", "r1", "r2"]);
    expect(result.current.seleccionIds).toEqual([]);
    act(() => result.current.handleDeshacer());
    expect(ids(result)).toEqual(["a1", "a2", "a3", "r1", "r2"]);
  });

  it("Ctrl+A selecciona la cara activa, Escape limpia y Supr elimina", () => {
    const { result } = montar();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true }));
    });
    expect(result.current.seleccionIds).toEqual(["a1", "a2", "a3"]);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    });
    expect(ids(result)).toEqual(["r1", "r2"]);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.seleccionIds).toEqual([]);
  });

  it("Retroceso también elimina, con uno o varios seleccionados", () => {
    const { result } = montar();
    act(() => result.current.seleccionarElemento("a1"));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
    });
    expect(ids(result)).toEqual(["a2", "a3", "r1", "r2"]);
    act(() => result.current.seleccionarVarios(["a2", "r1"]));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
    });
    expect(ids(result)).toEqual(["a3", "r2"]);
  });

  it("Supr y Retroceso no eliminan mientras se escribe en un input o textarea", () => {
    const { result } = montar();
    act(() => result.current.seleccionarVarios(["a1", "a2"]));
    for (const tag of ["input", "textarea"]) {
      const campo = document.createElement(tag);
      document.body.appendChild(campo);
      for (const key of ["Backspace", "Delete"]) {
        act(() => {
          campo.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        });
      }
      campo.remove();
    }
    expect(ids(result)).toHaveLength(5);
    expect(result.current.seleccionIds).toEqual(["a1", "a2"]);
  });

  it("los atajos no se activan al escribir en un input", () => {
    const { result } = montar();
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }));
    });
    expect(result.current.seleccionIds).toEqual([]);
    input.remove();
  });
});
