import { describe, expect, it } from "vitest";
import {
  mapperDetalle,
  mapperEstadoSolicitud,
  mapperPagina,
  mapperProceso,
  mapperSolicitud,
  mapperVigente,
} from "./mapper-fe-de-vida";
import type { SolicitudApi } from "../http/fe-de-vida-api";

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
    });
    expect(nuevo).toMatchObject({ apertura: "a", cierre: "c", diasRecordatorio: [7, 1] });
    expect(nuevo.tiposNomina).toEqual([{ id: 1, nombre: "Jubilados" }]);
    const previo = mapperProceso({ id: "p", nombre: "FV", estado: "CERRADO", fecha_apertura: "x", fecha_cierre: "y" });
    expect(previo).toMatchObject({ apertura: "x", cierre: "y", tiposNomina: [], diasRecordatorio: [] });
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
