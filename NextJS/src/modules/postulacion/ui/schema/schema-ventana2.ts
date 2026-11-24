import { z } from "zod";
import {
  edadEnAnios,
  LIMITES_VENTANA2,
  MAX_ANTECEDENTES,
  MAX_CURSOS,
  MAX_ESTUDIOS,
  MAX_FAMILIARES,
  MAX_IDIOMAS,
  normalizarRif,
  NIVELES_IDIOMA,
  OTRO_IDIOMA,
  parentescoAdmiteSinCedula,
  reglaCedulaFamiliar,
  type ParentescoCatalogo,
} from "../../domain/ventana2";

/**
 * Esquemas de cada sección de la Ventana 2. Dos modos:
 * - `estricto: false` («Guardar avance»): solo formatos y máximos; se puede guardar a medias.
 * - `estricto: true` («Guardar y continuar»): además exige lo obligatorio y las reglas de cada familiar.
 */
export interface OpcionesEsquema {
  estricto: boolean;
  /** «Hoy» inyectable para poder probar las reglas de edad. */
  hoy?: Date;
}

const SOLO_LETRAS = /^[\p{L}][\p{L}\s'’.-]*$/u;
const CEDULA = /^[A-Za-z0-9-]+$/;
const MSG_LETRAS = "Usa solo letras";

const texto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const nombre = () => texto(LIMITES_VENTANA2.nombre).refine((v) => v === "" || SOLO_LETRAS.test(v), MSG_LETRAS);

/** `AAAA-MM-DD` real, no futura y de una persona viva razonable; `null` si es válida. */
export function problemaDeFecha(valor: string, hoy: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "Escribe una fecha válida";
  const edad = edadEnAnios(valor, hoy);
  if (edad === null) return "Escribe una fecha válida";
  const [a, m, d] = valor.split("-").map(Number);
  if (Date.UTC(a, m - 1, d) > hoy.getTime()) return "La fecha de nacimiento no puede ser futura";
  if (edad > LIMITES_VENTANA2.edadMaximaFamiliar) return `La fecha de nacimiento no puede superar ${LIMITES_VENTANA2.edadMaximaFamiliar} años`;
  return null;
}

function crearEsquemaFamiliar(parentescos: readonly ParentescoCatalogo[], { estricto, hoy = new Date() }: OpcionesEsquema) {
  return z
    .object({
      primerNombre: nombre(),
      segundoNombre: nombre(),
      primerApellido: nombre(),
      segundoApellido: nombre(),
      cedula: texto(LIMITES_VENTANA2.cedula).refine((v) => v === "" || CEDULA.test(v), "Usa solo letras y números"),
      ordenHijo: z.string().trim(),
      parentescoId: z.string(),
      sexoId: z.string(),
      fechaNacimiento: z.string(),
      dependeEconomicamente: z.enum(["", "si", "no"]),
    })
    .superRefine((f, ctx) => {
      const falta = (path: keyof typeof f, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

      if (f.fechaNacimiento) {
        const problema = problemaDeFecha(f.fechaNacimiento, hoy);
        if (problema) falta("fechaNacimiento", problema);
      }
      if (f.ordenHijo) {
        const n = Number(f.ordenHijo);
        if (!/^\d+$/.test(f.ordenHijo) || n < LIMITES_VENTANA2.ordenMin || n > LIMITES_VENTANA2.ordenMax) {
          falta("ordenHijo", `Escribe un número entre ${LIMITES_VENTANA2.ordenMin} y ${LIMITES_VENTANA2.ordenMax}`);
        }
      }
      if (!estricto) return;

      if (!f.primerNombre) falta("primerNombre", "Escribe el primer nombre");
      if (!f.primerApellido) falta("primerApellido", "Escribe el primer apellido");
      if (!f.parentescoId) falta("parentescoId", "Elige el parentesco");
      if (!f.sexoId) falta("sexoId", "Elige el sexo");
      if (!f.fechaNacimiento) falta("fechaNacimiento", "Escribe la fecha de nacimiento");
      if (!f.dependeEconomicamente) falta("dependeEconomicamente", "Indica si depende económicamente de ti");

      // Regla de la cédula: solo un hijo o menor a cargo pequeño puede no tenerla, y entonces lleva orden.
      const parentesco = parentescos.find((p) => String(p.id) === f.parentescoId);
      if (!f.cedula && parentesco && f.fechaNacimiento && !problemaDeFecha(f.fechaNacimiento, hoy)) {
        const regla = reglaCedulaFamiliar(parentesco, f.fechaNacimiento, hoy);
        if (!regla.puedeSinCedula) {
          falta(
            "cedula",
            parentescoAdmiteSinCedula(parentesco)
              ? `Escribe la cédula: solo los menores de ${regla.edadLimite} años pueden no tenerla`
              : "Escribe la cédula del familiar",
          );
        } else if (regla.requiereOrden && !f.ordenHijo) {
          falta("ordenHijo", "Indica el orden de nacimiento (1 para el mayor, 2 para el siguiente…)");
        }
      }
    });
}

export function crearEsquemaFamiliares(parentescos: readonly ParentescoCatalogo[], opciones: OpcionesEsquema) {
  const familiar = crearEsquemaFamiliar(parentescos, opciones);
  return z
    .object({
      sinFamiliares: z.boolean(),
      familiares: z.array(familiar).max(MAX_FAMILIARES, `Se admiten como máximo ${MAX_FAMILIARES} familiares`),
    })
    .superRefine((v, ctx) => {
      if (v.sinFamiliares && v.familiares.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sinFamiliares"],
          message: "Quita los familiares o desmarca «No tengo carga familiar»",
        });
      }
      if (opciones.estricto && !v.sinFamiliares && v.familiares.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["familiares"],
          message: "Agrega al menos un familiar o marca «No tengo carga familiar»",
        });
      }
      const vistas = new Map<string, number>();
      v.familiares.forEach((f, i) => {
        const c = f.cedula.trim().toUpperCase();
        if (!c) return;
        if (vistas.has(c)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["familiares", i, "cedula"],
            message: "Esta cédula ya está registrada para otro familiar",
          });
        }
        vistas.set(c, i);
      });
    });
}

