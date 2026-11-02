import z from "zod";

export const schemaUpdateCodeTable = z.object({
  denominacioncargoid: z.number().min(1, { message: "Debe seleccionar un cargo" }),
  denominacioncargoespecificoid: z.number().min(1, { message: "Debe seleccionar un cargo específico" }),
  gradoid: z.number().optional().nullable(),
  tiponominaid: z.number().refine((v) => v > 0, {
    message: "Debe Seleccionar Un Valor",
  }),
  Dependencia: z.number().refine((v) => v > 0, {
    message: "Debe Seleccionar Un Valor",
  }),
  OrganismoAdscritoid: z.number().optional().nullable(),
  DireccionGeneral: z.number().default(0),
  DireccionLinea: z.number().default(0),
  Coordinacion: z.number().default(0),
});

export type UpdateCodeTable = z.infer<typeof schemaUpdateCodeTable>;
