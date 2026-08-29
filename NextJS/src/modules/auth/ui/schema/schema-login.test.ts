import { describe, expect, it } from "vitest";

import { loginFormSchema } from "./schema-login";

describe("loginFormSchema", () => {
  it("acepta credenciales con formato válido", () => {
    const result = loginFormSchema.safeParse({
      usuario: "analista@conatel.gob.ve",
      password: "Clave*Segura1",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un usuario que no es correo institucional", () => {
    const result = loginFormSchema.safeParse({ usuario: "no-es-correo", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.usuario?.length).toBeGreaterThan(0);
    }
  });

  it("rechaza usuario vacío", () => {
    const result = loginFormSchema.safeParse({ usuario: "", password: "Clave*Segura1" });
    expect(result.success).toBe(false);
  });

  it("rechaza contraseña vacía", () => {
    const result = loginFormSchema.safeParse({
      usuario: "analista@conatel.gob.ve",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza una contraseña por encima del máximo permitido", () => {
    const result = loginFormSchema.safeParse({
      usuario: "analista@conatel.gob.ve",
      password: "a".repeat(33),
    });
    expect(result.success).toBe(false);
  });
});