export function crearEsquemaVivienda({ estricto }: OpcionesEsquema) {
  const requerido = (mensaje: string) => (estricto ? z.string().min(1, mensaje) : z.string());
  return z.object({
    condicionViviendaId: requerido("Elige el tipo y tenencia de la vivienda"),
    estadoId: requerido("Elige el estado"),
    municipioId: requerido("Elige el municipio"),
    parroquiaId: requerido("Elige la parroquia"),
    direccionExacta: estricto
      ? texto(LIMITES_VENTANA2.direccion).min(1, "Escribe la dirección exacta")
      : texto(LIMITES_VENTANA2.direccion),
    ciudadRegion: texto(LIMITES_VENTANA2.ciudad),
  });
}

export function crearEsquemaSalud({ estricto }: OpcionesEsquema) {
  return z.object({
    grupoSanguineoId: estricto ? z.string().min(1, "Elige tu grupo sanguíneo") : z.string(),
    alergias: z.array(z.number()),
    patologiasCronicas: z.array(z.number()),
    discapacidades: z.array(z.number()),
  });
}

export function crearEsquemaTallas({ estricto }: OpcionesEsquema) {
  const requerido = (mensaje: string) => (estricto ? z.string().min(1, mensaje) : z.string());
  return z.object({
    tallaCamisaId: requerido("Elige la talla de camisa"),
    tallaPantalonId: requerido("Elige la talla de pantalón"),
    tallaZapatosId: requerido("Elige la talla de calzado"),
    tallaChaquetaId: z.string(),
  });
}

// --- F-8: estudios, cursos, experiencia pública, idiomas y RIF ---

/** Fecha `AAAA-MM-DD` real y no futura (cursos y experiencia); `null` si es válida. */
export function problemaDeFechaPasada(valor: string, hoy: Date, etiqueta: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || edadEnAnios(valor, hoy) === null) return `Escribe una fecha válida para ${etiqueta}`;
  const [a, m, d] = valor.split("-").map(Number);
  if (Date.UTC(a, m - 1, d) > hoy.getTime()) return `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} no puede ser futura`;
  return null;
}

const mensajeLista = (max: number, que: string) => `Se admiten como máximo ${max} ${que}`;

export function crearEsquemaEstudios({ estricto }: OpcionesEsquema) {
  const estudio = z.object({
    nivelAcademicoId: z.string(),
    carreraId: z.string(),
    mencionId: z.string(),
    institucionId: z.string(),
  }).superRefine((e, ctx) => {
    if (estricto && !e.nivelAcademicoId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nivelAcademicoId"], message: "Elige el nivel académico" });
    }
  });
  return z
    .object({ estudios: z.array(estudio).max(MAX_ESTUDIOS, mensajeLista(MAX_ESTUDIOS, "estudios")) })
    .superRefine((v, ctx) => {
      if (estricto && v.estudios.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["estudios"], message: "Agrega al menos un estudio: el nivel académico más alto que alcanzaste" });
      }
    });
}

