/**
 * Adaptador entre la definición persistida de una plantilla (la que usa el
 * motor PDF: `anverso`/`reverso` + `props`) y el modelo plano del editor Konva
 * (`ElementoKonva` con `t`, `fill`, `size`...).
 *
 * Sin este adaptador el diseñador ignoraba los elementos guardados y mostraba
 * la plantilla por defecto al pulsar «Editar».
 */
import type {
  ElementoKonva,
  ReglasColorConfig,
  TipoElementoKonva,
} from "../../domain/entities/disenador";
import { REGLAS_COLOR_DEFECTO } from "../../domain/entities/disenador";
import { normalizarPuntos } from "../../domain/entities/forma-puntos";
import { normalizarQrEstilo } from "../../domain/entities/qr-estilo";

type Json = Record<string, unknown>;

const TIPO_A_EDITOR: Record<string, TipoElementoKonva> = {
  field: "field",
  text: "text",
  rect: "rect",
  circle: "circle",
  tri: "tri",
  diag: "diag",
  diagr: "diag",
  path: "path",
  photo: "photo",
  qr: "qr",
  image: "image",
  line: "rect",
  signline: "rect",
};

const TIPO_A_PLANTILLA: Record<TipoElementoKonva, string> = {
  field: "field",
  text: "text",
  rect: "rect",
  circle: "circle",
  tri: "tri",
  diag: "diagr",
  path: "path",
  photo: "photo",
  qr: "qr",
  image: "image",
};

const CAMPOS_CONOCIDOS = new Set([
  "id",
  "tipo",
  "nombre",
  "x",
  "y",
  "w",
  "h",
  "r",
  "props",
  "campo",
  "texto",
  "fontSize",
  "align",
  "bold",
  "color",
  "path",
]);

const ASSETS_PUBLICOS: Record<string, string> = {
  "logo01.png": "/logo1.png",
  "logo02.png": "/logo2.png",
  "cintillo2.png": "/cintillo2.png",
};

/** Color que usa el PDF para textos sin color propio (carnet_pdf.py). */
const COLOR_TEXTO_DEFECTO = "#1f3a5f";

function numero(valor: unknown, defecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : defecto;
}

function objeto(valor: unknown): Json {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Json)
    : {};
}

function redondear(valor: number): number {
  return Number(valor.toFixed(2));
}

function elementoDesdePlantilla(elemento: Json, cara: "anverso" | "reverso"): ElementoKonva {
  const props = objeto(elemento.props);
  const tipoOriginal = String(elemento.tipo ?? "rect");
  const t = TIPO_A_EDITOR[tipoOriginal] ?? "rect";
  const esLinea = tipoOriginal === "line" || tipoOriginal === "signline";
  const color = typeof elemento.color === "string" ? elemento.color : undefined;
  const fill = esLinea
    ? String(props.fill ?? color ?? "#111827")
    : t === "field" || t === "text"
      ? String(color ?? props.fill ?? COLOR_TEXTO_DEFECTO)
      : String(props.fill ?? color ?? "#e2e8f0");
  const asset = typeof props.asset === "string" ? props.asset : undefined;

  return {
    id: String(elemento.id ?? `el-${cara}-${Math.random().toString(36).slice(2)}`),
    t,
    name: String(elemento.nombre ?? elemento.id ?? "Elemento"),
    cara,
    x: numero(elemento.x),
    y: numero(elemento.y),
    w: numero(elemento.w),
    h: esLinea ? Math.max(0.4, numero(elemento.h)) : numero(elemento.h),
    r: numero(elemento.r ?? elemento.rotation),
    fill,
    stroke: String(props.stroke ?? ""),
    sw: numero(props.sw ?? props.strokeWidth),
    rad: numero(props.rad ?? props.radius),
    shadow: numero(props.shadow),
    op: numero(props.op, 100),
    text: elemento.texto !== undefined ? String(elemento.texto) : undefined,
    field: elemento.campo !== undefined ? String(elemento.campo) : undefined,
    font: typeof elemento.font === "string" ? elemento.font : "Source Sans 3, Arial",
    size: numero(elemento.fontSize ?? props.fontSize, 8),
    bold: Boolean(elemento.bold),
    ital: Boolean(elemento.ital),
    align:
      elemento.align === "center" || elemento.align === "right" || elemento.align === "left"
        ? elemento.align
        : "left",
    src: asset ? ASSETS_PUBLICOS[asset] : undefined,
    biblioteca_id: asset,
    etiqueta: typeof props.label === "string" ? props.label : undefined,
    qr_estilo:
      t === "qr" && props.qr_estilo && typeof props.qr_estilo === "object"
        ? normalizarQrEstilo(props.qr_estilo)
        : undefined,
    diagr: tipoOriginal === "diagr",
    path:
      typeof elemento.path === "string"
        ? elemento.path
        : typeof props.d === "string"
          ? props.d
          : undefined,
    puntos: t === "path" ? (normalizarPuntos(props.puntos) ?? undefined) : undefined,
    radios: t === "rect" ? radiosDesdeProps(props.radios) : undefined,
    bloqueado: false,
    oculto: false,
  };
}

function radiosDesdeProps(valor: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(valor) || valor.length !== 4) return undefined;
  const radios = valor.map((r) => Number(r));
  if (radios.some((r) => !Number.isFinite(r) || r < 0)) return undefined;
  return radios as [number, number, number, number];
}

export interface DefinicionAdaptada {
  elementos: ElementoKonva[];
  reglasColor?: ReglasColorConfig;
}

