import type {
  CampoPropioDTO,
  DocumentoExpedienteDTO,
  EstadoDocumento,
  FirmaDocumentoDTO,
  TipoCampoPropio,
} from "../../domain/lib/documentos-expediente";

type Crudo = Record<string, unknown>;

const texto = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const objeto = (v: unknown): Crudo => (v && typeof v === "object" && !Array.isArray(v) ? (v as Crudo) : {});

const TIPOS: readonly TipoCampoPropio[] = ["texto", "texto_largo", "fecha", "si_no", "opcion"];
const ESTADOS: readonly EstadoDocumento[] = ["pendiente_datos", "listo_para_revisar", "firmado", "generado"];

function mapearCampo(crudo: unknown): CampoPropioDTO {
  const c = objeto(crudo);
  const tipo = TIPOS.find((t) => t === c.tipo) ?? "texto";
  return {
    clave: texto(c.clave),
    etiqueta: texto(c.etiqueta),
    tipo,
    obligatorio: c.obligatorio === true,
    ayuda: texto(c.ayuda),
    opciones: Array.isArray(c.opciones) ? c.opciones.map(texto) : [],
  };
}

function mapearFirma(crudo: unknown): FirmaDocumentoDTO | null {
  const f = objeto(crudo);
  if (!f.sha256) return null;
  return {
    firmadoEn: texto(f.firmado_en),
    ipEnmascarada: texto(f.ip_enmascarada),
    sha256: texto(f.sha256),
    textoConformidad: texto(f.texto_conformidad),
    documentoId: texto(f.documento_id),
    version: Number(f.version ?? 0),
  };
}

/** Un documento del expediente tal como lo entrega la API (postulante y Captación comparten la forma). */
export function mapearDocumentoExpediente(crudo: unknown): DocumentoExpedienteDTO {
  const d = objeto(crudo);
  const valores = objeto(d.valores);
  return {
    plantillaId: texto(d.plantilla_id),
    codigo: texto(d.codigo),
    nombre: texto(d.nombre),
    descripcion: texto(d.descripcion),
    proceso: texto(d.proceso),
    procesoEtiqueta: texto(d.proceso_etiqueta),
    version: Number(d.version ?? 0),
    firmante: texto(d.firmante),
    requiereFirma: d.requiere_firma === true,
    camposPropios: Array.isArray(d.campos_propios) ? d.campos_propios.map(mapearCampo) : [],
    valores: Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, texto(v)])),
    faltan: Array.isArray(d.faltan) ? d.faltan.map(texto) : [],
    estado: ESTADOS.find((e) => e === d.estado) ?? "pendiente_datos",
    firmaInvalidada: d.firma_invalidada === true,
    documentoId: typeof d.documento_id === "string" ? d.documento_id : null,
    firma: mapearFirma(d.firma),
    textoConformidad: texto(d.texto_conformidad),
    trabajadorCedula: texto(d.trabajador_cedula),
    archivoUrl: typeof d.archivo_url === "string" ? d.archivo_url : null,
  };
}

export function mapearDocumentosExpediente(crudo: unknown): DocumentoExpedienteDTO[] {
  return Array.isArray(crudo) ? crudo.map(mapearDocumentoExpediente) : [];
}
