import { describe, expect, it } from "vitest";
import { empleadoSchema } from "./schema-empleado";

describe("Schema de Personal / Expediente", () => {
  it("valida registro correcto de empleado", () => {
    const res = empleadoSchema.safeParse({
      cedula: "12345678",
      nombres: "Carlos",
      apellidos: "García",
      sexoId: 1,
      fechaNacimiento: "1990-01-15",
      correo: "carlos.garcia@organismo.gob.ve",
      telefonoMovil: "04121234567",
    });
    expect(res.success).toBe(true);
  });

  it("falla con correo inválido", () => {
    const res = empleadoSchema.safeParse({
      cedula: "12345678",
      nombres: "Carlos",
      apellidos: "García",
      sexoId: 1,
      fechaNacimiento: "1990-01-15",
      correo: "correo-invalido",
    });
    expect(res.success).toBe(false);
  });
});
