import { describe, expect, it } from "vitest";

import { registroApiADTO } from "./mapper-auditoria";

const base = {
  id: "1",
  fecha_hora: "2026-11-06T10:00:00",
  actor_cedula: "V1",
  actor_nombre: "Ana",
  actor_rol: "ANALISTA_BIENESTAR",
  modulo: "personal",
  accion: "personal.editar",
  recurso_tipo: "Employee",
  recurso_id: "1",
  ip: "10.0.0.1",
  user_agent: "x",
  resultado: "SUCCESS",
};

describe("registroApiADTO (O43)", () => {
  it("expone el nombre visible del rol y conserva el código de la bitácora", () => {
    const dto = registroApiADTO({ ...base, actor_rol_visible: "Analista de Bienestar" });

    expect(dto.actorRolVisible).toBe("Analista de Bienestar");
    expect(dto.actorRol).toBe("ANALISTA_BIENESTAR");
  });

  it("cae al código si el servidor no trae nombre visible", () => {
    expect(registroApiADTO(base).actorRolVisible).toBe("ANALISTA_BIENESTAR");
  });
});
