import type {
  EjecucionCorreccionCedula,
  ResultadoCorreccionCedula,
  SolicitudCorreccionCedula,
  VistaPreviaCorreccionCedula,
} from "../entities/correccion-cedula";

export interface RepoCorreccionCedula {
  vistaPrevia(solicitud: SolicitudCorreccionCedula): Promise<VistaPreviaCorreccionCedula>;
  ejecutar(solicitud: EjecucionCorreccionCedula): Promise<ResultadoCorreccionCedula>;
}
