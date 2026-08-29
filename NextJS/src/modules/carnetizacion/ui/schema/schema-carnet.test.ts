import { describe, expect, it } from "vitest";
import { emitirCarnetSchema } from "./schema-carnet";

describe("Schema de Emisión de Carnets", () => {
  it("valida emisión con datos correctos", () => {
    const res = emitirCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      motivoId: 1,
    });
    expect(res.success).toBe(true);
  });

  it("falla si no se selecciona un motivo", () => {
    const res = emitirCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      motivoId: 0,
    });
    expect(res.success).toBe(false);
  });
});
