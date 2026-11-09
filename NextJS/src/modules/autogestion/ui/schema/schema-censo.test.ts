import { describe, expect, it } from "vitest";
import { registrarCensoSchema } from "./schema-censo";

describe("Schema de Censo de Autogestión", () => {
  it("valida el registro de respuestas del censo", () => {
    const res = registrarCensoSchema.safeParse({
      respuestas: [
        { preguntaId: 1, opcionId: 10 },
        { preguntaId: 2, respuesta: "Respuesta libre" },
      ],
    });
    expect(res.success).toBe(true);
  });

  it("falla si no se responde ninguna pregunta", () => {
    const res = registrarCensoSchema.safeParse({ respuestas: [] });
    expect(res.success).toBe(false);
  });
});
