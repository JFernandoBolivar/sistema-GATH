import { describe, expect, it } from "vitest";

import { disposicionPorAncho } from "./use-media-query";

describe("disposicionPorAncho", () => {
  it("usa tres columnas solo con ancho útil amplio", () => {
    expect(disposicionPorAncho(1440)).toBe("ancho");
    expect(disposicionPorAncho(1024)).toBe("medio");
    expect(disposicionPorAncho(899)).toBe("movil");
    expect(disposicionPorAncho(390)).toBe("movil");
  });
});
