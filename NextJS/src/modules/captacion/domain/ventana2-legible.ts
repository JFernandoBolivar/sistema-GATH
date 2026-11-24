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

/** Elemento de una lista de la Ventana 2 ampliada (estudio, curso, experiencia, idioma). */
export interface ItemLegible {
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
  estudios: ItemLegible[];
  cursos: ItemLegible[];
  sinCursos: boolean;
  antecedentes: ItemLegible[];
  sinAntecedentes: boolean;
  /** «Sí», «No» o `""` si no respondió. */
  trabajoAntesEnConatel: string;
  idiomas: ItemLegible[];
  sinIdiomas: boolean;
  /** `""` si no lo indicó. */
  rif: string;
}

const conValor = (filas: FilaLegible[]) => filas.map((f) => ({ ...f, valor: f.valor || "No informado" }));
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const fecha = (iso: unknown): string => {
  const t = texto(iso);
  return t ? formatearFecha(`${t}T12:00:00-04:00`) : "";
};
const NIVELES: Record<string, string> = { BIEN: "Bien", REGULAR: "Regular", POCO: "Poco" };

/** `datos_ventana2_legible` del backend (ids con nombre) a filas listas para dibujar. */
export function ventana2Legible(legible: Record<string, unknown> | null): Ventana2Legible {
  if (!legible) {
    return {
      vacia: true, sinFamiliares: false, familiares: [], vivienda: [], salud: [], tallas: [],
      estudios: [], cursos: [], sinCursos: false, antecedentes: [], sinAntecedentes: false, trabajoAntesEnConatel: "", idiomas: [], sinIdiomas: false, rif: "",
    };
  }
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
  const estudios = lista(legible.estudios).map((item) => {
    const e = objeto(item);
    return {
      titulo: nombre(e.nivel_academico) || "Estudio sin nivel",
      filas: conValor([
        { etiqueta: "Carrera", valor: nombre(e.carrera) },
        { etiqueta: "Mención", valor: nombre(e.mencion) },
        { etiqueta: "Institución", valor: nombre(e.institucion) },
      ]),
    };
  });
  const cursos = lista(legible.cursos).map((item) => {
    const c = objeto(item);
    return {
      titulo: nombre(c.capacitacion) || "Curso sin nombre",
      filas: conValor([
        { etiqueta: "Institución", valor: nombre(c.institucion) },
        { etiqueta: "Inicio", valor: fecha(c.fecha_inicio) },
        { etiqueta: "Fin", valor: fecha(c.fecha_fin) },
        { etiqueta: "Horas", valor: texto(c.horas) },
      ]),
    };
  });
  const antecedentes = lista(legible.antecedentes).map((item) => {
    const a = objeto(item);
    return {
      titulo: nombre(a.organismo) || "Organismo sin indicar",
      filas: conValor([
        { etiqueta: "Ingreso", valor: fecha(a.fecha_ingreso) },
        { etiqueta: "Egreso", valor: fecha(a.fecha_egreso) },
      ]),
    };
  });
  const idiomas = lista(legible.idiomas).map((item) => {
    const i = objeto(item);
    return { titulo: texto(i.nombre) || "Idioma sin indicar", filas: conValor([{ etiqueta: "Nivel", valor: NIVELES[texto(i.nivel)] ?? "" }]) };
  });
  const hayVivienda = Object.keys(v).length > 0;
  const haySalud = Object.keys(s).length > 0;
  return {
    vacia: false,
    sinFamiliares: legible.sin_familiares === true,
    familiares,
    estudios,
    cursos,
    sinCursos: legible.sin_cursos === true,
    antecedentes,
    sinAntecedentes: legible.sin_antecedentes === true,
    trabajoAntesEnConatel: legible.trabajo_antes_en_conatel === true ? "Sí" : legible.trabajo_antes_en_conatel === false ? "No" : "",
    idiomas,
    sinIdiomas: legible.sin_idiomas === true,
    rif: texto(legible.rif),
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
