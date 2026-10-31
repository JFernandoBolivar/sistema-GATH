/** Validación Zod de los filtros de la bitácora (D10). */
import { z } from "zod";

import type { FiltrosAuditoria } from "../../application/dtos/auditoria-dto";

export const filtrosAuditoriaSchema = z
  .object({
    usuario: z.string().trim().max(100, "Máximo 100 caracteres."),
    accion: z.string().trim().max(100, "Máximo 100 caracteres."),
    modulo: z.string().trim().max(50, "Máximo 50 caracteres."),
    recurso: z.string().trim().max(100, "Máximo 100 caracteres."),
    ip: z.string().trim().max(45, "Máximo 45 caracteres."),
    desde: z.string().trim(),
    hasta: z.string().trim(),
    resultado: z.string().trim().max(20, "Máximo 20 caracteres."),
  })
  .superRefine((valores, ctx) => {
    if (valores.desde && valores.hasta && valores.desde > valores.hasta) {
      ctx.addIssue({
        code: "custom",
        path: ["hasta"],
        message: "La fecha «Hasta» no puede ser anterior a «Desde».",
      });
    }
  });

export type FiltrosAuditoriaForm = z.infer<typeof filtrosAuditoriaSchema>;

export const FILTROS_VACIOS: FiltrosAuditoriaForm = {
  usuario: "",
  accion: "",
  modulo: "",
  recurso: "",
  ip: "",
  desde: "",
  hasta: "",
  resultado: "",
};

export function aFiltros(filtros: FiltrosAuditoriaForm): FiltrosAuditoria {
  return {
    usuario: filtros.usuario || undefined,
    accion: filtros.accion || undefined,
    modulo: filtros.modulo || undefined,
    recurso: filtros.recurso || undefined,
    ip: filtros.ip || undefined,
    desde: filtros.desde || undefined,
    hasta: filtros.hasta || undefined,
    resultado: filtros.resultado || undefined,
  };
}
