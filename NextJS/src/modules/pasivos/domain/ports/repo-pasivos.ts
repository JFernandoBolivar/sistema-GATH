/**
 * Puerto del Repositorio de Pasivos (Reglas R1, R4).
 *
 * Permite listar y obtener el expediente de trabajadores jubilados/pensionados,
 * y procesar la transición activo → pasivo. Las lecturas por cédula se delegan
 * a las Server Actions del módulo.
 */
import type { CatalogoPasivo, Pasivo } from "../entities/pasivo";
import type { ProcesarEgresoInput } from "../ports/procesar-egreso";
import type { CatalogosExpedientePasivo } from "../ports/catalogos-expediente";

export interface RepoPasivos {
  listarPasivos(busqueda?: string): Promise<Pasivo[]>;
  obtenerPorCedula(cedula: string): Promise<Pasivo>;
  procesarEgreso(cedula: string, input: ProcesarEgresoInput): Promise<Pasivo>;
  listarMotivosEgreso(): Promise<CatalogoPasivo[]>;
  listarTiposNomina(soloPasivos?: boolean): Promise<CatalogoPasivo[]>;
  /** Catálogos para resolver a nombre el expediente del detalle (vista de detalle). */
  listarCatalogosExpediente(): Promise<CatalogosExpedientePasivo>;
  /** HU: PDF del expediente generado en backend (ReportLab), reemplaza el render client-side con @react-pdf/renderer. */
  descargarPdf(cedula: string): Promise<Blob>;
}
