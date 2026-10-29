import { describe, expect, it } from "vitest";

import { esPerfilAutogestion, esPerfilRecepcionista } from "./perfil-acceso";

const AUTOGESTION = [
  "autogestion.ver_propio",
  "autogestion.actualizar_propio",
  "autogestion.censo_ver_propio",
  "autogestion.censo_actualizar_propio",
];
const RECEPCIONISTA = ["familiares.ver", "pasivos.ver", "personal.ver", "personal.ver_detalle"];
const PRESUPUESTO = ["cargos.ver", "personal.ver", "pasivos.ver", "reportes.ver"];
const BIENESTAR = ["personal.ver", "personal.ver_salud", "reportes.ver", "familiares.ver"];

describe("perfiles de acceso por permisos", () => {
  it("autogestión: censo propio sin personal.ver", () => {
    expect(esPerfilAutogestion(AUTOGESTION)).toBe(true);
    expect(esPerfilRecepcionista(AUTOGESTION)).toBe(false);
  });
  it("recepcionista: personal.ver sin crear ni reportes", () => {
    expect(esPerfilRecepcionista(RECEPCIONISTA)).toBe(true);
    expect(esPerfilAutogestion(RECEPCIONISTA)).toBe(false);
  });
  it("presupuesto y bienestar no son recepcionista ni autogestión", () => {
    for (const p of [PRESUPUESTO, BIENESTAR]) {
      expect(esPerfilRecepcionista(p)).toBe(false);
      expect(esPerfilAutogestion(p)).toBe(false);
    }
  });
  it("administrador (*) no cae en ningún perfil restringido", () => {
    expect(esPerfilRecepcionista(["*"])).toBe(false);
    expect(esPerfilAutogestion(["*"])).toBe(false);
  });
  it("sin permisos: ningún perfil", () => {
    expect(esPerfilAutogestion(undefined)).toBe(false);
    expect(esPerfilRecepcionista(null)).toBe(false);
  });
});
