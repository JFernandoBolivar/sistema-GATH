import { z } from "zod";

export const schemaTalla = z.object({
  valor: z
    .string({ required_error: "Campo Obligatorio" })
    .min(1, { message: "Campo Obligatorio" })
    .max(10, { message: "Máximo 10 Caracteres" }),
  tipo_prenda: z.coerce.number().min(1, {
    message: "Debe Seleccionar Un Tipo De Prenda",
  }),
  region: z.coerce.number().min(1, {
    message: "Debe Seleccionar Una Región",
  }),
});

export type TallaSchema = z.infer<typeof schemaTalla>;
