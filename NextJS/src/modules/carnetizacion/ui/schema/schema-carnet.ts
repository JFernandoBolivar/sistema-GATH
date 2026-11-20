import { LIMITES_TEXTO, textoLibreOpcional } from "@/shared/validation/limites-texto";
import { z } from "zod";
import { REGEX } from "@/shared/validation/regex";

export const emitirCarnetSchema = z.object({
  empleadoCedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
  motivoId: z.number().positive({ message: "Seleccione un motivo de emisión" }),
  observaciones: textoLibreOpcional("Las observaciones", LIMITES_TEXTO.observacion).optional(),
});

/** Hash de seguridad de carnet (zero-trust R7). */
export const validarHashSchema = z.object({
  securityHash: z
    .string()
    .trim()
    .min(8, { message: "Hash de seguridad inválido" })
    .max(128, { message: "Hash de seguridad inválido" })
    .regex(REGEX.NO_HTML, { message: "Hash de seguridad inválido" }),
});

/** Identificador de carnet (zero-trust R7). */
export const carnetIdSchema = z.object({
  carnetId: z.number().int().positive({ message: "Carnet inválido" }),
});

/** Identificador de plantilla (zero-trust R7). */
export const plantillaIdSchema = z.object({
  plantillaId: z.number().int().positive({ message: "Plantilla inválida" }),
});

/** Búsqueda de empleado para carnet (zero-trust R7). */
export const buscarEmpleadoCarnetSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
});

/** Formulario del diseñador de carnet (zero-trust R7). */
export const disenarCarnetSchema = z.object({
  empleadoCedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
  nombreTitular: z
    .string()
    .trim()
    .min(3, { message: "El nombre debe contener al menos 3 caracteres" })
    .max(120, { message: "Nombre demasiado largo" }),
  motivoId: z.number().positive({ message: "Seleccione un motivo de emisión" }),
  plantillaId: z.number().optional(),
  observaciones: textoLibreOpcional("Las observaciones", LIMITES_TEXTO.observacion).optional(),
});

export type EmitirCarnetFormType = z.infer<typeof emitirCarnetSchema>;
export type ValidarHashFormType = z.infer<typeof validarHashSchema>;
export type BuscarEmpleadoCarnetType = z.infer<typeof buscarEmpleadoCarnetSchema>;
export type DisenarCarnetFormType = z.infer<typeof disenarCarnetSchema>;

export const schemaSearch = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Debe ingresar al menos 2 caracteres")
    .max(50, "La búsqueda es demasiado larga"),
});

export const schemaGenerar = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(200, "El nombre es demasiado largo"),
  motivo_id: z.coerce.number().positive("Debe seleccionar un motivo"),
});

export const schemaPlantilla = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(100, "El nombre es demasiado largo"),
  imagen: z
    .instanceof(File)
    .refine(
      (file) => ["image/jpeg", "image/png", "image/jpg"].includes(file.type),
      "Solo se permiten imágenes JPG o PNG",
    )
    .refine((file) => file.size <= 5 * 1024 * 1024, "La imagen no debe superar los 5MB"),
});

export type SearchFormType = z.infer<typeof schemaSearch>;
export type GenerarFormType = z.infer<typeof schemaGenerar>;
export type PlantillaFormType = z.infer<typeof schemaPlantilla>;


