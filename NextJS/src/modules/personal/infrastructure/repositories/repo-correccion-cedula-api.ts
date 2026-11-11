import type { CondicionTrabajador } from "../../domain/entities/correccion-cedula";
import type { RepoCorreccionCedula } from "../../domain/ports/repo-correccion-cedula";
import { correccionCedulaApi } from "../http/correccion-cedula-api";

const CONDICIONES: CondicionTrabajador[] = ["ACTIVO", "PASIVO", "SIN_ASIGNACION"];

export const repoCorreccionCedulaApi: RepoCorreccionCedula = {
  async vistaPrevia(solicitud) {
    const { data } = await correccionCedulaApi.vistaPrevia({
      cedula_actual: solicitud.cedulaActual,
      cedula_nueva: solicitud.cedulaNueva,
    });
    return {
      trabajador: {
        cedulaActual: data.trabajador.cedula_actual,
        nombre: data.trabajador.nombre,
        condicion: CONDICIONES.includes(data.trabajador.condicion as CondicionTrabajador)
          ? (data.trabajador.condicion as CondicionTrabajador)
          : "SIN_ASIGNACION",
      },
      cedulaNueva: data.cedula_nueva,
      cuenta: {
        existe: data.cuenta.existe,
        correo: data.cuenta.correo ?? null,
        claveInicialPendiente: data.cuenta.clave_inicial_pendiente,
      },
      afectados: data.afectados,
      totalRegistros: data.total_registros,
    };
  },
  async ejecutar(solicitud) {
    const { data } = await correccionCedulaApi.ejecutar({
      cedula_actual: solicitud.cedulaActual,
      cedula_nueva: solicitud.cedulaNueva,
      motivo: solicitud.motivo,
      confirmacion: solicitud.confirmacion,
    });
    return {
      cedulaAnterior: data.cedula_anterior,
      cedulaNueva: data.cedula_nueva,
      afectados: data.afectados,
      totalRegistros: data.total_registros,
      claveInicialActualizada: data.clave_inicial_actualizada,
    };
  },
};
