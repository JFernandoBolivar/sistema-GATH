import { describe, expect, it } from "vitest";

import {
  contactoEmergenciaFormSchema,
  contactosEmergenciaFormSchema,
  contactosFormADto,
} from "./schema-contacto-emergencia";

const valido = { nombres: "Ana Maria", apellidos: "Ruiz", telefono: "04121234567", relacion_id: 7 };

describe("contactoEmergenciaFormSchema", () => {
  it("acepta un contacto completo con móvil o fijo", () => {
    expect(contactoEmergenciaFormSchema.safeParse(valido).success).toBe(true);
    expect(contactoEmergenciaFormSchema.safeParse({ ...valido, telefono: "02121234567" }).success).toBe(true);
  });

  it("exige parentesco, teléfono válido y nombres con letras", () => {
    expect(contactoEmergenciaFormSchema.safeParse({ ...valido, relacion_id: 0 }).success).toBe(false);
    expect(contactoEmergenciaFormSchema.safeParse({ ...valido, telefono: "123" }).success).toBe(false);
    expect(contactoEmergenciaFormSchema.safeParse({ ...valido, telefono: "nan" }).success).toBe(false);
    expect(contactoEmergenciaFormSchema.safeParse({ ...valido, nombres: "A1" }).success).toBe(false);
  });

  it("permite lista vacía (eliminar todos) y como máximo 5 contactos", () => {
    expect(contactosEmergenciaFormSchema.safeParse({ contacto_emergencia: [] }).success).toBe(true);
    expect(contactosEmergenciaFormSchema.safeParse({ contacto_emergencia: Array(6).fill(valido) }).success).toBe(false);
  });
});

describe("contactosFormADto", () => {
  it("mapea al DTO de escritura con relacionId", () => {
    expect(contactosFormADto([{ ...valido, nombres: " Ana " }])).toEqual([
      { nombres: "Ana", apellidos: "Ruiz", telefono: "04121234567", relacionId: 7 },
    ]);
    expect(contactosFormADto(undefined)).toEqual([]);
  });
});
