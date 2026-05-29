import z from "zod";

export const schemaCodeEspecial = z.object({
  employee: z.string(),
  OrganismoAdscritoid: z
    .number()

    .optional()
    .default(0),
  denominacioncargoid: z.number().refine((v) => !(v < 1), {
    message: "Debe Seleccionar Un Valor",
  }),
  denominacioncargoespecificoid: z.number().refine((v) => !(v < 1), {
    message: "Debe Seleccionar Un Valor",
  }),
  gradoid: z.number().optional().default(0),
  tiponominaid: z.number().refine((v) => !(v < 1), {
    message: "Debe Seleccionar Un Valor",
  }),
  Dependencia: z.number().refine((v) => !(v < 1), {
    message: "Debe Seleccionar Un Valor",
  }),
  DireccionGeneral: z.number().min(1, {
    message: "Debe Seleccionar una Gerencia u Oficina",
  }),
  DireccionLinea: z.number().default(0),
  Coordinacion: z.number().default(0),
  tipo_procedencia: z.number().refine((v) => !(v < 1), {
    message: "Debe Seleccionar Un Valor",
  }),
});
