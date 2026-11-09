import { describe, expect, it } from "vitest";

import { mapperRol } from "./mapper-catalogo";

describe("mapperRol (O43)", () => {
  it("separa el código interno del nombre visible", () => {
    const rol = mapperRol({
      id: 7,
      nombre_rol: "ADMIN_BIENESTAR",
      nombre_visible: "Administrador de Bienestar",
      descripcion_rol: "",
    });

    expect(rol.nombreRol).toBe("ADMIN_BIENESTAR");
    expect(rol.nombreVisible).toBe("Administrador de Bienestar");
  });

  it("si el servidor aún no trae nombre visible, cae al código", () => {
    const rol = mapperRol({ id: 8, nombre_rol: "AUDITOR", descripcion_rol: "" });

    expect(rol.nombreVisible).toBe("AUDITOR");
  });
});
