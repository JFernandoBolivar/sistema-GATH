/**
 * Esquemas zod del editor: espejo del esquema del backend (`esquema_documento.py`).
 * Sirven para avisar antes de guardar; la validación definitiva sigue siendo la del servidor.
 */
import { z } from "zod";

import type {
  Bloque,
  CampoOverlay,
  CampoPropio,
  ErrorValidacion,
  ModoPlantilla,
  PaginaFondo,
} from "../entities/plantilla";
import { PREFIJO_PROPIO, type ContextoVariables, variablesDesconocidas } from "./variables";

export const LIMITES = {
  MAX_BLOQUES: 120,
  MAX_CELDAS: 6,
  MAX_OPCIONES: 12,
  MAX_COLUMNAS_TABLA: 8,
  MAX_FILAS_MINIMAS: 40,
  MAX_FIRMANTES: 4,
  MAX_CAMPOS_PROPIOS: 40,
  MAX_PAGINAS_OVERLAY: 30,
  MAX_CAMPOS_POR_PAGINA: 250,
  MAX_TEXTO: 4000,
  MAX_ETIQUETA: 300,
  TAMANO_FUENTE: [5, 28] as const,
  LADO_MAXIMO_MM: 700,
} as const;

const REGEX_CLAVE_PROPIA = /^[a-z][a-z0-9_]{0,39}$/;

const etiqueta = (max: number = LIMITES.MAX_ETIQUETA) =>
  z.string({ message: "Debe ser un texto." }).max(max, `No puede superar ${max} caracteres.`);
const obligatoria = (max: number = LIMITES.MAX_ETIQUETA) =>
  etiqueta(max).refine((s) => s.trim().length > 0, "Es obligatorio.");
const numero = (min: number, max: number) =>
  z
    .number({ message: "Debe ser un número." })
    .min(min, `Debe estar entre ${min} y ${max}.`)
    .max(max, `Debe estar entre ${min} y ${max}.`);
const entero = (min: number, max: number) => numero(min, max).int("Debe ser un número entero.");
const alineacionCorta = z.enum(["izquierda", "centro", "derecha"], { message: "Alineación no permitida." });

/** Valida un elemento con el esquema que corresponde a su `tipo` (los esquemas con refinamientos no caben en una unión discriminada). */
function despachar<T>(porTipo: Record<string, z.ZodTypeAny>, mensajeTipo: string): z.ZodType<T> {
  return z.unknown().superRefine((valor, ctx) => {
    const tipo = (valor as { tipo?: string } | null)?.tipo;
    const esquema = tipo ? porTipo[tipo] : undefined;
    if (!esquema) {
      ctx.addIssue({ code: "custom", path: ["tipo"], message: mensajeTipo });
      return;
    }
    const r = esquema.safeParse(valor);
    if (!r.success) for (const i of r.error.issues) ctx.addIssue({ code: "custom", path: i.path, message: i.message });
  }) as unknown as z.ZodType<T>;
}

// ───────────────────────── campos propios ─────────────────────────

const campoPropioSchema = z
  .object({
    clave: z.string().regex(REGEX_CLAVE_PROPIA, "La clave usa minúsculas, números y guion bajo, y empieza con una letra."),
    etiqueta: obligatoria(),
    tipo: z.enum(["texto", "texto_largo", "fecha", "si_no", "opcion"]),
    obligatorio: z.boolean(),
    ayuda: etiqueta(240),
    opciones: z.array(obligatoria(80)).max(30, "Indique de 1 a 30 opciones.").optional(),
  })
  .superRefine((c, ctx) => {
    if (c.tipo === "opcion" && (!c.opciones || c.opciones.length < 1)) {
      ctx.addIssue({ code: "custom", path: ["opciones"], message: "Indique de 1 a 30 opciones." });
    }
  });

