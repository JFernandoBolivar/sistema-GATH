import z from "zod";

export const updateInfoSchema = z.object({
  cedulaFamiliar: z.string().optional(),
  primer_nombre: z.string().optional(),
  segundo_nombre: z.string().optional(),
  primer_apellido: z.string().optional(),
  segundo_apellido: z.string().optional(),
  fechanacimiento: z.date().optional(),
  sexo: z.coerce.number().optional(),
  estadoCivil: z.coerce.number().optional(),
  observaciones: z.string().optional(),
});
export type UpdateInfoFormValues = z.infer<typeof updateInfoSchema>;
