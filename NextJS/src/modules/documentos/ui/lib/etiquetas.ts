import type {
  AlineacionTexto,
  FirmanteDocumento,
  ModoPlantilla,
  MomentoDocumento,
  OperadorCondicion,
  PlantillaResumen,
  TipoCampoPropio,
} from "../../domain/entities/plantilla";

export const ETIQUETA_MODO: Record<ModoPlantilla, string> = {
  formulario: "Formulario propio",
  pdf_overlay: "Formato de terceros",
};

export const ETIQUETA_MOMENTO: Record<MomentoDocumento, string> = {
  ventana2: "Datos complementarios (datos y documentos)",
  contratacion: "Contratación",
  otro: "Otro momento",
};

export const ETIQUETA_FIRMANTE: Record<FirmanteDocumento, string> = {
  postulante: "El postulante",
  conatel: "CONATEL",
  ambos: "Postulante y CONATEL",
};

export const ETIQUETA_ALINEACION: Record<AlineacionTexto, string> = {
  izquierda: "Izquierda",
  centro: "Centro",
  derecha: "Derecha",
  justificado: "Justificado",
};

export const ETIQUETA_OPERADOR: Record<OperadorCondicion, string> = {
  igual: "es igual a",
  distinto: "es distinto de",
  no_vacio: "tiene valor",
  vacio: "está vacío",
};

export const ETIQUETA_TIPO_CAMPO_PROPIO: Record<TipoCampoPropio, string> = {
  texto: "Texto corto",
  texto_largo: "Texto largo",
  fecha: "Fecha",
  si_no: "Sí / No",
  opcion: "Lista de opciones",
};

/** Una plantilla está publicada solo si tiene al menos una versión (el backend envía 0 cuando nunca se publicó). */
export function estaPublicada(p: Pick<PlantillaResumen, "ultima_version">): boolean {
  return (p.ultima_version ?? 0) > 0;
}

/** Texto del estado visible: «Borrador (sin publicar)», «Publicada v2», «Borrador con cambios (vigente v2)». */
export function textoEstado(p: Pick<PlantillaResumen, "estado" | "ultima_version" | "cambios_sin_publicar">): string {
  if (!estaPublicada(p)) return "Borrador (sin publicar)";
  if (p.cambios_sin_publicar) return `Borrador con cambios (vigente v${p.ultima_version})`;
  return `Publicada v${p.ultima_version}`;
}

export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" });
}