export const camposPropiosSchema = z
  .array(campoPropioSchema)
  .max(LIMITES.MAX_CAMPOS_PROPIOS, `Se admiten hasta ${LIMITES.MAX_CAMPOS_PROPIOS} campos propios.`)
  .superRefine((lista, ctx) => {
    const vistas = new Set<string>();
    lista.forEach((c, i) => {
      if (vistas.has(c.clave)) {
        ctx.addIssue({ code: "custom", path: [i, "clave"], message: `La clave «${c.clave}» está repetida.` });
      }
      vistas.add(c.clave);
    });
  });

// ───────────────────────── modo formulario ─────────────────────────

function esquemaBloque(ctx: ContextoVariables) {
  const escalar = z.string().refine((v) => ctx.escalares.has(v), (v) => ({ message: `Variable desconocida: «${v}».` }));
  const textoConVariables = obligatoria(LIMITES.MAX_TEXTO).superRefine((t, c) => {
    const malas = variablesDesconocidas(t, ctx);
    if (malas.length) c.addIssue({ code: "custom", message: `Variable desconocida: ${malas.map((v) => `{${v}}`).join(", ")}` });
  });

  const tabla = z
    .object({
      id: z.string(),
      tipo: z.literal("tabla"),
      titulo: etiqueta(),
      coleccion: z.string(),
      columnas: z
        .array(z.object({ variable: z.string(), etiqueta: etiqueta(60), ancho: numero(1, 12) }))
        .min(1, `Una tabla lleva de 1 a ${LIMITES.MAX_COLUMNAS_TABLA} columnas.`)
        .max(LIMITES.MAX_COLUMNAS_TABLA, `Una tabla lleva de 1 a ${LIMITES.MAX_COLUMNAS_TABLA} columnas.`),
      filas_minimas: entero(0, LIMITES.MAX_FILAS_MINIMAS),
    })
    .superRefine((t, c) => {
      const columnas = ctx.colecciones.get(t.coleccion);
      if (!columnas) {
        c.addIssue({ code: "custom", path: ["coleccion"], message: "Elija una colección válida (familiares, estudios, cursos...)." });
        return;
      }
      t.columnas.forEach((col, j) => {
        if (!columnas.has(col.variable)) {
          c.addIssue({ code: "custom", path: ["columnas", j, "variable"], message: `La columna debe ser de la colección «${t.coleccion}».` });
        }
      });
    });

  return despachar<Bloque>({
    seccion: z.object({ id: z.string(), tipo: z.literal("seccion"), titulo: obligatoria() }),
    fila_campos: z.object({
      id: z.string(),
      tipo: z.literal("fila_campos"),
      celdas: z
        .array(
          z.object({
            etiqueta: etiqueta(),
            variable: escalar.nullable(),
            ancho: numero(1, 12),
          }),
        )
        .min(1, `Una fila lleva de 1 a ${LIMITES.MAX_CELDAS} celdas.`)
        .max(LIMITES.MAX_CELDAS, `Una fila lleva de 1 a ${LIMITES.MAX_CELDAS} celdas.`),
      alto_mm: numero(8, 120),
    }),
    casillas: z.object({
      id: z.string(),
      tipo: z.literal("casillas"),
      etiqueta: etiqueta(),
      variable: z.string().refine((v) => ctx.escalares.has(v), "Elija la variable cuyo valor marca la opción."),
      columnas: entero(1, 6),
      opciones: z
        .array(z.object({ valor: obligatoria(80), etiqueta: obligatoria(80) }))
        .min(1, `Indique de 1 a ${LIMITES.MAX_OPCIONES} opciones.`)
        .max(LIMITES.MAX_OPCIONES, `Indique de 1 a ${LIMITES.MAX_OPCIONES} opciones.`),
    }),
    tabla,
    parrafo: z.object({
      id: z.string(),
      tipo: z.literal("parrafo"),
      texto: textoConVariables,
      alineacion: z.enum(["izquierda", "centro", "derecha", "justificado"]),
    }),
    foto: z.object({
      id: z.string(),
      tipo: z.literal("foto"),
      alineacion: alineacionCorta,
      ancho_mm: numero(15, 80),
      alto_mm: numero(15, 100),
    }),
    firmas: z.object({
      id: z.string(),
      tipo: z.literal("firmas"),
      firmantes: z
        .array(z.object({ etiqueta: obligatoria(80), detalle: etiqueta(120) }))
        .min(1, `Indique de 1 a ${LIMITES.MAX_FIRMANTES} firmantes.`)
        .max(LIMITES.MAX_FIRMANTES, `Indique de 1 a ${LIMITES.MAX_FIRMANTES} firmantes.`),
    }),
    salto_pagina: z.object({ id: z.string(), tipo: z.literal("salto_pagina") }),
  }, "Tipo de bloque no permitido.");
}

