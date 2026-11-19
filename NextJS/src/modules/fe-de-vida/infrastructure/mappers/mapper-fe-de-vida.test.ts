import { describe, expect, it } from "vitest";
import {
  mapperDetalle,
  mapperDetalleRevision,
  mapperEstadisticas,
  mapperEstadoSolicitud,
  mapperPagina,
  mapperProceso,
  mapperSolicitud,
  mapperVigente,
} from "./mapper-fe-de-vida";
import type { EstadisticasApi, SolicitudApi } from "../http/fe-de-vida-api";

const api: SolicitudApi = {
  id: "s1",
  proceso_id: "p1",
  cedula: "123",
  estado: "DEVUELTA",
  version: 2,
  envios: 1,
  origen_evidencia: "CAMARA",
  tiene_evidencia: true,
  via_aprobacion: null,
  requiere_nueva_foto: true,
  fecha_envio: null,
  fecha_validacion: null,
  decisiones: [{ tipo: "DEVOLUCION", rol: "ANALISTA", actor_cedula: "9", envio: 1, motivo: "Foto", fecha: null }],
};

describe("mapper fe de vida", () => {
  it("mapea la solicitud a camelCase", () => {
    const s = mapperSolicitud(api);
    expect(s).toMatchObject({ procesoId: "p1", estado: "DEVUELTA", origenEvidencia: "CAMARA", requiereNuevaFoto: true });
    expect(s.decisiones[0]).toMatchObject({ tipo: "DEVOLUCION", actorCedula: "9", motivo: "Foto" });
  });

  it("mapea la excepción presencial «No tiene correo» (O39)", () => {
    const s = mapperSolicitud({
      ...api,
      sin_correo_alternativo: true,
      justificacion_sin_correo: "El pasivo no posee correo electrónico.",
    });
    expect(s.sinCorreoAlternativo).toBe(true);
    expect(s.justificacionSinCorreo).toBe("El pasivo no posee correo electrónico.");
  });
  it("mapea la marca de que quien registró también aprobó (falsa si el servidor no la envía)", () => {
    expect(mapperSolicitud(api).registradorTambienAprobo).toBe(false);
    expect(mapperSolicitud({ ...api, registrador_tambien_aprobo: true }).registradorTambienAprobo).toBe(true);
  });
  it("tolera el nombre previo REPETICION_SOLICITADA y estados desconocidos", () => {
    expect(mapperEstadoSolicitud("REPETICION_SOLICITADA")).toBe("DEVUELTA");
    expect(mapperEstadoSolicitud("XYZ")).toBe("BORRADOR");
  });
  it("el proceso acepta apertura/cierre o fecha_apertura/fecha_cierre y el alcance", () => {
    const nuevo = mapperProceso({
      id: "p",
      nombre: "FV",
      estado: "ABIERTO",
      apertura: "a",
      cierre: "c",
      tipos_nomina: [{ id: 1, nombre: "Jubilados" }],
      dias_recordatorio: [7, 1],
      prorrogas: { total: 2, vigentes: 1, general_vigente: true, individuales_vigentes: 0, hasta: "2026-12-15T00:00:00Z" },
    });
    expect(nuevo).toMatchObject({ apertura: "a", cierre: "c", diasRecordatorio: [7, 1] });
    expect(nuevo.tiposNomina).toEqual([{ id: 1, nombre: "Jubilados" }]);
    expect(nuevo.prorrogas).toEqual({
      total: 2, vigentes: 1, generalVigente: true, individualesVigentes: 0, hasta: "2026-12-15T00:00:00Z",
    });
    const previo = mapperProceso({ id: "p", nombre: "FV", estado: "CERRADO", fecha_apertura: "x", fecha_cierre: "y" });
    expect(previo).toMatchObject({ apertura: "x", cierre: "y", tiposNomina: [], diasRecordatorio: [] });
    // Sin resumen del servidor (contrato previo) el proceso queda sin prórrogas.
    expect(previo.prorrogas).toEqual({
      total: 0, vigentes: 0, generalVigente: false, individualesVigentes: 0, hasta: null,
    });
  });
  it("vigente nulo se mantiene nulo", () => {
    expect(mapperVigente(null)).toBeNull();
  });
  it("detalle y página", () => {
    const d = mapperDetalle({
      solicitud: api,
      cambios: [
        {
          id: "c",
          seccion: "contacto",
          accion: "MODIFICAR",
          entidad: "employee",
          entidad_id: null,
          campo: "telefono_movil",
          valor_anterior: "1",
          valor_propuesto: "2",
          valor_actual: "1",
          conflicto: true,
        },
      ],
    });
    expect(d.cambios[0]).toMatchObject({ valorActual: "1", conflicto: true, entidad: "employee" });
    expect(mapperPagina({ count: 1, limit: 10, offset: 0, results: [api] }, mapperSolicitud).results).toHaveLength(1);
  });
});

