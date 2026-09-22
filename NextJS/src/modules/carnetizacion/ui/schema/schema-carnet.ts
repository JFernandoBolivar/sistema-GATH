import { z } from "zod";
import { REGEX } from "@/shared/validation/regex";

export const emitirCarnetSchema = z.object({
  empleadoCedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula inválida" }),
  motivoId: z.number().positive({ message: "Seleccione un motivo de emisión" }),
  observaciones: z.string().trim().optional(),
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
  observaciones: z.string().trim().optional(),
});

export type EmitirCarnetFormType = z.infer<typeof emitirCarnetSchema>;
export type ValidarHashFormType = z.infer<typeof validarHashSchema>;
export type BuscarEmpleadoCarnetType = z.infer<typeof buscarEmpleadoCarnetSchema>;
export type DisenarCarnetFormType = z.infer<typeof disenarCarnetSchema>;

/** Constantes de validación para subida de plantillas (zero-trust R7, OWASP API3). */
export const MAX_TAMANO_PLANTILLA = 5 * 1024 * 1024; // 5MB
export const TIPOS_MIME_PLANTILLA_PERMITIDOS = ["image/png", "image/jpeg", "image/jpg"] as const;

/** Subida de plantilla de carnet con validación estricta zero-trust (Fase 2 / C2). */
export const subirPlantillaCarnetSchema = z.object({
  nombre: z
    .string({ required_error: "El nombre de la plantilla es requerido" })
    .trim()
    .min(2, { message: "El nombre de la plantilla debe tener al menos 2 caracteres" })
    .max(100, { message: "El nombre de la plantilla no puede exceder 100 caracteres" })
    .regex(REGEX.NO_HTML, { message: "El nombre contiene caracteres no permitidos" }),
  imagen: z
    .custom<File>(
      (file) => typeof file === "object" && file !== null && "size" in file && "type" in file,
      { message: "Debe seleccionar un archivo de imagen válido" }
    )
    .refine((file) => file.size > 0, {
      message: "El archivo de imagen no puede estar vacío",
    })
    .refine((file) => file.size <= MAX_TAMANO_PLANTILLA, {
      message: "El tamaño de la imagen no puede exceder 5MB",
    })
    .refine((file) => file.type !== "image/svg+xml", {
      message: "No se permiten imágenes vectoriales SVG por motivos de seguridad",
    })
    .refine((file) => (TIPOS_MIME_PLANTILLA_PERMITIDOS as readonly string[]).includes(file.type), {
      message: "Formato de imagen no permitido. Solo se aceptan PNG y JPEG",
    }),
  activar: z.boolean().optional().default(false),
});

export type SubirPlantillaCarnetFormType = z.infer<typeof subirPlantillaCarnetSchema>;

export const schemaSearch = z.object({
  query: z
    .string()
    .min(2, "Debe ingresar al menos 2 caracteres")
    .max(50, "La búsqueda es demasiado larga"),
});

export const schemaGenerar = z.object({
  nombre: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(200, "El nombre es demasiado largo"),
  motivo_id: z.coerce.number().positive("Debe seleccionar un motivo"),
});

export const schemaPlantilla = z.object({
  nombre: z
    .string()
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