export function esquemaFormulario(ctx: ContextoVariables) {
  return z.object({
    pagina: z.object({
      tamano: z.enum(["carta", "oficio"]),
      orientacion: z.enum(["vertical", "horizontal"]),
    }),
    encabezado: z.object({
      tipo: z.enum(["institucional", "logo_propio", "ninguno"]),
      titulo: etiqueta(160),
      subtitulo: etiqueta(200),
      logo_clave: z.string().max(200).optional(),
    }),
    bloques: z
      .array(esquemaBloque(ctx))
      .max(LIMITES.MAX_BLOQUES, `Se admiten hasta ${LIMITES.MAX_BLOQUES} bloques.`)
      .superRefine((lista, c) => {
        const vistos = new Set<string>();
        lista.forEach((b, i) => {
          if (vistos.has(b.id)) c.addIssue({ code: "custom", path: [i, "id"], message: `El identificador «${b.id}» está repetido.` });
          vistos.add(b.id);
        });
      }),
  });
}

// ───────────────────────── modo pdf_overlay ─────────────────────────

function esquemaCampoOverlay(ctx: ContextoVariables) {
  const geom = {
    id: z.string(),
    x: numero(0, LIMITES.LADO_MAXIMO_MM),
    y: numero(0, LIMITES.LADO_MAXIMO_MM),
    w: numero(1, LIMITES.LADO_MAXIMO_MM),
    h: numero(1, LIMITES.LADO_MAXIMO_MM),
  };
  const [fmin, fmax] = LIMITES.TAMANO_FUENTE;
  const tabla = z
    .object({
      ...geom,
      tipo: z.literal("tabla"),
      coleccion: z.string(),
      columnas: z
        .array(
          z.object({
            variable: z.string(),
            dx: numero(0, LIMITES.LADO_MAXIMO_MM),
            ancho: numero(1, LIMITES.LADO_MAXIMO_MM),
            alineacion: alineacionCorta,
          }),
        )
        .min(1, `Una tabla lleva de 1 a ${LIMITES.MAX_COLUMNAS_TABLA} columnas.`)
        .max(LIMITES.MAX_COLUMNAS_TABLA, `Una tabla lleva de 1 a ${LIMITES.MAX_COLUMNAS_TABLA} columnas.`),
      interlineado: numero(2, 60),
      filas_max: entero(1, 60),
      tamano: numero(fmin, fmax),
    })
    .superRefine((t, c) => {
      const columnas = ctx.colecciones.get(t.coleccion);
      if (!columnas) {
        c.addIssue({ code: "custom", path: ["coleccion"], message: "Elija una colección válida." });
        return;
      }
      t.columnas.forEach((col, j) => {
        if (!columnas.has(col.variable)) {
          c.addIssue({ code: "custom", path: ["columnas", j, "variable"], message: `La columna debe ser de la colección «${t.coleccion}».` });
        }
      });
    });

  const casilla = z
    .object({
      ...geom,
      tipo: z.literal("casilla"),
      condicion: z.object({
        variable: z.string().refine((v) => ctx.escalares.has(v), "Elija la variable de la condición."),
        operador: z.enum(["igual", "distinto", "no_vacio", "vacio"]),
        valor: etiqueta(120),
      }),
    })
    .superRefine((c, r) => {
      if ((c.condicion.operador === "igual" || c.condicion.operador === "distinto") && !c.condicion.valor.trim()) {
        r.addIssue({ code: "custom", path: ["condicion", "valor"], message: "Indique el valor con el que se compara." });
      }
    });

  return despachar<CampoOverlay>({
    texto: z.object({
      ...geom,
      tipo: z.literal("texto"),
      texto: obligatoria(LIMITES.MAX_TEXTO).superRefine((t, c) => {
        const malas = variablesDesconocidas(t, ctx);
        if (malas.length) c.addIssue({ code: "custom", message: `Variable desconocida: ${malas.map((v) => `{${v}}`).join(", ")}` });
      }),
      tamano: numero(fmin, fmax),
      alineacion: alineacionCorta,
      negrita: z.boolean(),
    }),
    casilla,
    foto: z.object({ ...geom, tipo: z.literal("foto") }),
    tabla,
  }, "Tipo de campo no permitido.");
}

