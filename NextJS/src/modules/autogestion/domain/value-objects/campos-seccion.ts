/**
 * Secciones autogestionables y sus campos editables. Espejo de `CAMPOS_POR_SECCION` del backend
 * (`apps/autogestion/domain/value_objects/secciones.py`): el servidor sigue siendo la fuente de verdad
 * y revalida; aquí solo se describe qué formulario mostrar y cómo rotular cada campo.
 */
import type { SeccionCodigo } from "../entities/solicitud-actualizacion";

export type TipoCampo =
  "texto" | "textarea" | "telefono" | "correo" | "booleano" | "fecha" | "catalogo";

export type ClaveCatalogo =
  | "estados"
  | "municipios"
  | "parroquias"
  | "condicionesVivienda"
  | "codigosPostales"
  | "nivelesAcademicos"
  | "carreras"
  | "menciones"
  | "instituciones"
  | "parentescos"
  | "sexos";

export interface CampoDef {
  campo: string;
  etiqueta: string;
  tipo: TipoCampo;
  catalogo?: ClaveCatalogo;
  /** Obligatorio al CREAR el registro (espejo de REQUERIDOS_AL_CREAR). */
  requeridoAlCrear?: boolean;
}

export interface EntidadDef {
  entidad: string;
  etiqueta: string;
  /** Registro único por trabajador (no lleva identificador). */
  unica: boolean;
  /** Se puede crear un registro nuevo (CREAR). */
  creable: boolean;
  campos: CampoDef[];
}

export interface SeccionDef {
  codigo: SeccionCodigo;
  nombre: string;
  descripcion: string;
  entidades: EntidadDef[];
}

export const CAMPO_REGISTRO_NUEVO = "*";

export const SECCIONES_DEF: Record<SeccionCodigo, SeccionDef> = {
  contacto: {
    codigo: "contacto",
    nombre: "Contacto",
    descripcion: "Teléfonos, correo alternativo y contacto de emergencia.",
    entidades: [
      {
        entidad: "employee",
        etiqueta: "Teléfonos",
        unica: true,
        creable: false,
        campos: [
          { campo: "telefono_movil", etiqueta: "Teléfono móvil", tipo: "telefono" },
          { campo: "telefono_habitacion", etiqueta: "Teléfono de habitación", tipo: "telefono" },
        ],
      },
      {
        entidad: "datos_complementarios",
        etiqueta: "Correo alternativo",
        unica: true,
        creable: false,
        campos: [{ campo: "correo_alternativo", etiqueta: "Correo alternativo", tipo: "correo" }],
      },
      {
        entidad: "contacto_emergencia",
        etiqueta: "Contacto de emergencia",
        unica: false,
        creable: true,
        campos: [
          { campo: "nombres", etiqueta: "Nombres", tipo: "texto", requeridoAlCrear: true },
          { campo: "apellidos", etiqueta: "Apellidos", tipo: "texto", requeridoAlCrear: true },
          { campo: "telefono", etiqueta: "Teléfono", tipo: "telefono" },
          {
            campo: "relacion_id",
            etiqueta: "Parentesco o relación",
            tipo: "catalogo",
            catalogo: "parentescos",
          },
        ],
      },
    ],
  },
  vivienda: {
    codigo: "vivienda",
    nombre: "Vivienda",
    descripcion: "Dirección y condición de la vivienda donde reside.",
    entidades: [
      {
        entidad: "datos_vivienda",
        etiqueta: "Vivienda",
        unica: true,
        creable: true,
        campos: [
          {
            campo: "estado_id",
            etiqueta: "Estado",
            tipo: "catalogo",
            catalogo: "estados",
            requeridoAlCrear: true,
          },
          {
            campo: "municipio_id",
            etiqueta: "Municipio",
            tipo: "catalogo",
            catalogo: "municipios",
            requeridoAlCrear: true,
          },
          {
            campo: "parroquia_id",
            etiqueta: "Parroquia",
            tipo: "catalogo",
            catalogo: "parroquias",
            requeridoAlCrear: true,
          },
          {
            campo: "direccion_exacta",
            etiqueta: "Dirección exacta",
            tipo: "textarea",
            requeridoAlCrear: true,
          },
          {
            campo: "condicion_vivienda_id",
            etiqueta: "Condición de la vivienda",
            tipo: "catalogo",
            catalogo: "condicionesVivienda",
            requeridoAlCrear: true,
          },
          {
            campo: "codigo_postal_id",
            etiqueta: "Código postal",
            tipo: "catalogo",
            catalogo: "codigosPostales",
            requeridoAlCrear: true,
          },
        ],
      },
    ],
  },
  formacion: {
    codigo: "formacion",
    nombre: "Formación académica",
    descripcion: "Títulos y estudios. Debe adjuntar el soporte (título o constancia).",
    entidades: [
      {
        entidad: "formacion_academica",
        etiqueta: "Formación académica",
        unica: false,
        creable: true,
        campos: [
          {
            campo: "nivel_academico_id",
            etiqueta: "Nivel académico",
            tipo: "catalogo",
            catalogo: "nivelesAcademicos",
            requeridoAlCrear: true,
          },
          { campo: "carrera_id", etiqueta: "Carrera", tipo: "catalogo", catalogo: "carreras" },
          { campo: "mencion_id", etiqueta: "Mención", tipo: "catalogo", catalogo: "menciones" },
          {
            campo: "institucion_id",
            etiqueta: "Institución",
            tipo: "catalogo",
            catalogo: "instituciones",
          },
        ],
      },
    ],
  },
  familiar: {
    codigo: "familiar",
    nombre: "Grupo familiar",
    descripcion:
      "Familiares y si tiene hijos. Debe adjuntar el soporte (acta de nacimiento o constancia).",
    entidades: [
      {
        entidad: "datos_complementarios",
        etiqueta: "¿Tiene hijos?",
        unica: true,
        creable: false,
        campos: [{ campo: "tiene_hijos", etiqueta: "¿Tiene hijos?", tipo: "booleano" }],
      },
      {
        entidad: "familiar",
        etiqueta: "Familiar",
        unica: false,
        creable: true,
        campos: [
          {
            campo: "primer_nombre",
            etiqueta: "Primer nombre",
            tipo: "texto",
            requeridoAlCrear: true,
          },
          { campo: "segundo_nombre", etiqueta: "Segundo nombre", tipo: "texto" },
          {
            campo: "primer_apellido",
            etiqueta: "Primer apellido",
            tipo: "texto",
            requeridoAlCrear: true,
          },
          { campo: "segundo_apellido", etiqueta: "Segundo apellido", tipo: "texto" },
          { campo: "cedula_familiar", etiqueta: "Cédula del familiar", tipo: "texto" },
          {
            campo: "parentesco_id",
            etiqueta: "Parentesco",
            tipo: "catalogo",
            catalogo: "parentescos",
            requeridoAlCrear: true,
          },
          {
            campo: "fecha_nacimiento",
            etiqueta: "Fecha de nacimiento",
            tipo: "fecha",
            requeridoAlCrear: true,
          },
          {
            campo: "sexo_id",
            etiqueta: "Sexo",
            tipo: "catalogo",
            catalogo: "sexos",
            requeridoAlCrear: true,
          },
          { campo: "observaciones", etiqueta: "Observaciones", tipo: "textarea" },
        ],
      },
    ],
  },
  foto: {
    codigo: "foto",
    nombre: "Foto",
    descripcion: "Foto de perfil para el carnet (JPG o PNG, hasta 5 MB).",
    entidades: [
      {
        entidad: "employee",
        etiqueta: "Foto",
        unica: true,
        creable: false,
        campos: [{ campo: "profile", etiqueta: "Foto de perfil", tipo: "texto" }],
      },
    ],
  },
};

