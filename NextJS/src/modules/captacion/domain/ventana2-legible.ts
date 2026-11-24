import { formatearFecha } from "./formato";

type Crudo = Record<string, unknown>;
const objeto = (v: unknown): Crudo => (v && typeof v === "object" && !Array.isArray(v) ? (v as Crudo) : {});
const texto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const nombre = (v: unknown): string => texto(objeto(v).nombre);
const nombres = (v: unknown): string => {
  const l = Array.isArray(v) ? v.map(nombre).filter(Boolean) : [];
  return l.length ? l.join(", ") : "Ninguna";
};
const talla = (v: unknown): string => {
  const t = objeto(v);
  return t.valor ? `${texto(t.valor)}${t.region ? ` (${texto(t.region)})` : ""}` : "";
};

export interface FilaLegible {
  etiqueta: string;
  valor: string;
}

export interface FamiliarLegible {
  titulo: string;
  filas: FilaLegible[];
}

export interface Ventana2Legible {
  vacia: boolean;
  sinFamiliares: boolean;
  familiares: FamiliarLegible[];
  vivienda: FilaLegible[];
  salud: FilaLegible[];
  tallas: FilaLegible[];
}

const conValor = (filas: FilaLegible[]) => filas.map((f) => ({ ...f, valor: f.valor || "No informado" }));

/** `datos_ventana2_legible` del backend (ids con nombre) a filas listas para dibujar. */
export function ventana2Legible(legible: Record<string, unknown> | null): Ventana2Legible {
  if (!legible) return { vacia: true, sinFamiliares: false, familiares: [], vivienda: [], salud: [], tallas: [] };
  const v = objeto(legible.vivienda);
  const s = objeto(legible.salud);
  const t = objeto(legible.tallas);
  const familiares = (Array.isArray(legible.familiares) ? legible.familiares : []).map((item) => {
    const f = objeto(item);
    const nac = texto(f.fecha_nacimiento);
    return {
      titulo: [f.primer_nombre, f.segundo_nombre, f.primer_apellido, f.segundo_apellido].map(texto).filter(Boolean).join(" ") || "Familiar sin nombre",
      filas: conValor([
        { etiqueta: "Parentesco", valor: nombre(f.parentesco) },
        { etiqueta: "Sexo", valor: nombre(f.sexo) },
        { etiqueta: "Fecha de nacimiento", valor: nac ? formatearFecha(`${nac}T12:00:00-04:00`) : "" },
        { etiqueta: "Cédula", valor: texto(f.cedula) || (f.orden_hijo ? `Sin cédula (hijo N.º ${texto(f.orden_hijo)})` : "") },
        { etiqueta: "Depende económicamente", valor: f.depende_economicamente === true ? "Sí" : f.depende_economicamente === false ? "No" : "" },
      ]),
    };
  });
  const hayVivienda = Object.keys(v).length > 0;
  const haySalud = Object.keys(s).length > 0;
  return {
    vacia: false,
    sinFamiliares: legible.sin_familiares === true,
    familiares,
    vivienda: hayVivienda
      ? conValor([
          { etiqueta: "Tipo y tenencia", valor: nombre(v.condicion_vivienda) },
          { etiqueta: "Estado", valor: nombre(v.estado) },
          { etiqueta: "Municipio", valor: nombre(v.municipio) },
          { etiqueta: "Parroquia", valor: nombre(v.parroquia) },
          { etiqueta: "Dirección exacta", valor: texto(v.direccion_exacta) },
          ...(v.ciudad_region ? [{ etiqueta: "Ciudad o región", valor: texto(v.ciudad_region) }] : []),
        ])
      : [],
    salud: haySalud
      ? conValor([
          { etiqueta: "Grupo sanguíneo", valor: nombre(s.grupo_sanguineo) },
          { etiqueta: "Alergias", valor: nombres(s.alergias) },
          { etiqueta: "Enfermedades crónicas", valor: nombres(s.patologias_cronicas) },
          { etiqueta: "Discapacidades", valor: nombres(s.discapacidades) },
        ])
      : [],
    tallas: Object.keys(t).length
      ? conValor([
          { etiqueta: "Camisa", valor: talla(t.camisa) },
          { etiqueta: "Pantalón", valor: talla(t.pantalon) },
          { etiqueta: "Calzado", valor: talla(t.calzado) },
          ...(t.chaqueta ? [{ etiqueta: "Chaqueta", valor: talla(t.chaqueta) }] : []),
        ])
      : [],
  };
}
