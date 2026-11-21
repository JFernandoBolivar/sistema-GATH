import { formatearFecha } from "./formato";

export interface CampoLegible {
  etiqueta: string;
  valor: string;
}

const SEXO: Record<string, string> = { M: "Masculino", F: "Femenino" };
const NACIONALIDAD: Record<string, string> = { V: "Venezolano(a)", E: "Extranjero(a)" };

const cadena = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Datos de la Ventana 1 en filas legibles (solo las que tienen valor; las vacías se muestran como «No informado»). */
export function camposDeVentana1(datos: Record<string, unknown>): CampoLegible[] {
  const contacto =
    datos.contacto_emergencia && typeof datos.contacto_emergencia === "object"
      ? (datos.contacto_emergencia as Record<string, unknown>)
      : {};
  const sexo = cadena(datos.sexo);
  const nacionalidad = cadena(datos.nacionalidad);
  const nacimiento = cadena(datos.fecha_nacimiento);
  const contactoPartes = [cadena(contacto.nombre), cadena(contacto.parentesco) && `(${cadena(contacto.parentesco)})`, cadena(contacto.telefono)]
    .filter(Boolean)
    .join(" ");
  const filas: CampoLegible[] = [
    { etiqueta: "Fecha de nacimiento", valor: nacimiento ? formatearFecha(`${nacimiento}T12:00:00-04:00`) : "" },
    { etiqueta: "Sexo", valor: SEXO[sexo] ?? sexo },
    { etiqueta: "Nacionalidad", valor: NACIONALIDAD[nacionalidad] ?? nacionalidad },
    { etiqueta: "Estado civil", valor: cadena(datos.estado_civil) },
    { etiqueta: "Dirección de habitación", valor: cadena(datos.direccion_habitacion) },
    { etiqueta: "Teléfono alterno", valor: cadena(datos.telefono_alterno) },
    { etiqueta: "Contacto de emergencia", valor: contactoPartes },
  ];
  return filas.map((f) => ({ ...f, valor: f.valor || "No informado" }));
}
