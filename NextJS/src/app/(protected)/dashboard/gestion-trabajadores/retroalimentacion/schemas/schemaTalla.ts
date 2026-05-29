import { z } from "zod";

export const schemaTalla = z.object({
  valor: z
    .string({ required_error: "Campo Obligatorio" })
    .max(3, { message: "Maximo 3 Caracteres" }),
  tipo_prenda: z.coerce.number().min(1, {
    message: "Debe Seleccionar Un Tipo De Prenda",
  }),
  region: z.coerce.number().min(1, {
    message: "Debe Seleccionar Una Region",
  }),
});

export type TallaSchema = z.infer<typeof schemaTalla>;
