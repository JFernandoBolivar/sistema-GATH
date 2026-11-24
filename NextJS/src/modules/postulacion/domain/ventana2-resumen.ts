import {
  cursosDesdeDatos,
  edadEnAnios,
  estudiosDesdeDatos,
  experienciaDesdeDatos,
  familiaresDesdeDatos,
  idiomasDesdeDatos,
  NIVELES_IDIOMA,
  OTRO_IDIOMA,
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
  estudios: { titulo: string; detalle: string }[];
  cursos: { titulo: string; detalle: string }[];
  sinCursos: boolean;
  antecedentes: { titulo: string; detalle: string }[];
  sinAntecedentes: boolean;
  /** «Sí», «No» o `""` (sin responder). */
  trabajoAntesEnConatel: string;
  idiomas: { titulo: string; detalle: string }[];
  sinIdiomas: boolean;
  rif: string;
}

/** `2023-02-01` -> `01/02/2023` (sin pasar por `Date`, para no correr el día por la zona horaria). */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
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
  const est = estudiosDesdeDatos(datos);
  const cur = cursosDesdeDatos(datos);
  const exp = experienciaDesdeDatos(datos);
  const idi = idiomasDesdeDatos(datos);
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
    estudios: est.estudios.map((e) => ({
      titulo: nombreDe(c.nivelesAcademicos, e.nivelAcademicoId) || "Estudio sin nivel",
      detalle: [nombreDe(c.carreras, e.carreraId), nombreDe(c.menciones, e.mencionId), nombreDe(c.instituciones, e.institucionId)]
        .filter(Boolean)
        .join(" · "),
    })),
    sinCursos: cur.sinCursos,
    cursos: cur.cursos.map((x) => ({
      titulo: nombreDe(c.capacitaciones, x.capacitacionId) || "Curso sin nombre",
      detalle: [
        nombreDe(c.instituciones, x.institucionId),
        x.fechaInicio || x.fechaFin ? [x.fechaInicio && fechaCorta(x.fechaInicio), x.fechaFin && fechaCorta(x.fechaFin)].filter(Boolean).join(" al ") : "",
        x.horas ? `${x.horas} h` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    sinAntecedentes: exp.sinAntecedentes,
    trabajoAntesEnConatel: exp.trabajoAntesEnConatel === "si" ? "Sí" : exp.trabajoAntesEnConatel === "no" ? "No" : "",
    antecedentes: exp.antecedentes.map((a) => ({
      titulo: nombreDe(c.organismos, a.organismoId) || "Organismo sin indicar",
      detalle: [a.fechaIngreso && fechaCorta(a.fechaIngreso), a.fechaEgreso && fechaCorta(a.fechaEgreso)].filter(Boolean).join(" al "),
    })),
    sinIdiomas: idi.sinIdiomas,
    idiomas: idi.idiomas.map((i) => ({
      titulo: (i.idiomaId === OTRO_IDIOMA ? i.otroIdioma : nombreDe(c.idiomas, i.idiomaId)) || "Idioma sin indicar",
      detalle: NIVELES_IDIOMA.find(([v]) => v === i.nivel)?.[1] ?? "",
    })),
    rif: idi.rif,
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