describe("mapperDetalleRevision", () => {
  it("trae ficha, proceso, nombre de quien decidió y solo las acciones conocidas", () => {
    const d = mapperDetalleRevision({
      solicitud: { ...api, decisiones: [{ tipo: "CHECK_RETIRADO", rol: "ANALISTA", actor_cedula: "1", actor_nombre: "ANA LOPEZ", envio: 1, motivo: "por error", fecha: null }] },
      cambios: [],
      proceso_nombre: "Fe de vida 2026",
      acciones_disponibles: ["dar_check", "inventada", "retirar_check"],
      proceso_cerrado: true,
      ficha: {
        empleado: {
          cedula: "5", nombres: "MARIA", apellidos: "PEREZ", fecha_nacimiento: "1950-10-30",
          asignaciones: [{ tipo_nomina: "JUBILADO", denominacion_cargo: "ANALISTA", coordinacion: "N/A" }],
          datos_vivienda: { estado_nombre: "MIRANDA", direccion_exacta: "  " },
          contacto_emergencia: [{ id: 3, nombres: "LUIS", apellidos: "P", relacion_nombre: "HERMANO", telefono: null }],
          antecedentes: [{ fecha_ingreso: "1990-01-15", fecha_egreso: null }],
        },
        familiares: [{ id: 9, primer_nombre: "ANA", segundo_nombre: null, primer_apellido: "PEREZ", parentesco_nombre: "HIJO (A)" }],
        datos_complementarios: { correo_alternativo: "a@b.test", tiene_hijos: true },
      },
    });
    expect(d.acciones).toEqual(["dar_check", "retirar_check"]);
    expect(d.procesoCerrado).toBe(true);
    expect(d.procesoNombre).toBe("Fe de vida 2026");
    expect(d.solicitud.decisiones[0]).toMatchObject({ tipo: "CHECK_RETIRADO", actorNombre: "ANA LOPEZ" });
    expect(d.ficha).toMatchObject({
      nombres: "MARIA", correoAlternativo: "a@b.test", tieneHijos: true, fechaIngreso: "1990-01-15", fechaEgreso: null,
      asignacion: { tipoNomina: "JUBILADO", cargo: "ANALISTA" },
      vivienda: { estado: "MIRANDA", direccion: null },
      contactosEmergencia: [{ id: "3", parentesco: "HERMANO", telefono: null }],
      familiares: [{ id: "9", nombre: "ANA PEREZ", parentesco: "HIJO (A)" }],
    });
  });
  it("sin ficha (sin permiso) la deja nula", () => {
    expect(mapperDetalleRevision({ solicitud: api, cambios: [], ficha: null }).ficha).toBeNull();
  });
});

describe("mapperEstadisticas", () => {
  it("mapea la prórroga del proceso elegido y deja el catálogo sin inventarla", () => {
    const e: EstadisticasApi = {
      proceso: {
        id: "p1", nombre: "Fe de vida 2026", estado: "CERRADO", apertura: "a", cierre: "c",
        prorrogas: {
          total: 1, vigentes: 1, general_vigente: true, individuales_vigentes: 0,
          hasta: "2026-12-15T00:00:00Z",
        },
      },
      procesos: [{ id: "p1", nombre: "Fe de vida 2026", estado: "CERRADO", apertura: "a", cierre: "c" }],
      tipos: [{ id: 1, nombre: "JUBILADO" }],
      kpis: {
        total: 4, respondieron: 1, faltan: 3, validadas: 0,
        porcentaje_respondieron: 25, porcentaje_faltan: 75, porcentaje_validadas: 0,
      },
      por_tipo: [], por_estado: [], por_canal: [], matriz: [],
      filtros: { proceso_id: null, tipo_nomina_id: null, estado: null, canal: null, desde: null, hasta: null },
    };
    const mapeado = mapperEstadisticas(e);
    expect(mapeado.proceso?.prorrogas).toEqual({
      total: 1, vigentes: 1, generalVigente: true, individualesVigentes: 0, hasta: "2026-12-15T00:00:00Z",
    });
    expect(mapeado.procesos[0].prorrogas).toBeUndefined();
  });
});
