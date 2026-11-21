import type { ValoresVentana1 } from "../../domain/ventana1";
import type { EnvioDTO, MiExpedienteDTO, SesionInvitadoDTO } from "../dtos/postulacion-dto";

/** Puerto del backend de postulación. Todo método recibe el token de Django del postulante. */
export interface RepoPostulacion {
  obtenerMiExpediente(token: string): Promise<MiExpedienteDTO>;
  guardarBorrador(token: string, valores: ValoresVentana1): Promise<MiExpedienteDTO>;
  enviar(token: string): Promise<EnvioDTO>;
  cambiarClave(token: string, claveActual: string, claveNueva: string): Promise<SesionInvitadoDTO>;
}
