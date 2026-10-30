import type { RepoFeDeVida } from "../../domain/ports/repo-fe-de-vida";
import { feDeVidaApi, type CuerpoProceso } from "../http/fe-de-vida-api";
import {
  mapperCobertura,
  mapperDetalle,
  mapperPagina,
  mapperProceso,
  mapperProrroga,
  mapperSolicitud,
  mapperDetalleRevision,
  mapperVigente,
} from "../mappers/mapper-fe-de-vida";

/** Convierte el valor de un `datetime-local` (hora local) a ISO 8601; deja pasar lo que ya es ISO. */
export function aIso(valor: string): string {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toISOString();
}

function cuerpoProceso(d: Parameters<RepoFeDeVida["crearProceso"]>[0]): CuerpoProceso {
  return {
    nombre: d.nombre,
    fecha_apertura: aIso(d.apertura),
    fecha_cierre: aIso(d.cierre),
    tipos_nomina: d.tiposNomina,
    dias_recordatorio: d.diasRecordatorio,
  };
}

export const repoFeDeVidaApi: RepoFeDeVida = {
  async obtenerVigente() {
    return mapperVigente((await feDeVidaApi.vigente()).data);
  },
  async iniciarSolicitud() {
    return mapperSolicitud((await feDeVidaApi.iniciar()).data);
  },
  async listarMisSolicitudes(f) {
    return mapperPagina((await feDeVidaApi.misSolicitudes({ ...f })).data, mapperSolicitud);
  },
  async obtenerMiSolicitud(id) {
    return mapperDetalle((await feDeVidaApi.miSolicitud(id)).data);
  },
  async guardarBorrador(id, cambios) {
    const cuerpo = cambios.map((c) => ({
      seccion: c.seccion,
      entidad: c.entidad,
      accion: c.accion,
      campo: c.campo,
      valor: c.valor,
      entidad_id: c.entidadId ?? null,
    }));
    return mapperDetalle((await feDeVidaApi.borrador(id, cuerpo)).data);
  },
  async subirEvidencia(id, evidencia) {
    const form = new FormData();
    form.append("file", evidencia.archivo);
    form.append("origen", evidencia.origen);
    if (evidencia.metadatos) form.append("metadatos", JSON.stringify(evidencia.metadatos));
    return mapperSolicitud((await feDeVidaApi.evidencia(id, form)).data);
  },
  async enviar(id) {
    return mapperSolicitud((await feDeVidaApi.enviar(id)).data);
  },
  descargarConstancia: (id) => feDeVidaApi.constancia(id),

  async listarBandeja(f) {
    const { procesoId, ...resto } = f;
    return mapperPagina(
      (await feDeVidaApi.bandeja({ ...resto, proceso_id: procesoId })).data,
      mapperSolicitud,
    );
  },
  async obtenerDetalleRevision(id) {
    return mapperDetalleRevision((await feDeVidaApi.detalleRevision(id)).data);
  },
  async obtenerEvidencia(id) {
    const blob = await feDeVidaApi.evidenciaImagen(id);
    return {
      mime: blob.type || "application/octet-stream",
      base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
    };
  },
  async registrarCheck(id) {
    return mapperSolicitud((await feDeVidaApi.check(id)).data);
  },
  async retirarCheck(id, motivo) {
    return mapperSolicitud((await feDeVidaApi.retirarCheck(id, motivo)).data);
  },
  async aprobarDirecto(id, justificacion) {
    return mapperSolicitud((await feDeVidaApi.aprobarDirecto(id, justificacion)).data);
  },
  async devolver(id, motivo, requiereNuevaFoto) {
    return mapperSolicitud((await feDeVidaApi.devolver(id, motivo, requiereNuevaFoto)).data);
  },
  async rechazar(id, motivo) {
    return mapperSolicitud((await feDeVidaApi.rechazar(id, motivo)).data);
  },

  async listarProcesos(f) {
    return mapperPagina((await feDeVidaApi.procesos({ ...f })).data, mapperProceso);
  },
  async listarTiposPension() {
    return (await feDeVidaApi.tiposPension()).data.map((t) => ({ id: t.id, nombre: t.nombre }));
  },
  async crearProceso(d) {
    return mapperProceso((await feDeVidaApi.crearProceso(cuerpoProceso(d))).data);
  },
  async editarProceso(id, d) {
    return mapperProceso((await feDeVidaApi.editarProceso(id, cuerpoProceso(d))).data);
  },
  async abrirProceso(id) {
    return mapperProceso((await feDeVidaApi.abrir(id)).data);
  },
  async cerrarProceso(id) {
    return mapperProceso((await feDeVidaApi.cerrar(id)).data);
  },
  async listarProrrogas(procesoId) {
    const data = (await feDeVidaApi.prorrogas(procesoId)).data;
    return (Array.isArray(data) ? data : data.results).map(mapperProrroga);
  },
  async prorrogar(procesoId, d) {
    return mapperProrroga(
      (
        await feDeVidaApi.prorrogar(procesoId, {
          nueva_fecha_limite: aIso(d.nuevaFechaLimite),
          motivo: d.motivo,
          cedula: d.cedula ?? "",
        })
      ).data,
    );
  },

  async listarCobertura(f) {
    const { tipoNominaId, sinCorreo, sinCuenta, ...resto } = f;
    return mapperPagina(
      (
        await feDeVidaApi.cobertura({
          ...resto,
          tipo_nomina_id: tipoNominaId,
          sin_correo: sinCorreo,
          sin_cuenta: sinCuenta,
        })
      ).data,
      mapperCobertura,
    );
  },
};

