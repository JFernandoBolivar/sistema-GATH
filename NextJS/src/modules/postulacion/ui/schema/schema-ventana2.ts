import { z } from "zod";
import {
  edadEnAnios,
  LIMITES_VENTANA2,
  MAX_FAMILIARES,
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
