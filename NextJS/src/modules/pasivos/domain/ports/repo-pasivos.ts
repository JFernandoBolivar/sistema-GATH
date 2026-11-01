/**
 * Puerto del Repositorio de Pasivos (Reglas R1, R4).
 *
 * Permite listar y obtener el expediente de trabajadores jubilados/pensionados,
 * y procesar la transición activo → pasivo. Las lecturas por cédula se delegan
 * a las Server Actions del módulo.
 */
import type { ActualizarPasivoInput, CatalogoPasivo, FiltrosPasivos, PaginaPasivos, Pasivo } from "../entities/pasivo";
import type { ProcesarEgresoInput } from "../ports/procesar-egreso";
import type { CatalogosExpedientePasivo } from "../ports/catalogos-expediente";

export interface RepoPasivos {
  listarPasivos(busqueda?: string): Promise<Pasivo[]>;
  listarPasivosPaginados(filtros: FiltrosPasivos): Promise<PaginaPasivos>;
  actualizarPasivo(cedula: string, input: ActualizarPasivoInput): Promise<Pasivo>;
  registrarPasivo(input: import("../entities/pasivo").RegistrarPasivoInput): Promise<Pasivo>;
  listarSexos(): Promise<CatalogoPasivo[]>;
  listarEstadosCiviles(): Promise<CatalogoPasivo[]>;
  listarNacionalidades(): Promise<CatalogoPasivo[]>;
  listarEstados(): Promise<CatalogoPasivo[]>;
  listarMunicipios(): Promise<CatalogoPasivo[]>;
  listarParroquias(): Promise<CatalogoPasivo[]>;
  obtenerPorCedula(cedula: string): Promise<Pasivo>;
  procesarEgreso(cedula: string, input: ProcesarEgresoInput): Promise<Pasivo>;
  listarMotivosEgreso(): Promise<CatalogoPasivo[]>;
  listarTiposNomina(soloPasivos?: boolean): Promise<CatalogoPasivo[]>;
  /** Catálogos para resolver a nombre el expediente del detalle (vista de detalle). */
  listarCatalogosExpediente(): Promise<CatalogosExpedientePasivo>;
  /** HU: PDF del expediente generado en backend (ReportLab), reemplaza el render client-side con @react-pdf/renderer. */
  descargarPdf(cedula: string): Promise<Blob>;
  listarMotivosEgresoPasivo(): Promise<CatalogoPasivo[]>;
  egresarPasivo(cedula: string, motivoId: number, familiarIds: number[]): Promise<Pasivo>;
  getFamiliaresTitular(cedula: string): Promise<{ id: number; cedulaFamiliar: string | null; nombreCompleto: string; heredero: boolean }[]>;
  registrarSobrevivientes(cedula: string, familiarIds: number[]): Promise<{ cedula: string; nombreCompleto: string; creado: boolean }[]>;
}
