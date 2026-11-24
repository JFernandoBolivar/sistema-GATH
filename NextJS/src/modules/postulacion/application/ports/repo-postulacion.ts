import type { ValoresVentana1 } from "../../domain/ventana1";
import type { CatalogosVentana2 } from "../../domain/ventana2";
import type { EnvioDTO, MiExpedienteDTO, SesionInvitadoDTO, Ventana2DTO } from "../dtos/postulacion-dto";

/** Puerto del backend de postulación. Todo método recibe el token de Django del postulante. */
export interface RepoPostulacion {
  obtenerMiExpediente(token: string): Promise<MiExpedienteDTO>;
  guardarBorrador(token: string, valores: ValoresVentana1): Promise<MiExpedienteDTO>;
  enviar(token: string): Promise<EnvioDTO>;
  cambiarClave(token: string, claveActual: string, claveNueva: string): Promise<SesionInvitadoDTO>;
  obtenerVentana2(token: string): Promise<Ventana2DTO>;
  /** Guarda UNA o varias secciones del borrador de la Ventana 2 (las enviadas reemplazan a las guardadas). */
  guardarVentana2(token: string, cuerpo: Record<string, unknown>): Promise<Ventana2DTO>;
  catalogosVentana2(token: string, estadoId?: number, municipioId?: number): Promise<CatalogosVentana2>;
}
