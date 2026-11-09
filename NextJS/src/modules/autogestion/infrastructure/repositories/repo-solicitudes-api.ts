import type { RepoSolicitudes } from "../../domain/ports/repo-solicitudes";
import { solicitudesApi } from "../http/solicitudes-api";
import {
  mapperDatosComplementarios,
  mapperDetalle,
  mapperPagina,
  mapperSeccion,
  mapperSolicitud,
  mapperSoporte,
} from "../mappers/mapper-solicitudes";

export const repoSolicitudesApi: RepoSolicitudes = {
  async listarMias({ fechaDesde, fechaHasta, ...resto }) {
    return mapperPagina(
      (
        await solicitudesApi.listarMias({
          ...resto,
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
        })
      ).data,
    );
  },
  async obtenerMia(id) {
    return mapperDetalle((await solicitudesApi.obtenerMia(id)).data);
  },
  async solicitar(campos, motivo) {
    return mapperSolicitud((await solicitudesApi.solicitar(campos, motivo)).data);
  },
  async guardarBorrador(id, cambios, version) {
    return mapperDetalle((await solicitudesApi.guardarBorrador(id, cambios, version)).data);
  },
  async subirSoporte(id, soporte) {
    const formData = new FormData();
    formData.append("seccion", soporte.seccion);
    formData.append("tipo", soporte.tipo);
    formData.append("file", soporte.archivo);
    return mapperSoporte((await solicitudesApi.subirSoporte(id, formData)).data);
  },
  async eliminarSoporte(id, soporteId) {
    await solicitudesApi.eliminarSoporte(id, soporteId);
  },
  async enviar(id, version) {
    return mapperSolicitud((await solicitudesApi.enviar(id, version)).data);
  },
  async listarSecciones() {
    return (await solicitudesApi.listarSecciones()).data.map(mapperSeccion);
  },
  async obtenerMisDatosComplementarios() {
    return mapperDatosComplementarios((await solicitudesApi.misDatosComplementarios()).data);
  },
  async listarBandeja(filtros) {
    return mapperPagina((await solicitudesApi.listarBandeja(filtros)).data);
  },
  async obtenerDetalle(id) {
    return mapperDetalle((await solicitudesApi.obtenerDetalle(id)).data);
  },
  async obtenerComparativo(id) {
    return mapperDetalle((await solicitudesApi.obtenerComparativo(id)).data);
  },
  async habilitar(id, plazoDias, secciones) {
    return mapperSolicitud((await solicitudesApi.habilitar(id, plazoDias, secciones)).data);
  },
  async prorrogar(id, nuevaFechaFin, motivo) {
    return mapperSolicitud((await solicitudesApi.prorrogar(id, nuevaFechaFin, motivo)).data);
  },
  async decidir(id, decision) {
    return mapperDetalle(
      (
        await solicitudesApi.decidir(id, {
          version: decision.version,
          decisiones: decision.decisiones.map((d) => ({
            cambio_id: d.cambioId,
            aprobado: d.aprobado,
            motivo: d.motivo,
          })),
          ...(decision.motivoGeneral ? { motivo_general: decision.motivoGeneral } : {}),
        })
      ).data,
    );
  },
  async devolver(id, motivo, version) {
    return mapperSolicitud((await solicitudesApi.devolver(id, motivo, version)).data);
  },
  async rechazar(id, motivo, version) {
    return mapperSolicitud((await solicitudesApi.rechazar(id, motivo, version)).data);
  },
};
