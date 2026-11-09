import { describe, expect, it } from "vitest";

import { SERIAL_CARNET_PATRIA_MSG, serialCarnetPatriaZod } from "./serial-carnet-patria";

describe("serialCarnetPatriaZod", () => {
  const schema = serialCarnetPatriaZod();

  it("acepta vacío, nulo, indefinido y alfanumérico", () => {
    expect(schema.safeParse("").success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse("AB12cd").success).toBe(true);
    expect(schema.safeParse("A".repeat(30)).success).toBe(true);
  });

  it("rechaza espacios, símbolos y más de 30 caracteres con el mensaje acordado", () => {
    for (const malo of ["AB 12", "AB-12", "ñandú", "A".repeat(31)]) {
      const r = schema.safeParse(malo);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe(SERIAL_CARNET_PATRIA_MSG);
    }
  });
});
