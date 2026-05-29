import { z } from "zod"

export const GERENCIA_OPTIONS = [
  { value: "PRESIDENCIA", label: "PRESIDENCIA" },
  { value: "GERENCIA_GENERAL", label: "GERENCIA GENERAL" },
  { value: "GERENCIA_GESTION_HUMANA", label: "GERENCIA DE GESTIÓN HUMANA" },
  { value: "GERENCIA_TECNOLOGIA", label: "GERENCIA DE TECNOLOGÍA" },
  { value: "GERENCIA_ADMINISTRACION", label: "GERENCIA DE ADMINISTRACIÓN Y FINANZAS" },
  { value: "GERENCIA_CONSULTORIA", label: "GERENCIA DE CONSULTORÍA JURÍDICA" },
  { value: "GERENCIA_OPERACIONES", label: "GERENCIA DE OPERACIONES" },
  { value: "GERENCIA_PLANIFICACION", label: "GERENCIA DE PLANIFICACIÓN" },
  { value: "OFICINA_ATENCION", label: "OFICINA DE ATENCIÓN AL CIUDADANO" },
  { value: "OFICINA_COMUNICACIONES", label: "OFICINA DE COMUNICACIONES" },
] as const

export const TIPO_NOMINA_OPTIONS = [
  { value: "FIJO", label: "FIJO" },
  { value: "CONTRATADO", label: "CONTRATADO" },
  { value: "SUPLENTE", label: "SUPLENTE" },
  { value: "JUBILADO", label: "JUBILADO" },
] as const

export const ENCUESTA_GMVV_OPTIONS = [
  { value: "si_completo", label: "SÍ, YA LA RECIBÍ Y LA COMPLETÉ" },
  { value: "no_recibido", label: "NO, NO LA HE RECIBIDO (AÚN NO SE ME REFLEJA EN LA PLATAFORMA)" },
  { value: "recibido_no_completado", label: "LA RECIBÍ, PERO AÚN NO LA HE COMPLETADO" },
] as const

export const SI_NO_OPTIONS = [
  { value: "si", label: "SÍ" },
  { value: "no", label: "NO" },
] as const

export const ESTADO_CIVIL_OPTIONS = [
  { value: "soltero", label: "SOLTER@" },
  { value: "casado", label: "CASAD@" },
  { value: "divorciado", label: "DIVORCIAD@" },
  { value: "viudo", label: "VIUD@" },
] as const

export const BENEFICIADO_PROGRAMA_OPTIONS = [
  { value: "vivienda_social", label: "SÍ — RECIBÍ UNA VIVIENDA SOCIAL" },
  { value: "adecuacion_vivienda", label: "SÍ — RECIBÍ APOYO PARA ADECUACIÓN DE MI VIVIENDA" },
  { value: "credito_vivienda", label: "SÍ — RECIBÍ CRÉDITO PARA ADQUISICIÓN Y/O REHABILITACIÓN DE VIVIENDA" },
  { value: "no_en_espera", label: "NO — ESTOY REGISTRADO Y EN ESPERA DE VIVIENDA NUEVA" },
  { value: "no_nunca_registrado_necesita", label: "NO — NUNCA ME HE REGISTRADO Y NECESITO UNA VIVIENDA" },
  { value: "no_nunca_registrado_rehabilitar", label: "NO — NUNCA ME HE REGISTRADO Y NECESITO REHABILITAR MI VIVIENDA" },
  { value: "no_aplica", label: "NO — NO APLICA / NO NECESITO" },
] as const

export const SITUACION_HABITACIONAL_OPTIONS = [
  { value: "propia_sin_deuda", label: "PROPIA SIN DEUDA" },
  { value: "propia_con_hipoteca", label: "PROPIA CON HIPOTECA/PENDIENTE" },
  { value: "vivienda_familiar", label: "VIVIENDA FAMILIAR" },
  { value: "alquilado", label: "ALQUILAD@" },
  { value: "deteriorada", label: "DETERIORADA (PISOS, PAREDES, BAÑO, TECHOS, ETC.)" },
  { value: "otro", label: "OTRO" },
] as const

export const REHABILITACION_OPTIONS = [
  { value: "si_adecuacion", label: "SÍ — APOYO PARA ADECUACIÓN DE MI VIVIENDA" },
  { value: "no_aplica_rehabilitacion", label: "NO — (NO APLICA / NO POSEO VIVIENDA)" },
  { value: "no_necesita_rehabilitacion", label: "NO — PERO NECESITO LA ADECUACIÓN, MEJORAS Y REHABILITACIÓN DE MI VIVIENDA PRINCIPAL" },
] as const

export const censoViviendaSchema = z.object({
  cedula_identidad: z.string().optional(),
  nombres: z.string().optional(),
  apellidos: z.string().optional(),
  gerencia: z.string().optional(),
  fecha_ingreso: z.string().optional(),
  tipo_nomina: z.string().optional(),
  anios_servicio_conatel: z.string().optional(),
  anios_servicio_apn: z.string().optional(),
  telefono: z.string().optional(),
  estado_civil: z.string().optional(),
  direccion: z.string().optional(),

  carnet_patria: z
    .string({ required_error: "El N° de Carnet de la Patria es obligatorio" })
    .min(1, "Campo obligatorio"),
  encuesta_gmvv: z
    .string({ required_error: "Seleccione una opción" })
    .min(1, "Seleccione una opción"),
  servicios_previos: z
    .string({ required_error: "Seleccione una opción" })
    .min(1, "Seleccione una opción"),
  registrado_0800: z
    .string({ required_error: "Seleccione una opción" })
    .min(1, "Seleccione una opción"),
  vivienda_propia: z
    .string({ required_error: "Seleccione una opción" })
    .min(1, "Seleccione una opción"),
  beneficiado_programa: z
    .string({ required_error: "Seleccione una opción" })
    .min(1, "Seleccione una opción"),
  situacion_habitacional: z
    .string({ required_error: "Seleccione una opción" })
    .min(1, "Seleccione una opción"),
  valor_alquiler: z.string().optional(),
  numero_personas_hogar: z
    .string({ required_error: "Campo obligatorio" })
    .min(1, "Campo obligatorio"),
  beneficiado_rehabilitacion: z
    .string({ required_error: "Seleccione una opción" })
    .min(1, "Seleccione una opción"),
  declaracion_fidedigna: z
    .boolean({ required_error: "Debe aceptar la declaración" })
    .refine((val) => val === true, "Debe aceptar la declaración"),
  acepto: z
    .boolean({ required_error: "Debe aceptar la declaración" })
    .refine((val) => val === true, "Debe aceptar la declaración"),
})

export type CensoViviendaValues = z.infer<typeof censoViviendaSchema>
