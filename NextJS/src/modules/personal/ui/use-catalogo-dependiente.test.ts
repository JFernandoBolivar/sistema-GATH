import { describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/actions/registro-actions", () => ({ getCatalogoDependienteAction: vi.fn() }));

import { conValorActual } from "./use-catalogo-dependiente";

const filtradas = [{ id: 2, nombre: "Medicina" }];
const todas = [
  { id: 1, nombre: "Histórica sin nivel" },
  { id: 2, nombre: "Medicina" },
];

describe("conValorActual", () => {
  it("deja la lista filtrada si el valor ya está o no hay valor", () => {
    expect(conValorActual(filtradas, 2, todas)).toBe(filtradas);
    expect(conValorActual(filtradas, null, todas)).toBe(filtradas);
    expect(conValorActual(filtradas, -1, todas)).toBe(filtradas);
  });

  it("agrega el valor guardado desde el catálogo completo cuando el filtro no lo trae", () => {
    expect(conValorActual(filtradas, 1, todas)).toEqual([{ id: 1, nombre: "Histórica sin nivel" }, ...filtradas]);
  });

  it("no inventa opciones si el valor no existe en el respaldo", () => {
    expect(conValorActual(filtradas, 99, todas)).toBe(filtradas);
  });
});