export function esquemaOverlay(ctx: ContextoVariables, paginasFondo: PaginaFondo[] | null | undefined) {
  const campo = esquemaCampoOverlay(ctx);
  return z
    .object({
      paginas: z
        .array(
          z.object({
            origen: entero(1, 100000),
            campos: z
              .array(campo)
              .max(LIMITES.MAX_CAMPOS_POR_PAGINA, `Se admiten hasta ${LIMITES.MAX_CAMPOS_POR_PAGINA} campos por página.`),
          }),
        )
        .max(LIMITES.MAX_PAGINAS_OVERLAY, `Se admiten hasta ${LIMITES.MAX_PAGINAS_OVERLAY} páginas.`),
    })
    .superRefine((def, c) => {
      if (def.paginas.length && !paginasFondo?.length) {
        c.addIssue({ code: "custom", path: ["paginas"], message: "Suba primero el PDF de fondo para elegir sus páginas." });
        return;
      }
      const vistos = new Set<string>();
      def.paginas.forEach((p, i) => {
        const dim = paginasFondo?.find((f) => f.numero === p.origen);
        if (!dim) {
          c.addIssue({ code: "custom", path: ["paginas", i, "origen"], message: "La página de origen no existe en el PDF de fondo." });
          return;
        }
        p.campos.forEach((campoP, j) => {
          if (vistos.has(campoP.id)) {
            c.addIssue({ code: "custom", path: ["paginas", i, "campos", j, "id"], message: `El identificador «${campoP.id}» está repetido.` });
          }
          vistos.add(campoP.id);
          if (campoP.x > dim.ancho_mm + 1) {
            c.addIssue({ code: "custom", path: ["paginas", i, "campos", j, "x"], message: "El campo queda fuera de la página (a la derecha)." });
          }
          if (campoP.y > dim.alto_mm + 1) {
            c.addIssue({ code: "custom", path: ["paginas", i, "campos", j, "y"], message: "El campo queda fuera de la página (abajo)." });
          }
        });
      });
    });
}

// ───────────────────────── validación conjunta ─────────────────────────

function aErrores(error: z.ZodError, prefijo = ""): ErrorValidacion[] {
  return error.issues.map((i) => ({
    ruta: [prefijo, ...i.path.map(String)].filter(Boolean).join("."),
    mensaje: i.message,
  }));
}

export interface EntradaValidacion {
  modo: ModoPlantilla;
  definicion: unknown;
  campos_propios: CampoPropio[];
}

/** Valida el borrador y devuelve los errores con ruta (`bloques.3.celdas.0.variable`, `campos_propios.1.clave`...). */
export function validarBorrador(
  entrada: EntradaValidacion,
  ctx: ContextoVariables,
  paginasFondo?: PaginaFondo[] | null,
): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];
  const propios = camposPropiosSchema.safeParse(entrada.campos_propios);
  if (!propios.success) errores.push(...aErrores(propios.error, "campos_propios"));
  const esquema = entrada.modo === "formulario" ? esquemaFormulario(ctx) : esquemaOverlay(ctx, paginasFondo);
  const def = esquema.safeParse(entrada.definicion);
  if (!def.success) errores.push(...aErrores(def.error));
  return errores;
}

export { PREFIJO_PROPIO };