export function crearEsquemaCursos({ estricto, hoy = new Date() }: OpcionesEsquema) {
  const curso = z
    .object({
      capacitacionId: z.string(),
      institucionId: z.string(),
      fechaInicio: z.string(),
      fechaFin: z.string(),
      horas: z.string().trim(),
    })
    .superRefine((c, ctx) => {
      const falta = (path: keyof typeof c, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      if (c.fechaInicio) {
        const p = problemaDeFechaPasada(c.fechaInicio, hoy, "la fecha de inicio");
        if (p) falta("fechaInicio", p);
      }
      if (c.fechaFin) {
        const p = problemaDeFechaPasada(c.fechaFin, hoy, "la fecha de fin");
        if (p) falta("fechaFin", p);
        else if (c.fechaInicio && c.fechaFin < c.fechaInicio) falta("fechaFin", "La fecha de fin no puede ser anterior a la de inicio");
      }
      if (c.horas) {
        const n = Number(c.horas);
        if (!/^\d+$/.test(c.horas) || n < 1 || n > LIMITES_VENTANA2.horasMax) falta("horas", `Escribe un número entre 1 y ${LIMITES_VENTANA2.horasMax}`);
      }
      if (!estricto) return;
      if (!c.capacitacionId) falta("capacitacionId", "Elige el curso");
      if (!c.institucionId) falta("institucionId", "Elige la institución");
    });
  return z
    .object({ sinCursos: z.boolean(), cursos: z.array(curso).max(MAX_CURSOS, mensajeLista(MAX_CURSOS, "cursos")) })
    .superRefine((v, ctx) => {
      if (v.sinCursos && v.cursos.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sinCursos"], message: "Quita los cursos o desmarca «No tengo cursos»" });
      }
    });
}

export function crearEsquemaExperiencia({ estricto, hoy = new Date() }: OpcionesEsquema) {
  const antecedente = z
    .object({ organismoId: z.string(), fechaIngreso: z.string(), fechaEgreso: z.string() })
    .superRefine((a, ctx) => {
      const falta = (path: keyof typeof a, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      if (a.fechaIngreso) {
        const p = problemaDeFechaPasada(a.fechaIngreso, hoy, "la fecha de ingreso");
        if (p) falta("fechaIngreso", p);
      }
      if (a.fechaEgreso) {
        const p = problemaDeFechaPasada(a.fechaEgreso, hoy, "la fecha de egreso");
        if (p) falta("fechaEgreso", p);
        else if (a.fechaIngreso && a.fechaEgreso < a.fechaIngreso) falta("fechaEgreso", "La fecha de egreso no puede ser anterior a la de ingreso");
      }
      if (!estricto) return;
      if (!a.organismoId) falta("organismoId", "Elige el organismo");
      if (!a.fechaIngreso) falta("fechaIngreso", "Escribe la fecha de ingreso");
      if (!a.fechaEgreso) falta("fechaEgreso", "Escribe la fecha de egreso");
    });
  return z
    .object({
      sinAntecedentes: z.boolean(),
      trabajoAntesEnConatel: z.enum(["", "si", "no"]),
      antecedentes: z.array(antecedente).max(MAX_ANTECEDENTES, mensajeLista(MAX_ANTECEDENTES, "experiencias")),
    })
    .superRefine((v, ctx) => {
      if (v.sinAntecedentes && v.antecedentes.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sinAntecedentes"], message: "Quita las experiencias o desmarca «No he trabajado en la Administración Pública»" });
      }
    });
}

export function crearEsquemaIdiomas({ estricto }: OpcionesEsquema) {
  const niveles = NIVELES_IDIOMA.map(([v]) => v);
  const idioma = z
    .object({
      idiomaId: z.string(),
      otroIdioma: texto(LIMITES_VENTANA2.otroIdioma),
      nivel: z.string(),
    })
    .superRefine((i, ctx) => {
      const falta = (path: keyof typeof i, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      if (i.otroIdioma && !SOLO_LETRAS.test(i.otroIdioma)) falta("otroIdioma", MSG_LETRAS);
      if (i.nivel && !niveles.includes(i.nivel)) falta("nivel", "Elige el nivel");
      if (!estricto) return;
      if (!i.idiomaId) falta("idiomaId", "Elige el idioma");
      else if (i.idiomaId === OTRO_IDIOMA && !i.otroIdioma) falta("otroIdioma", "Escribe el nombre del idioma");
      if (!i.nivel) falta("nivel", "Indica qué tan bien lo dominas");
    });
  return z
    .object({
      sinIdiomas: z.boolean(),
      idiomas: z.array(idioma).max(MAX_IDIOMAS, mensajeLista(MAX_IDIOMAS, "idiomas")),
      rif: z.string().trim().refine((v) => v === "" || normalizarRif(v) !== null, "Escribe un RIF válido, por ejemplo V-12345678-9"),
    })
    .superRefine((v, ctx) => {
      if (v.sinIdiomas && v.idiomas.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sinIdiomas"], message: "Quita los idiomas o desmarca «No domino otros idiomas»" });
      }
      const vistos = new Set<string>();
      v.idiomas.forEach((i, n) => {
        const clave = i.idiomaId === OTRO_IDIOMA ? `otro:${i.otroIdioma.trim().toLowerCase()}` : i.idiomaId;
        if (!clave || clave === "otro:") return;
        if (vistos.has(clave)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["idiomas", n, i.idiomaId === OTRO_IDIOMA ? "otroIdioma" : "idiomaId"],
            message: "Este idioma ya está en tu lista",
          });
        }
        vistos.add(clave);
      });
    });
}
