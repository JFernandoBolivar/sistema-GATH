import { z } from "zod";

export const schemaPrestamoCargo = z.object({
  cargo_encargado: z.number({ message: "Debe seleccionar un cargo" }).min(1),
  empleado_encargado: z.string({ message: "Debe seleccionar un empleado" }).min(1),
  motivo: z.number({ message: "Debe seleccionar un motivo" }),
  nueva_motivo_nombre: z.string().optional(),
  fecha_inicio: z.date({ message: "Debe seleccionar una fecha de inicio" }),
  fecha_fin: z.date({ message: "Debe seleccionar una fecha de fin" }),
}).refine(
  (data) => data.fecha_fin >= data.fecha_inicio,
  { message: "La fecha de fin no puede ser anterior a la de inicio", path: ["fecha_fin"] },
).refine(
  (data) => {
    if (data.motivo === -1 && !data.nueva_motivo_nombre?.trim()) {
      return false;
    }
    return true;
  },
  { message: "Debe escribir el nombre del nuevo motivo", path: ["nueva_motivo_nombre"] },
);

export type PrestamoCargoFormType = z.infer<typeof schemaPrestamoCargo>;