/** Lee la definición guardada (formato motor o formato legado del editor). */
export function adaptarDefinicionAEditor(definicion: unknown): DefinicionAdaptada {
  const def = objeto(definicion);
  const anverso = Array.isArray(def.anverso) ? def.anverso : [];
  const reverso = Array.isArray(def.reverso) ? def.reverso : [];
  const planos = Array.isArray(def.elementos) ? def.elementos : [];

  const elementos: ElementoKonva[] = [
    ...anverso.map((e) => elementoDesdePlantilla(objeto(e), "anverso")),
    ...reverso.map((e) => elementoDesdePlantilla(objeto(e), "reverso")),
    ...planos.map((e) => elementoDesdePlantilla(objeto(e), "anverso")),
  ];

  const reglas = objeto(def.reglas);
  const reglasEditor = objeto(def.reglas_color);
  let reglasColor: ReglasColorConfig | undefined;

  if (reglasEditor.criterio) {
    reglasColor = reglasEditor as unknown as ReglasColorConfig;
  } else if (reglas.criterio || reglas.valores) {
    const respaldo = objeto(reglas.respaldo);
    reglasColor = {
      criterio: (String(reglas.criterio ?? "nomina") as ReglasColorConfig["criterio"]) || "nomina",
      respaldo: {
        primario: String(respaldo.primario ?? reglas.primario ?? REGLAS_COLOR_DEFECTO.respaldo.primario),
        acento: String(respaldo.acento ?? reglas.acento ?? REGLAS_COLOR_DEFECTO.respaldo.acento),
        texto: String(respaldo.texto ?? reglas.texto ?? REGLAS_COLOR_DEFECTO.respaldo.texto),
      },
      valores: (objeto(reglas.valores) as unknown as ReglasColorConfig["valores"]) ?? {},
    };
  }

  return { elementos, reglasColor };
}

function elementoAPlantilla(elemento: ElementoKonva, original?: Json): Json {
  const base: Json = original ? { ...original } : {};
  // Un triángulo o franja convertidos a puntos pasan a ser «path» al guardar.
  const tipo =
    elemento.t === "path" ? "path" : String(original?.tipo ?? TIPO_A_PLANTILLA[elemento.t] ?? "rect");
  const props = { ...objeto(base.props) };

  const resultado: Json = {
    ...base,
    id: elemento.id,
    tipo,
    nombre: elemento.name,
    x: redondear(elemento.x),
    y: redondear(elemento.y),
    w: redondear(elemento.w),
    h: redondear(elemento.h),
  };

  if (elemento.r) resultado.r = redondear(elemento.r);

  if (tipo === "field") {
    resultado.campo = elemento.field;
    resultado.fontSize = elemento.size;
    resultado.align = elemento.align;
    resultado.bold = elemento.bold;
    if (elemento.fill && !elemento.fill.startsWith("rule:")) {
      resultado.color = elemento.fill;
    }
  } else if (tipo === "text") {
    resultado.texto = elemento.text;
    resultado.fontSize = elemento.size;
    resultado.align = elemento.align;
    resultado.bold = elemento.bold;
    if (elemento.fill && !elemento.fill.startsWith("rule:")) {
      resultado.color = elemento.fill;
    }
  } else {
    if (elemento.fill) props.fill = elemento.fill;
    if (elemento.rad) props.rad = elemento.rad;
    if (elemento.stroke) props.stroke = elemento.stroke;
    if (elemento.sw) props.sw = elemento.sw;
    if (tipo === "path" && elemento.path) props.d = elemento.path;
    if (elemento.t === "path") {
      if (elemento.puntos) props.puntos = elemento.puntos;
      else delete props.puntos;
    }
    if (elemento.t === "rect") {
      if (elemento.radios) props.radios = elemento.radios;
      else delete props.radios;
    }
    if (tipo === "qr" && elemento.qr_estilo) props.qr_estilo = elemento.qr_estilo;
    resultado.props = props;
  }

  // Conserva claves que el editor no entiende (asset, label, etc.).
  for (const [clave, valor] of Object.entries(base)) {
    if (!CAMPOS_CONOCIDOS.has(clave) && !(clave in resultado)) {
      resultado[clave] = valor;
    }
  }
  return resultado;
}

/** Reconstruye la definición del motor preservando `bg` y las reglas. */
export function adaptarEditorADefinicion(
  definicionOriginal: unknown,
  elementos: ElementoKonva[],
  reglasColor: ReglasColorConfig,
  anchoMm: number,
  altoMm: number,
  orientacion: "vertical" | "horizontal",
): Json {
  const original = objeto(definicionOriginal);
  const anversoOriginal = Array.isArray(original.anverso) ? original.anverso : [];
  const reversoOriginal = Array.isArray(original.reverso) ? original.reverso : [];

  const originalPorId = new Map<string, Json>();
  for (const e of [...anversoOriginal, ...reversoOriginal]) {
    const obj = objeto(e);
    if (obj.id) originalPorId.set(String(obj.id), obj);
  }

  const anverso = elementos
    .filter((e) => e.cara === "anverso")
    .map((e) => elementoAPlantilla(e, originalPorId.get(e.id)));
  const reverso = elementos
    .filter((e) => e.cara === "reverso")
    .map((e) => elementoAPlantilla(e, originalPorId.get(e.id)));

  const reglasOriginal = objeto(original.reglas);

  return {
    ...original,
    bg: original.bg ?? { anverso: "#ffffff", reverso: "#ffffff" },
    reglas: {
      ...reglasOriginal,
      criterio: reglasColor.criterio,
      respaldo: reglasColor.respaldo,
      valores: reglasColor.valores,
      texto: reglasOriginal.texto ?? reglasColor.respaldo.texto,
      acento: reglasOriginal.acento ?? reglasColor.respaldo.acento,
      primario: reglasOriginal.primario ?? reglasColor.respaldo.primario,
    },
    anverso,
    reverso,
    dimensiones: { ancho_mm: anchoMm, alto_mm: altoMm },
    orientacion,
  };
}
