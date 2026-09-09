import { describe, it, expect } from "vitest";
import { buildSchema } from "./schema-autogestion";
import type { Pregunta } from "@/app/types/types";

const preguntaCarnet: Pregunta = {
  id: 1,
  enunciado: "N° CARNET DE LA PATRIA",
  tipo: { id: 1, nombre: "number" },
  validacion: "10",
  opciones: [],
} as unknown as Pregunta;

const viviendaValida = {
  direccion_exacta: "Av. Principal",
  estado_id: 1,
  municipio_id: 1,
  parroquia: 1,
  condicion_vivienda_id: 1,
};

describe("buildSchema - código del Carnet de la Patria (pregunta id=1)", () => {
  it("preserva los ceros a la izquierda en vez de convertir el valor a Number", () => {
    const schema = buildSchema([preguntaCarnet]);
    const result = schema.safeParse({
      "1": "0000123234",
      datos_vivienda: viviendaValida,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data["1"]).toBe("0000123234");
    }
  });

  it("exige exactamente la cantidad de dígitos configurada en `validacion`", () => {
    const schema = buildSchema([preguntaCarnet]);
    const result = schema.safeParse({
      "1": "123",
      datos_vivienda: viviendaValida,
    });

    expect(result.success).toBe(false);
  });
});
