import { describe, expect, it } from "vitest";

import { REGLAS_COLOR_DEFECTO, type ElementoKonva } from "../../domain/entities/disenador";
import { adaptarDefinicionAEditor, adaptarEditorADefinicion } from "./adaptar-definicion-plantilla";

function imagenBiblioteca(extra: Partial<ElementoKonva> = {}): ElementoKonva {
  return {
    id: "firma",
    t: "image",
    name: "Firma del director",
    cara: "anverso",
    x: 10,
    y: 60,
    w: 30,
    h: 10,
    r: 0,
    fill: "",
    stroke: "",
    sw: 0,
    rad: 0,
    shadow: 0,
    op: 100,
    src: "/api/v1/carnetizacion/biblioteca/42/archivo/",
    biblioteca_id: "42",
    ...extra,
  };
}

function guardar(elementos: ElementoKonva[], original: unknown = {}) {
  return adaptarEditorADefinicion(original, elementos, REGLAS_COLOR_DEFECTO, 54, 85.6, "vertical");
}

describe("adaptar-definicion-plantilla", () => {
  it("guarda la imagen de la biblioteca para que el PDF la dibuje", () => {
    const definicion = guardar([imagenBiblioteca()]);
    const [firma] = definicion.anverso as Array<Record<string, unknown>>;

    expect(firma.tipo).toBe("image");
    expect(firma.props).toMatchObject({ biblioteca_id: "42" });
  });

  it("al recargar reconstruye la URL de la imagen de la biblioteca", () => {
    const { elementos } = adaptarDefinicionAEditor(guardar([imagenBiblioteca()]));

    expect(elementos[0].biblioteca_id).toBe("42");
    expect(elementos[0].src).toBe("/api/v1/carnetizacion/biblioteca/42/archivo/");
  });

  it("un asset institucional fijo no se confunde con un medio de la biblioteca", () => {
    const original = {
      anverso: [{ id: "logo", tipo: "image", x: 0, y: 0, w: 10, h: 10, props: { asset: "logo01.png" } }],
      reverso: [],
    };
    const { elementos } = adaptarDefinicionAEditor(original);

    expect(elementos[0].src).toBe("/logo1.png");
    expect(elementos[0].biblioteca_id).toBeUndefined();

    const [logo] = guardar(elementos, original).anverso as Array<Record<string, unknown>>;
    expect(logo.props).toMatchObject({ asset: "logo01.png" });
    expect(logo.props).not.toHaveProperty("biblioteca_id");
  });

  it("guarda y recupera la opacidad, y no la escribe si el elemento es opaco", () => {
    const transparente = guardar([imagenBiblioteca({ op: 25 })]);
    expect((transparente.anverso as Array<Record<string, unknown>>)[0].op).toBe(25);
    expect(adaptarDefinicionAEditor(transparente).elementos[0].op).toBe(25);

    // Volver a 100 borra la opacidad guardada antes (no reaparece desde el original).
    const opaco = guardar([imagenBiblioteca({ op: 100 })], transparente);
    expect((opaco.anverso as Array<Record<string, unknown>>)[0]).not.toHaveProperty("op");
  });

  it("conserva la rotación y la borra al volver a 0", () => {
    const girado = guardar([imagenBiblioteca({ r: 30 })]);
    expect((girado.anverso as Array<Record<string, unknown>>)[0].r).toBe(30);
    expect(adaptarDefinicionAEditor(girado).elementos[0].r).toBe(30);

    const derecho = guardar([imagenBiblioteca({ r: 0 })], girado);
    expect((derecho.anverso as Array<Record<string, unknown>>)[0]).not.toHaveProperty("r");
  });
});