export function esSeccionConocida(codigo: string): codigo is SeccionCodigo {
  return codigo in SECCIONES_DEF;
}

export function nombreSeccion(codigo: string): string {
  return esSeccionConocida(codigo) ? SECCIONES_DEF[codigo].nombre : codigo;
}

/** Etiqueta legible de un campo del backend (`telefono_movil` → «Teléfono móvil»). */
export function etiquetaCampo(campo: string, entidad?: string): string {
  if (campo === CAMPO_REGISTRO_NUEVO) {
    const def = entidad ? buscarEntidad(entidad) : undefined;
    return def ? `Registro nuevo: ${def.etiqueta.toLowerCase()}` : "Registro nuevo";
  }
  for (const seccion of Object.values(SECCIONES_DEF)) {
    for (const e of seccion.entidades) {
      if (entidad && e.entidad !== entidad) continue;
      const c = e.campos.find((x) => x.campo === campo);
      if (c) return c.etiqueta;
    }
  }
  return campo;
}

function buscarEntidad(entidad: string): EntidadDef | undefined {
  for (const seccion of Object.values(SECCIONES_DEF)) {
    const e = seccion.entidades.find((x) => x.entidad === entidad);
    if (e) return e;
  }
  return undefined;
}

export function definicionCampo(entidad: string, campo: string): CampoDef | undefined {
  for (const seccion of Object.values(SECCIONES_DEF)) {
    for (const e of seccion.entidades) {
      if (e.entidad !== entidad) continue;
      const c = e.campos.find((x) => x.campo === campo);
      if (c) return c;
    }
  }
  return undefined;
}

/** Campo del que depende un desplegable en cascada (estado → municipio → parroquia, etc.). */
export const CAMPO_PADRE: Record<string, string> = {
  municipio_id: "estado_id",
  parroquia_id: "municipio_id",
  codigo_postal_id: "estado_id",
  carrera_id: "nivel_academico_id",
  mencion_id: "carrera_id",
};

/** Tipos de soporte admitidos por sección (espejo de `TIPOS_SOPORTE_POR_SECCION` del backend). */
export const TIPOS_SOPORTE_POR_SECCION: Record<SeccionCodigo, { valor: string; texto: string }[]> =
  {
    contacto: [
      { valor: "CONSTANCIA", texto: "Constancia" },
      { valor: "OTRO", texto: "Otro documento" },
    ],
    vivienda: [
      { valor: "CONSTANCIA", texto: "Constancia de residencia" },
      { valor: "OTRO", texto: "Otro documento" },
    ],
    formacion: [
      { valor: "TITULO", texto: "Título" },
      { valor: "CONSTANCIA", texto: "Constancia de estudios" },
      { valor: "OTRO", texto: "Otro documento" },
    ],
    familiar: [
      { valor: "ACTA_NACIMIENTO", texto: "Acta de nacimiento" },
      { valor: "CONSTANCIA", texto: "Constancia" },
      { valor: "OTRO", texto: "Otro documento" },
    ],
    foto: [{ valor: "FOTO", texto: "Foto" }],
  };
