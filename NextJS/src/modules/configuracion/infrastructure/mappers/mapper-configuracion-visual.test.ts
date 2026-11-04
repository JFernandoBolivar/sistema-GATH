import { describe, expect, it } from "vitest";

import { versionImagenApiAEntidad } from "./mapper-configuracion-visual";

describe("versionImagenApiAEntidad", () => {
  it("convierte snake_case a la entidad", () => {
    expect(
      versionImagenApiAEntidad({
        id: "u1",
        campo: "cintillo_pie_clave",
        mime: "image/webp",
        tamano: 2048,
        subido_en: "2026-11-03T12:00:00Z",
        subido_por_cedula: "V123",
        subido_por_nombre: "Ana Pérez",
        es_vigente: true,
        url: "/api/v1/configuracion/visual/logo/cintillo-pie/versiones/u1/",
      }),
    ).toEqual({
      id: "u1",
      campo: "cintillo_pie_clave",
      mime: "image/webp",
      tamano: 2048,
      subidoEn: "2026-11-03T12:00:00Z",
      subidoPorCedula: "V123",
      subidoPorNombre: "Ana Pérez",
      esVigente: true,
      url: "/api/v1/configuracion/visual/logo/cintillo-pie/versiones/u1/",
    });
  });
});
