import type { MiExpedienteDTO } from "@/modules/autogestion/application/dtos/mi-expediente-dto";
import type { ItemBorrador } from "@/modules/autogestion/domain/entities/solicitud-actualizacion";
import type { CambioEntity } from "../../domain/entities/fe-de-vida";
import type { DatosContactoValores } from "../schema/schema-fe-de-vida";

type Valor = ItemBorrador["valor"];

/** Respuestas guardadas del acta (cambios propuestos) → items editables del borrador. */
export function cambiosAItems(cambios: readonly CambioEntity[]): ItemBorrador[] {
  return cambios.map((c) => ({
    seccion: c.seccion,
    entidad: c.entidad,
    accion: c.accion === "CREAR" ? "CREAR" : "MODIFICAR",
    campo: c.campo,
    valor: c.valorPropuesto as Valor,
    entidadId: c.entidadId,
  }));
}

/** Campos que gestiona el formulario de contacto (el resto de items los editan otros pasos). */
const CAMPOS_FORMULARIO = [
  { entidad: "employee", campo: "telefono_movil", seccion: "contacto" },
  { entidad: "employee", campo: "telefono_habitacion", seccion: "contacto" },
  { entidad: "datos_complementarios", campo: "correo_alternativo", seccion: "contacto" },
  { entidad: "datos_complementarios", campo: "tiene_hijos", seccion: "familiar" },
] as const;

const esDelFormulario = (i: ItemBorrador) =>
  CAMPOS_FORMULARIO.some((c) => c.entidad === i.entidad && c.campo === i.campo && i.accion === "MODIFICAR");

const texto = (v: unknown) => (typeof v === "string" ? v : "");

function propuesto(items: ItemBorrador[], entidad: string, campo: string): Valor | undefined {
  return items.find((i) => i.entidad === entidad && i.campo === campo && i.accion === "MODIFICAR")?.valor;
}

/** Valores iniciales del formulario: lo ya propuesto en el borrador o, si no, lo vigente en la ficha. */
export function valoresIniciales(
  ficha: MiExpedienteDTO,
  items: ItemBorrador[],
): Omit<DatosContactoValores, "tieneHijos"> & { tieneHijos: "si" | "no" | "" } {
  const tel = (campo: "telefono_movil" | "telefono_habitacion") =>
    texto(propuesto(items, "employee", campo) ?? ficha.empleado[campo]);
  const correo = texto(
    propuesto(items, "datos_complementarios", "correo_alternativo") ??
      ficha.datos_complementarios?.correo_alternativo,
  );
  const hijos = propuesto(items, "datos_complementarios", "tiene_hijos") ?? ficha.datos_complementarios?.tiene_hijos;
  return {
    telefonoMovil: tel("telefono_movil"),
    telefonoHabitacion: tel("telefono_habitacion"),
    correoAlternativo: correo,
    tieneHijos: hijos === true ? "si" : hijos === false ? "no" : "",
  };
}

/**
 * Reemplaza en el borrador los items del formulario de contacto. Solo se propone lo que cambia
 * respecto de la ficha (los campos vacíos no se proponen: borrar un dato no es una corrección).
 * Con «No tiene hijos» se descartan los items del paso de hijos.
 */
export function fusionarContacto(
  items: ItemBorrador[],
  v: DatosContactoValores,
  ficha: MiExpedienteDTO,
): ItemBorrador[] {
  const resto = items.filter((i) => !esDelFormulario(i));
  const nuevos: ItemBorrador[] = [];
  const empujar = (
    seccion: string,
    entidad: string,
    campo: string,
    valor: Valor,
    vigente: unknown,
  ) => {
    if (valor === vigente) return;
    nuevos.push({ seccion, entidad, accion: "MODIFICAR", campo, valor, entidadId: null });
  };
  const movil = v.telefonoMovil.trim();
  const habitacion = v.telefonoHabitacion.trim();
  const correo = v.correoAlternativo.trim();
  if (movil) empujar("contacto", "employee", "telefono_movil", movil, ficha.empleado.telefono_movil ?? null);
  if (habitacion)
    empujar("contacto", "employee", "telefono_habitacion", habitacion, ficha.empleado.telefono_habitacion ?? null);
  if (correo)
    empujar(
      "contacto",
      "datos_complementarios",
      "correo_alternativo",
      correo,
      ficha.datos_complementarios?.correo_alternativo ?? null,
    );
  const tiene = v.tieneHijos === "si";
  empujar("familiar", "datos_complementarios", "tiene_hijos", tiene, ficha.datos_complementarios?.tiene_hijos ?? null);
  const base = tiene ? resto : resto.filter((i) => i.entidad !== "familiar");
  return [...base, ...nuevos];
}

/** Items hacia el cuerpo del borrador (misma forma que `CambioEntrada`). */
export const aEntrada = (items: ItemBorrador[]) =>
  items.map((i) => ({
    seccion: i.seccion,
    entidad: i.entidad,
    accion: i.accion,
    campo: i.campo,
    valor: i.valor,
    entidadId: i.entidadId ?? null,
  }));
