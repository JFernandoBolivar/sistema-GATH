import { describe, expect, it } from "vitest";
import type { NotificacionApi } from "../http/notificaciones-api";
import { mapperNotificacion, mapperPaginaNotificaciones } from "./mapper-notificaciones";

const api: NotificacionApi = {
  id: "11111111-1111-4111-8111-111111111111",
  tipo: "autogestion.ventana_habilitada",
  titulo: "Ventana habilitada",
  mensaje: "Puede actualizar sus datos",
  enlace: "/autogestion/solicitudes",
  ref_tipo: "solicitud",
  ref_id: "abc",
  leida: false,
  fecha_lectura: null,
  creada_en: "2026-10-29T15:00:00Z",
};

describe("mapperNotificacion", () => {
  it("convierte snake_case a la entidad", () => {
    expect(mapperNotificacion(api)).toEqual({
      id: api.id,
      tipo: api.tipo,
      titulo: "Ventana habilitada",
      mensaje: "Puede actualizar sus datos",
      enlace: "/autogestion/solicitudes",
      refTipo: "solicitud",
      refId: "abc",
      leida: false,
      fechaLectura: null,
      creadaEn: "2026-10-29T15:00:00Z",
    });
  });
  it("tolera campos vacíos o nulos", () => {
    const e = mapperNotificacion({
      ...api,
      mensaje: null as unknown as string,
      enlace: null as unknown as string,
    });
    expect(e.mensaje).toBe("");
    expect(e.enlace).toBe("");
  });
});

describe("mapperPaginaNotificaciones", () => {
  it("traduce count/limit/offset/results", () => {
    const p = mapperPaginaNotificaciones({ count: 7, limit: 5, offset: 0, results: [api] });
    expect(p).toMatchObject({ total: 7, limite: 5, desplazamiento: 0 });
    expect(p.resultados).toHaveLength(1);
  });
});
