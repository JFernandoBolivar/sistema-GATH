/**
 * Secciones autogestionables y sus campos editables. Espejo de `CAMPOS_POR_SECCION` del backend
 * (`apps/autogestion/domain/value_objects/secciones.py`): el servidor sigue siendo la fuente de verdad
 * y revalida; aquí solo se describe qué formulario mostrar y cómo rotular cada campo.
 */
import type { AccionCambio, SeccionCodigo } from "../entities/solicitud-actualizacion";

export type TipoCampo =
  "texto" | "textarea" | "telefono" | "correo" | "booleano" | "fecha" | "catalogo" | "multiple";

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
  | "capacitaciones"
  | "gruposCapacitacion"
  | "parentescos"
  | "parentescosFamilia"
  | "sexos"
  | "estadosCiviles"
  | "gruposSanguineos"
  | "alergias"
  | "patologias"
  | "discapacidades"
  | "tallasCamisa"
  | "tallasPantalon"
  | "tallasZapatos"
  | "tallasChaqueta";

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
  identidad: {
    codigo: "identidad",
    nombre: "Identidad",
    descripcion:
      "Nombres, apellidos, fecha de nacimiento y cédula. La copia de la cédula es obligatoria. El estado civil y el Carnet de la Patria no requieren documento.",
    entidades: [
      {
        entidad: "employee",
        etiqueta: "Datos de identidad",
        unica: true,
        creable: false,
        campos: [
          { campo: "nombres", etiqueta: "Nombres", tipo: "texto" },
          { campo: "apellidos", etiqueta: "Apellidos", tipo: "texto" },
          { campo: "fecha_nacimiento", etiqueta: "Fecha de nacimiento", tipo: "fecha" },
          { campo: "cedulaidentidad", etiqueta: "Cédula de identidad", tipo: "texto" },
          {
            campo: "estadoCivil_id",
            etiqueta: "Estado civil",
            tipo: "catalogo",
            catalogo: "estadosCiviles",
          },
          { campo: "carnet_patria", etiqueta: "Carnet de la Patria", tipo: "texto" },
          {
            campo: "carnet_patria_serial",
            etiqueta: "Serial del Carnet de la Patria",
            tipo: "texto",
          },
        ],
      },
    ],
  },
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
          { campo: "telefono", etiqueta: "Teléfono", tipo: "telefono", requeridoAlCrear: true },
          {
            campo: "relacion_id",
            etiqueta: "Parentesco o relación",
            tipo: "catalogo",
            catalogo: "parentescos",
            requeridoAlCrear: true,
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
  complementaria: {
    codigo: "complementaria",
    nombre: "Formación complementaria",
    descripcion: "Cursos y capacitaciones. Debe adjuntar el certificado o constancia.",
    entidades: [
      {
        entidad: "formacion_complementaria",
        etiqueta: "Curso o capacitación",
        unica: false,
        creable: true,
        campos: [
          {
            campo: "capacitacion_id",
            etiqueta: "Capacitación",
            tipo: "catalogo",
            catalogo: "capacitaciones",
            requeridoAlCrear: true,
          },
          {
            campo: "institucion_id",
            etiqueta: "Institución",
            tipo: "catalogo",
            catalogo: "instituciones",
          },
          { campo: "fecha_inicio", etiqueta: "Fecha de inicio", tipo: "fecha" },
          { campo: "fecha_fin", etiqueta: "Fecha de fin", tipo: "fecha" },
          { campo: "horas_completadas", etiqueta: "Horas completadas", tipo: "texto" },
          { campo: "dias_completados", etiqueta: "Días completados", tipo: "texto" },
          {
            campo: "grupo_id",
            etiqueta: "Grupo",
            tipo: "catalogo",
            catalogo: "gruposCapacitacion",
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
            catalogo: "parentescosFamilia",
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
  salud: {
    codigo: "salud",
    nombre: "Salud y tallas",
    descripcion:
      "Grupo sanguíneo, alergias, patologías crónicas, discapacidades y tallas. No requiere documento.",
    entidades: [
      {
        entidad: "perfil_salud",
        etiqueta: "Perfil de salud",
        unica: true,
        creable: false,
        campos: [
          {
            campo: "grupo_sanguineo_id",
            etiqueta: "Grupo sanguíneo",
            tipo: "catalogo",
            catalogo: "gruposSanguineos",
          },
          { campo: "alergias", etiqueta: "Alergias", tipo: "multiple", catalogo: "alergias" },
          {
            campo: "patologias_cronicas",
            etiqueta: "Patologías crónicas",
            tipo: "multiple",
            catalogo: "patologias",
          },
          {
            campo: "discapacidades",
            etiqueta: "Discapacidades",
            tipo: "multiple",
            catalogo: "discapacidades",
          },
        ],
      },
      {
        entidad: "perfil_fisico",
        etiqueta: "Tallas",
        unica: true,
        creable: false,
        campos: [
          {
            campo: "talla_camisa_id",
            etiqueta: "Talla de camisa",
            tipo: "catalogo",
            catalogo: "tallasCamisa",
          },
          {
            campo: "talla_pantalon_id",
            etiqueta: "Talla de pantalón",
            tipo: "catalogo",
            catalogo: "tallasPantalon",
          },
          {
            campo: "talla_zapatos_id",
            etiqueta: "Talla de zapatos",
            tipo: "catalogo",
            catalogo: "tallasZapatos",
          },
          {
            campo: "talla_chaqueta_id",
            etiqueta: "Talla de chaqueta",
            tipo: "catalogo",
            catalogo: "tallasChaqueta",
          },
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

/** Identificador de un campo solicitable: `entidad.campo` (igual que el servidor). */
export function claveCampo(entidad: string, campo: string): string {
  return `${entidad}.${campo}`;
}

/** Acciones que se piden sobre los registros de una sección de lista (valores del backend). */
export const ACCIONES_SOLICITABLES = [
  { accion: "CREAR", etiqueta: "Agregar", frase: "agregar" },
  { accion: "MODIFICAR", etiqueta: "Corregir", frase: "corregir datos de" },
  { accion: "ELIMINAR", etiqueta: "Quitar", frase: "quitar" },
] as const satisfies readonly { accion: AccionCambio; etiqueta: string; frase: string }[];

/** Entidades de lista: en el paso 1 se piden por acción, no por campos sueltos. */
export const ENTIDADES_DE_LISTA: Record<string, { grupo: string; objeto: string }> = {
  familiar: { grupo: "Grupo familiar", objeto: "un familiar" },
  contacto_emergencia: { grupo: "Contactos de emergencia", objeto: "un contacto de emergencia" },
  formacion_academica: { grupo: "Formación académica", objeto: "una formación académica" },
  formacion_complementaria: {
    grupo: "Formación complementaria",
    objeto: "una formación complementaria",
  },
};

/** Prefijo que distingue una acción solicitada (`entidad.@CREAR`) de un campo (igual que el servidor). */
export const PREFIJO_ACCION = "@";

export function esEntidadDeLista(entidad: string): boolean {
  return entidad in ENTIDADES_DE_LISTA;
}

/** Identificador de una acción solicitable sobre una entidad de lista: `entidad.@ACCION`. */
export function claveAccion(entidad: string, accion: AccionCambio): string {
  return `${entidad}.${PREFIJO_ACCION}${accion}`;
}

/** Acciones permitidas sobre una entidad de lista según lo habilitado (solicitudes viejas: todas). */
export function accionesPermitidas(entidad: string, claves: string[]): AccionCambio[] {
  const pedidas = ACCIONES_SOLICITABLES.map((a) => a.accion).filter((a) =>
    claves.includes(claveAccion(entidad, a)),
  );
  if (pedidas.length > 0) return pedidas;
  const hayCampos = claves.some((c) => c.startsWith(`${entidad}.`));
  return hayCampos ? ACCIONES_SOLICITABLES.map((a) => a.accion) : [];
}

/** ¿La entidad se pidió por acciones (solicitud nueva) y no por campos sueltos? */
export function pedidaPorAcciones(entidad: string, claves: string[]): boolean {
  return ACCIONES_SOLICITABLES.some((a) => claves.includes(claveAccion(entidad, a.accion)));
}

/** Sección que agrupa un campo o acción solicitable (`entidad.campo` o `entidad.@ACCION`), si existe. */
export function seccionDeCampo(clave: string): SeccionCodigo | undefined {
  const punto = clave.indexOf(".");
  const entidadClave = punto < 0 ? clave : clave.slice(0, punto);
  const resto = punto < 0 ? "" : clave.slice(punto + 1);
  if (resto.startsWith(PREFIJO_ACCION)) {
    const accion = ACCIONES_SOLICITABLES.find((a) => a.accion === resto.slice(1));
    if (!accion || !esEntidadDeLista(entidadClave)) return undefined;
    for (const seccion of Object.values(SECCIONES_DEF)) {
      if (seccion.entidades.some((e) => e.entidad === entidadClave)) return seccion.codigo;
    }
    return undefined;
  }
  for (const seccion of Object.values(SECCIONES_DEF)) {
    for (const e of seccion.entidades) {
      if (e.campos.some((c) => claveCampo(e.entidad, c.campo) === clave)) return seccion.codigo;
    }
  }
  return undefined;
}

/** Etiqueta legible de un campo solicitable `entidad.campo`. */
export function etiquetaClaveCampo(clave: string): string {
  const [entidad, ...resto] = clave.split(".");
  const accion = ACCIONES_SOLICITABLES.find((a) => `${PREFIJO_ACCION}${a.accion}` === resto.join("."));
  if (accion && esEntidadDeLista(entidad)) {
    return `Quiere ${accion.frase} ${ENTIDADES_DE_LISTA[entidad].objeto}`;
  }
  return etiquetaCampo(resto.join("."), entidad);
}

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
    identidad: [{ valor: "CEDULA", texto: "Copia de la cédula" }],
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
    complementaria: [
      { valor: "CONSTANCIA", texto: "Certificado o constancia" },
      { valor: "OTRO", texto: "Otro documento" },
    ],
    familiar: [
      { valor: "CEDULA", texto: "Copia de la cédula" },
      { valor: "ACTA_NACIMIENTO", texto: "Partida de nacimiento" },
      { valor: "CONSTANCIA", texto: "Constancia" },
      { valor: "OTRO", texto: "Otro documento" },
    ],
    salud: [],
    foto: [{ valor: "FOTO", texto: "Foto" }],
  };
