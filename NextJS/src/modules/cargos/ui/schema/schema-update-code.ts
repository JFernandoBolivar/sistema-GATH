import z from "zod";

export const schemaUpdateCodeTable = z.object({
  denominacioncargoid: z.number().min(1, { message: "Debe seleccionar un cargo" }),
  denominacioncargoespecificoid: z.number().min(1, { message: "Debe seleccionar un cargo específico" }),
  gradoid: z.number().optional().nullable(),
  tiponominaid: z.number().refine((v) => v > 0, {
    message: "Debe Seleccionar Un Valor",
  }),
  // D10: Nivel y Dirección/Gerencia/Oficina son obligatorios también al editar.
  // `.catch(0)` evita mostrar el mensaje técnico de Zod («Expected number,
  // received nan») cuando el selector queda vacío.
  Dependencia: z.number().catch(0).refine((v) => v > 0, {
    message: "Seleccione el Nivel (Dependencia)",
  }),
  OrganismoAdscritoid: z.number().optional().nullable(),
  DireccionGeneral: z.number().catch(0).refine((v) => v > 0, {
    message: "Seleccione la Dirección / Gerencia / Oficina",
  }),
  DireccionLinea: z.number().default(0),
  Coordinacion: z.number().default(0),
});

export type UpdateCodeTable = z.infer<typeof schemaUpdateCodeTable>;
