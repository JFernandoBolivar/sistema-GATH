import { describe, expect, it } from "vitest";
import {
  solicitarRecuperacionSchema,
  restablecerPasswordSchema,
} from "./schema-recuperar-password";

describe("schema-recuperar-password", () => {
  describe("solicitarRecuperacionSchema", () => {
    it("acepta correo institucional válido", () => {
      const res = solicitarRecuperacionSchema.safeParse({ identificador: "empleado@conatel.gob.ve" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.identificador).toBe("empleado@conatel.gob.ve");
      }
    });

    it("acepta cédula de identidad", () => {
      const res = solicitarRecuperacionSchema.safeParse({ identificador: "V-12345678" });
      expect(res.success).toBe(true);
    });

    it("rechaza identificador menor a 3 caracteres", () => {
      const res = solicitarRecuperacionSchema.safeParse({ identificador: "ab" });
      expect(res.success).toBe(false);
    });
  });

  describe("restablecerPasswordSchema", () => {
    it("acepta contraseña válida y confirmación coincidente", () => {
      const res = restablecerPasswordSchema.safeParse({
        token: "tok-abc",
        passwordNuevo: "ClaveSegura2026*",
        passwordConfirmacion: "ClaveSegura2026*",
      });
      expect(res.success).toBe(true);
    });

    it("rechaza contraseñas no coincidentes", () => {
      const res = restablecerPasswordSchema.safeParse({
        token: "tok-abc",
        passwordNuevo: "ClaveSegura2026*",
        passwordConfirmacion: "OtraClave2026*",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Las contraseñas no coinciden");
      }
    });

    it("rechaza contraseña de menos de 8 caracteres", () => {
      const res = restablecerPasswordSchema.safeParse({
        token: "tok-abc",
        passwordNuevo: "1234567",
        passwordConfirmacion: "1234567",
      });
      expect(res.success).toBe(false);
    });
  });
});
