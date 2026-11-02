import { describe, expect, it } from "vitest";
import {
  buscarEmpleadoCarnetSchema,
  disenarCarnetSchema,
  emitirCarnetSchema,
  subirPlantillaCarnetSchema,
} from "./schema-carnet";

describe("Schema de Emisión de Carnets", () => {
  it("valida emisión con datos correctos", () => {
    const res = emitirCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      motivoId: 1,
    });
    expect(res.success).toBe(true);
  });

  it("falla si no se selecciona un motivo", () => {
    const res = emitirCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      motivoId: 0,
    });
    expect(res.success).toBe(false);
  });

  it("valida cédula para búsqueda de trabajador", () => {
    expect(buscarEmpleadoCarnetSchema.safeParse({ cedula: "12345678" }).success).toBe(true);
    expect(buscarEmpleadoCarnetSchema.safeParse({ cedula: "abc" }).success).toBe(false);
    expect(buscarEmpleadoCarnetSchema.safeParse({ cedula: "" }).success).toBe(false);
  });

  it("valida datos completos para el diseñador de carnet", () => {
    const valid = disenarCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      nombreTitular: "Pedro Pérez",
      motivoId: 1,
    });
    expect(valid.success).toBe(true);

    const invalid = disenarCarnetSchema.safeParse({
      empleadoCedula: "12345678",
      nombreTitular: "ab", // menos de 3 caracteres
      motivoId: 1,
    });
    expect(invalid.success).toBe(false);
  });

  describe("subirPlantillaCarnetSchema (Zero-Trust / C2 / OWASP API3)", () => {
    const mockPngFile = new File(["dummy png content"], "plantilla.png", { type: "image/png" });
    const mockJpegFile = new File(["dummy jpeg content"], "plantilla.jpg", { type: "image/jpeg" });

    it("valida plantilla con nombre e imagen PNG o JPEG válida menor a 5MB", () => {
      const resPng = subirPlantillaCarnetSchema.safeParse({
        nombre: "Plantilla Oficial 2026",
        imagen: mockPngFile,
        activar: true,
      });
      expect(resPng.success).toBe(true);

      const resJpeg = subirPlantillaCarnetSchema.safeParse({
        nombre: "Plantilla Alternativa",
        imagen: mockJpegFile,
      });
      expect(resJpeg.success).toBe(true);
      if (resJpeg.success) {
        expect(resJpeg.data.activar).toBe(false);
      }
    });

    it("rechaza explícitamente imágenes SVG (image/svg+xml) por riesgo de XSS", () => {
      const mockSvgFile = new File(["<svg onload=alert(1)></svg>"], "malicious.svg", {
        type: "image/svg+xml",
      });
      const res = subirPlantillaCarnetSchema.safeParse({
        nombre: "Plantilla SVG",
        imagen: mockSvgFile,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("No se permiten imágenes vectoriales SVG");
      }
    });

    it("rechaza imágenes que superen el límite máximo de 5MB", () => {
      const oversizedFile = {
        name: "enorme.png",
        size: 5 * 1024 * 1024 + 1, // 5MB + 1 byte
        type: "image/png",
      } as unknown as File;

      const res = subirPlantillaCarnetSchema.safeParse({
        nombre: "Plantilla Pesada",
        imagen: oversizedFile,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("no puede exceder 5MB");
      }
    });

    it("rechaza archivos con formatos MIME no permitidos (ej. PDF, WebP)", () => {
      const pdfFile = new File(["%PDF-1.4"], "documento.pdf", { type: "application/pdf" });
      const resPdf = subirPlantillaCarnetSchema.safeParse({
        nombre: "Plantilla PDF",
        imagen: pdfFile,
      });
      expect(resPdf.success).toBe(false);

      const webpFile = new File(["RIFF"], "animacion.webp", { type: "image/webp" });
      const resWebp = subirPlantillaCarnetSchema.safeParse({
        nombre: "Plantilla WebP",
        imagen: webpFile,
      });
      expect(resWebp.success).toBe(false);
    });

    it("rechaza archivos vacíos (0 bytes)", () => {
      const emptyFile = {
        name: "vacio.png",
        size: 0,
        type: "image/png",
      } as unknown as File;

      const res = subirPlantillaCarnetSchema.safeParse({
        nombre: "Plantilla Vacía",
        imagen: emptyFile,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("no puede estar vacío");
      }
    });

    it("rechaza nombres vacíos, demasiado cortos o con inyección de tags HTML", () => {
      expect(
        subirPlantillaCarnetSchema.safeParse({
          nombre: "a",
          imagen: mockPngFile,
        }).success
      ).toBe(false);

      expect(
        subirPlantillaCarnetSchema.safeParse({
          nombre: "<script>alert(1)</script>",
          imagen: mockPngFile,
        }).success
      ).toBe(false);

      expect(
        subirPlantillaCarnetSchema.safeParse({
          nombre: "   ",
          imagen: mockPngFile,
        }).success
      ).toBe(false);
    });
  });
});
