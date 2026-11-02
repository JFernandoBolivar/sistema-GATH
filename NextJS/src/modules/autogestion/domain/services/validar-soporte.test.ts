import { describe, expect, it } from "vitest";
import {
  MAX_BYTES_FOTO,
  MAX_BYTES_SOPORTE,
  formatearTamano,
  validarArchivoSoporte,
} from "./validar-soporte";

describe("validarArchivoSoporte", () => {
  it("acepta PDF, JPG y PNG dentro del límite", () => {
    expect(validarArchivoSoporte({ name: "titulo.PDF", size: 1000 }, false)).toBeNull();
    expect(validarArchivoSoporte({ name: "a.jpeg", size: MAX_BYTES_SOPORTE }, false)).toBeNull();
  });
  it("rechaza tipo no permitido, vacío y exceso de tamaño", () => {
    expect(validarArchivoSoporte({ name: "a.exe", size: 10 }, false)).toContain("PDF, JPG o PNG");
    expect(validarArchivoSoporte({ name: "a.pdf", size: 0 }, false)).toContain("vacío");
    expect(validarArchivoSoporte({ name: "a.pdf", size: MAX_BYTES_SOPORTE + 1 }, false)).toContain(
      "10 MB",
    );
    expect(validarArchivoSoporte({ name: "sinextension", size: 10 }, false)).not.toBeNull();
  });
  it("la foto solo admite JPG/PNG hasta 5 MB", () => {
    expect(validarArchivoSoporte({ name: "f.pdf", size: 10 }, true)).toBe(
      "La foto debe ser JPG o PNG.",
    );
    expect(validarArchivoSoporte({ name: "f.png", size: MAX_BYTES_FOTO + 1 }, true)).toContain(
      "5 MB",
    );
    expect(validarArchivoSoporte({ name: "f.jpg", size: 100 }, true)).toBeNull();
  });
  it("formatea tamaños", () => {
    expect(formatearTamano(500)).toBe("500 B");
    expect(formatearTamano(2048)).toBe("2 KB");
    expect(formatearTamano(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
