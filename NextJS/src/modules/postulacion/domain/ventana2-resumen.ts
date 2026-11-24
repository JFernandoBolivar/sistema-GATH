import {
  edadEnAnios,
  familiaresDesdeDatos,
  saludDesdeDatos,
  tallasDesdeDatos,
  viviendaDesdeDatos,
  type CatalogosVentana2,
  type OpcionCatalogo,
  type TallaCatalogo,
} from "./ventana2";

/** Resumen legible de lo que el postulante va a enviar (nombres de catálogo en vez de ids). */
export interface ResumenVentana2 {
  familiares: { titulo: string; detalle: string }[];
  sinFamiliares: boolean;
  vivienda: { etiqueta: string; valor: string }[];
  salud: { etiqueta: string; valor: string }[];
  tallas: { etiqueta: string; valor: string }[];
}

const nombreDe = (lista: readonly OpcionCatalogo[], id: string | number): string =>
  lista.find((o) => String(o.id) === String(id))?.nombre ?? "";

const lista = (opciones: readonly OpcionCatalogo[], ids: readonly number[]): string =>
  ids.length === 0 ? "Ninguna" : ids.map((id) => nombreDe(opciones, id) || `N.º ${id}`).join(", ");

const talla = (opciones: readonly TallaCatalogo[], id: string): string => {
  const t = opciones.find((o) => String(o.id) === id);
  return t ? `${t.valor}${t.region ? ` (${t.region})` : ""}` : "";
};

export function resumirVentana2(datos: Record<string, unknown>, c: CatalogosVentana2, hoy: Date): ResumenVentana2 {
  const fam = familiaresDesdeDatos(datos);
  const v = viviendaDesdeDatos(datos);
  const s = saludDesdeDatos(datos);
  const t = tallasDesdeDatos(datos);
  return {
    sinFamiliares: fam.sinFamiliares,
    familiares: fam.familiares.map((f) => {
      const edad = edadEnAnios(f.fechaNacimiento, hoy);
      const partes = [
        nombreDe(c.parentescos, f.parentescoId),
        edad === null ? "" : `${edad} ${edad === 1 ? "año" : "años"}`,
        f.cedula ? `C.I. ${f.cedula}` : f.ordenHijo ? `sin cédula, hijo N.º ${f.ordenHijo}` : "",
        f.dependeEconomicamente === "si" ? "depende de ti" : "",
      ].filter(Boolean);
      return {
        titulo: [f.primerNombre, f.segundoNombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(" ") || "Familiar sin nombre",
        detalle: partes.join(" · "),
      };
    }),
    vivienda: [
      { etiqueta: "Tipo de vivienda", valor: nombreDe(c.condicionesVivienda, v.condicionViviendaId) },
      { etiqueta: "Estado", valor: nombreDe(c.estados, v.estadoId) },
      { etiqueta: "Municipio", valor: nombreDe(c.municipios, v.municipioId) },
      { etiqueta: "Parroquia", valor: nombreDe(c.parroquias, v.parroquiaId) },
      { etiqueta: "Dirección", valor: v.direccionExacta },
      ...(v.ciudadRegion ? [{ etiqueta: "Ciudad o región", valor: v.ciudadRegion }] : []),
    ],
    salud: [
      { etiqueta: "Grupo sanguíneo", valor: nombreDe(c.gruposSanguineos, s.grupoSanguineoId) },
      { etiqueta: "Alergias", valor: lista(c.alergias, s.alergias) },
      { etiqueta: "Enfermedades crónicas", valor: lista(c.patologiasCronicas, s.patologiasCronicas) },
      { etiqueta: "Discapacidades", valor: lista(c.discapacidades, s.discapacidades) },
    ],
    tallas: [
      { etiqueta: "Camisa", valor: talla(c.tallas.camisa, t.tallaCamisaId) },
      { etiqueta: "Pantalón", valor: talla(c.tallas.pantalon, t.tallaPantalonId) },
      { etiqueta: "Calzado", valor: talla(c.tallas.calzado, t.tallaZapatosId) },
      { etiqueta: "Chaqueta", valor: talla(c.tallas.chaqueta, t.tallaChaquetaId) },
    ].filter((x) => x.valor || x.etiqueta !== "Chaqueta"),
  };
}
