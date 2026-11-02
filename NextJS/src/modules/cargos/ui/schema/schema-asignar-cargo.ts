import { z } from "zod";
import { ERROR, REGEX } from "@/shared/domain/validation";

/** Filtro de listado de cargos (zero-trust R7). */
export const cargosFiltroSchema = z.object({
  dependenciaId: z.number().int().positive().optional().nullable(),
  tipoNominaId: z.number().int().positive().optional().nullable(),
  direccionGeneralId: z.number().int().positive().optional().nullable(),
  direccionLineaId: z.number().int().positive().optional().nullable(),
  coordinacionId: z.number().int().positive().optional().nullable(),
  codigo: z.string().optional().nullable(),
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

/** Creación de un código de posición vacante (zero-trust R7), réplica del legado (schemaCode). */
export const crearCargoSchema = z.object({
  denominacionId: z.number().int().positive({ message: "Seleccione una denominación de cargo" }),
  especificaId: z.number().int().positive({ message: "Seleccione una denominación de cargo específico" }),
  tipoNominaId: z.number().int().positive({ message: "Seleccione un tipo de nómina" }),
  dependenciaId: z.number().int().positive().optional(),
  direccionGeneralId: z.number().int().positive().optional(),
  direccionLineaId: z.number().int().positive().optional(),
  coordinacionId: z.number().int().positive().optional(),
  organismoId: z.number().int().positive().optional(),
  gradoId: z.number().int().positive().optional(),
  observaciones: z.string().trim().max(500, ERROR.MAX_LENGTH(500)).optional(),
});

export type AsignarCargoFormType = z.infer<typeof asignarCargoSchema>;
export type CargosFiltroFormType = z.infer<typeof cargosFiltroSchema>;
export type CambiarCargoFormType = z.infer<typeof cambiarCargoSchema>;
export type GestionarEstatusFormType = z.infer<typeof gestionarEstatusSchema>;
export type CrearPrestamoFormType = z.infer<typeof crearPrestamoSchema>;
export type DenominacionFormType = z.infer<typeof denominacionSchema>;
export type CrearCargoFormType = z.infer<typeof crearCargoSchema>;

export const schemaAsignCode = z.object({
  code: z.number().min(1, { message: "Debe seleccionar un código" }),
  employee: z.string().min(1, { message: "Debe buscar un empleado" }),
});
export type SchemaAsignCodeType = z.infer<typeof schemaAsignCode>;

export const schemaCodeEspecial = z.object({
  employee: z.string().min(1, { message: "Debe seleccionar un empleado" }),
  OrganismoAdscritoid: z.number().optional().default(0),
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
export type SchemaCodeEspecialType = z.infer<typeof schemaCodeEspecial>;

export const schemaFilterForm = z.object({
  tipo_nomina: z.coerce.number().optional(),
  codigo: z.string().optional(),
  dependencia_id: z.coerce.number().optional(),
  direccion_general_id: z.coerce.number().optional(),
  direccion_linea_id: z.coerce.number().optional(),
  coordinacion_id: z.coerce.number().optional(),
});
export type SchemaFilterFormType = z.infer<typeof schemaFilterForm>;

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

