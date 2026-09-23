import { z } from "zod";
import { REGEX } from "@/shared/validation/regex";
import { ID_OTRA_FAMILIAR } from "../catalogo-otra-familiar";

/**
 * Validación del mini-expediente del familiar (paridad con el legado
 * `schemaFamilyEmployeeOne`, sección `formacion_academica_familiar`): a
 * diferencia del legado (donde el objeto completo era obligatorio), aquí es
 * opcional/nullable siguiendo el contrato acordado con el coordinador
 * (`formacionAcademica: {...} | null`). `nuevaCarreraNombre`/
 * `nuevaMencionNombre`/`nuevaInstitucionNombre` son campos transitorios de UI
 * (opción "Otra") que `resolverPendientesOtraFamiliar` consume antes de
 * armar el `GuardarFamiliarInputDTO` final -- nunca se envían al backend.
 */
export const formacionAcademicaFamiliarSchema = z
  .object({
    nivelAcademicoId: z.number().positive({ message: "Seleccione un nivel académico" }),
    carreraId: z.number().nullable().optional(),
    nuevaCarreraNombre: z.string().trim().optional(),
    mencionId: z.number().nullable().optional(),
    nuevaMencionNombre: z.string().trim().optional(),
    institucionId: z.number().nullable().optional(),
    nuevaInstitucionNombre: z.string().trim().optional(),
  })
  .refine((data) => !(data.carreraId === ID_OTRA_FAMILIAR && !data.nuevaCarreraNombre?.trim()), {
    message: "Debe escribir el nombre de la nueva carrera",
    path: ["nuevaCarreraNombre"],
  })
  .refine((data) => !(data.mencionId === ID_OTRA_FAMILIAR && !data.nuevaMencionNombre?.trim()), {
    message: "Debe escribir el nombre de la nueva mención",
    path: ["nuevaMencionNombre"],
  })
  .refine((data) => !(data.institucionId === ID_OTRA_FAMILIAR && !data.nuevaInstitucionNombre?.trim()), {
    message: "Debe escribir el nombre de la nueva institución",
    path: ["nuevaInstitucionNombre"],
  })
  .refine(
    (data) => {
      if (data.carreraId != null && data.carreraId > 0) {
        const hasInstitucion = data.institucionId != null && data.institucionId > 0;
        const hasNuevaInstitucion = data.institucionId === ID_OTRA_FAMILIAR && !!data.nuevaInstitucionNombre?.trim();
        return hasInstitucion || hasNuevaInstitucion;
      }
      return true;
    },
    { message: "Debe seleccionar una institución", path: ["institucionId"] },
  )
  .nullable()
  .optional();

export const familiarSchema = z.object({
  empleadoCedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula del empleado inválida" }),
  cedulaFamiliar: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || REGEX.CEDULA_DIGITOS.test(v), {
      message: "Cédula del familiar inválida",
    }),
  primerNombre: z
    .string()
    .trim()
    .min(2, { message: "Primer nombre debe tener al menos 2 caracteres" })
    .regex(REGEX.SOLO_LETRAS, { message: "Primer nombre solo debe contener letras" }),
  segundoNombre: z
    .string()
    .trim()
    .regex(REGEX.SOLO_LETRAS, { message: "Segundo nombre solo debe contener letras" })
    .optional()
    .nullable(),
  primerApellido: z
    .string()
    .trim()
    .min(2, { message: "Primer apellido debe tener al menos 2 caracteres" })
    .regex(REGEX.SOLO_LETRAS, { message: "Primer apellido solo debe contener letras" }),
  segundoApellido: z
    .string()
    .trim()
    .regex(REGEX.SOLO_LETRAS, { message: "Segundo apellido solo debe contener letras" })
    .optional()
    .nullable(),
  parentescoId: z.number().positive({ message: "Seleccione un parentesco válido" }),
  fechaNacimiento: z
    .string()
    .regex(REGEX.FECHA_ISO, { message: "Formato de fecha inválido (YYYY-MM-DD)" }),
  sexoId: z.number().positive({ message: "Seleccione un sexo válido" }),
  mismoEnte: z.boolean().default(false),
  heredero: z.boolean().default(false),
  observaciones: z.string().optional().nullable(),
  formacionAcademica: formacionAcademicaFamiliarSchema,
});

export type FamiliarFormType = z.infer<typeof familiarSchema>;

/** Cédula de empleado para listar familiares (zero-trust R7). */
export const familiaresPorEmpleadoSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(REGEX.CEDULA_DIGITOS, { message: "Cédula del empleado inválida" }),
});

/** Identificador de familiar (zero-trust R7). */
export const familiarIdSchema = z.object({
  familiarId: z.number().int().positive({ message: "Familiar inválido" }),
});
