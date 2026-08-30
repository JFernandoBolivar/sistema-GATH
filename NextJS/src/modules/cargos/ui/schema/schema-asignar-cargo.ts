import { z } from "zod";
import { ERROR, REGEX } from "@/shared/domain/validation";

/** Filtro de listado de cargos (zero-trust R7). */
export const cargosFiltroSchema = z.object({
  dependenciaId: z.number().int().positive().optional().nullable(),
  soloVacantes: z.boolean().optional(),
});

/** Identificador de cargo (desasignar/trasladar/gestionar estatus) (zero-trust R7). */
export const cargoIdSchema = z.object({
  cargoId: z.number().int().positive({ message: "Debe seleccionar un cargo válido" }),
});

/** Asignación de cargo (zero-trust R7). */
export const asignarCargoSchema = z.object({
  cargoId: z.number().int().positive({ message: "Debe seleccionar un cargo válido" }),
  empleadoCedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula debe contener solo dígitos" }),
});

/** Traslado de empleado a otro cargo (zero-trust R7). */
export const cambiarCargoSchema = z.object({
  cargoActualId: z.number().int().positive({ message: "Debe seleccionar un cargo válido" }),
  cargoNuevoId: z.number().int().positive({ message: ERROR.REQUIRED }),
  motivoId: z.number().int().positive({ message: ERROR.REQUIRED }),
});

/** Gestión de estatus del cargo (zero-trust R7). */
export const gestionarEstatusSchema = z.object({
  cargoId: z.number().int().positive({ message: "Debe seleccionar un cargo válido" }),
  estatusId: z.number().int().positive({ message: ERROR.REQUIRED }),
  motivoId: z.number().int().positive({ message: ERROR.REQUIRED }),
});

/** Préstamo de cargo (encargaduría) (zero-trust R7). */
export const crearPrestamoSchema = z.object({
  cedulaEncargado: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula del encargado inválida" }),
  cargoId: z.number().int().positive({ message: ERROR.REQUIRED }),
  motivoId: z.number().int().positive({ message: ERROR.REQUIRED }),
  fechaInicio: z
    .string()
    .regex(REGEX.DATE_ISO, { message: ERROR.INVALID_DATE }),
  fechaFin: z
    .string()
    .regex(REGEX.DATE_ISO, { message: ERROR.INVALID_DATE }),
});

/** Préstamo a finalizar (zero-trust R7). */
export const prestamoIdSchema = z.object({
  prestamoId: z.number().int().positive({ message: "Préstamo inválido" }),
});

/** Denominación de cargo (crear/actualizar) (zero-trust R7). */
export const denominacionSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, ERROR.MIN_LENGTH(2))
    .max(200, ERROR.MAX_LENGTH(200)),
  orden: z.number().int().min(0).max(999).default(30),
});

/** Identificador de denominación (zero-trust R7). */
export const denominacionIdSchema = z.object({
  denominacionId: z.number().int().positive({ message: "Denominación inválida" }),
});

export type AsignarCargoFormType = z.infer<typeof asignarCargoSchema>;
export type CargosFiltroFormType = z.infer<typeof cargosFiltroSchema>;
export type CambiarCargoFormType = z.infer<typeof cambiarCargoSchema>;
export type GestionarEstatusFormType = z.infer<typeof gestionarEstatusSchema>;
export type CrearPrestamoFormType = z.infer<typeof crearPrestamoSchema>;
export type DenominacionFormType = z.infer<typeof denominacionSchema>;
