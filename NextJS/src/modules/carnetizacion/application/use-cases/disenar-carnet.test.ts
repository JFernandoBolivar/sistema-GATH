import { describe, expect, it } from "vitest";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import type { Carnet, DatosCarnetEmpleado, EstadisticasCarnet, PlantillaCarnet } from "../../domain/entities/carnet";
import {
  construirVistaPreviaCarnet,
  escapeHtml,
  generarHtmlVistaPrevia,
  obtenerDatosEmpleadoParaCarnet,
  sanitizeUrl,
  truncarNombre,
} from "./disenar-carnet";

class RepoCarnetizacionMock implements RepoCarnetizacion {
  async listarCarnets(): Promise<Carnet[]> { return []; }
  async emitirCarnet(): Promise<Carnet> { throw new Error("not implemented"); }
  async validarPorHash() { return { esValido: false, mensaje: "", carnet: null }; }
  async validarPorId() { return { esValido: false, mensaje: "", carnet: null }; }
  async listarPlantillas(): Promise<PlantillaCarnet[]> { return []; }
  async crearPlantilla(): Promise<PlantillaCarnet> { throw new Error("not implemented"); }
  async activarPlantilla(): Promise<PlantillaCarnet> { throw new Error("not implemented"); }
  async descargarPdf(): Promise<Blob> { return new Blob(); }
  async revocarCarnet(): Promise<Carnet> { throw new Error("not implemented"); }
  async obtenerEstadisticas(): Promise<EstadisticasCarnet> {
    return { total: 0, activos: 0, revocados: 0, emitidosHoy: 0, emitidosMes: 0, porMotivo: [] };
  }
  async obtenerDatosEmpleado(cedula: string): Promise<DatosCarnetEmpleado | null> {
    if (cedula === "12345678") {
      return {
        cedula: "12345678",
        nombres: "Pedro José",
        apellidos: "Pérez Gómez",
        nombreCompleto: "Pedro José Pérez Gómez",
        codigo: "EMP-001",
        cargo: "Especialista en Telecomunicaciones",
        departamento: "Dirección de TI",
        fotoUrl: "https://example.com/foto.jpg",
      };
    }
    return null;
  }
}

describe("Diseñador de carnet — Use cases", () => {
  describe("truncarNombre", () => {
    it("mantiene nombres cortos de hasta 3 partes", () => {
      expect(truncarNombre("Pedro")).toBe("Pedro");
      expect(truncarNombre("Pedro Pérez")).toBe("Pedro Pérez");
      expect(truncarNombre("Pedro José Pérez")).toBe("Pedro José Pérez");
    });

    it("trunca nombres de más de 3 palabras a 2 nombres y 2 apellidos", () => {
      expect(truncarNombre("Pedro José Pérez Gómez")).toBe("Pedro José Pérez Gómez");
      expect(truncarNombre("María José de los Ángeles Rodríguez Pérez")).toBe("María José Rodríguez Pérez");
    });
  });

  describe("generarHtmlVistaPrevia", () => {
    it("genera el markup con datos del titular y cédula", () => {
      const html = generarHtmlVistaPrevia({
        cedula: "12345678",
        nombreCompleto: "Pedro Pérez",
        cargo: "Analista",
        departamento: "Recursos Humanos",
        fotoUrl: "data:image/png;base64,mock",
      });
      expect(html).toContain("PEDRO PÉREZ");
      expect(html).toContain("C.I: 12345678");
      expect(html).toContain("ANALISTA");
      expect(html).toContain("RECURSOS HUMANOS");
      expect(html).toContain("data:image/png;base64,mock");
      expect(html).toContain("GATH • IDENTIDAD");
    });

    it("incluye background de plantilla si se provee plantillaUrl", () => {
      const html = generarHtmlVistaPrevia({
        cedula: "12345678",
        nombreCompleto: "Pedro Pérez",
        plantillaUrl: "https://example.com/plantilla.png",
      });
      expect(html).toContain("https://example.com/plantilla.png");
    });

    it("mitiga XSS escapando caracteres HTML en nombre, cargo y departamento (C1 / OWASP A03)", () => {
      const payloadXss = '"><img src=x onerror="alert(1)">';
      const html = generarHtmlVistaPrevia({
        cedula: "12345678",
        nombreCompleto: payloadXss,
        cargo: '<script>alert("xss")</script>',
        departamento: '<b>Depto</b>',
      });
      // Verifica que no se inyecten tags HTML sin escapar
      expect(html).not.toContain('<img src=x onerror="alert(1)">');
      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).not.toContain('<b>Depto</b>');
      // Verifica que los caracteres peligrosos estén escapados como entidades HTML
      expect(html).toContain("&quot;&gt;&lt;IMG SRC=X ONERROR=&quot;ALERT(1)&quot;&gt;");
      expect(html).toContain("&lt;SCRIPT&gt;ALERT(&quot;XSS&quot;)&lt;/SCRIPT&gt;");
      expect(html).toContain("&lt;B&gt;DEPTO&lt;/B&gt;");
    });

    it("neutraliza URLs con pseudo-protocolo javascript: en fotos y plantillas (C1 / OWASP A03)", () => {
      const html = generarHtmlVistaPrevia({
        cedula: "12345678",
        nombreCompleto: "Pedro Pérez",
        fotoUrl: "javascript:alert(document.cookie)",
        plantillaUrl: "javascript:alert(1)",
      });
      expect(html).not.toContain("javascript:");
      // Debe usar el fallback seguro de foto SVG
      expect(html).toContain("FOTO");
    });
  });

  describe("escapeHtml y sanitizeUrl (Seguridad)", () => {
    it("escapa caracteres especiales HTML correctamente", () => {
      expect(escapeHtml('<script>alert("test") & \'hack\'</script>')).toBe(
        "&lt;script&gt;alert(&quot;test&quot;) &amp; &#039;hack&#039;&lt;/script&gt;"
      );
    });

    it("permite URLs seguras con http, https, data:image y relativas", () => {
      expect(sanitizeUrl("https://conatel.gob.ve/logo.png")).toBe("https://conatel.gob.ve/logo.png");
      expect(sanitizeUrl("http://localhost:3000/foto.jpg")).toBe("http://localhost:3000/foto.jpg");
      expect(sanitizeUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")).toBe(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
      );
      expect(sanitizeUrl("/plantillas/oficial.png")).toBe("/plantillas/oficial.png");
    });

    it("bloquea URLs inseguras devolviendo null", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
      expect(sanitizeUrl("vbscript:msgbox(1)")).toBeNull();
      expect(sanitizeUrl(null)).toBeNull();
      expect(sanitizeUrl(undefined)).toBeNull();
    });
  });

  describe("obtenerDatosEmpleadoParaCarnet y construirVistaPreviaCarnet", () => {
    it("obtiene datos del empleado desde el puerto de repositorio", async () => {
      const repo = new RepoCarnetizacionMock();
      const empleado = await obtenerDatosEmpleadoParaCarnet(repo, "12345678");
      expect(empleado).not.toBeNull();
      expect(empleado?.cedula).toBe("12345678");
      expect(empleado?.nombreCompleto).toBe("Pedro José Pérez Gómez");
      expect(empleado?.cargo).toBe("Especialista en Telecomunicaciones");

      const inexistente = await obtenerDatosEmpleadoParaCarnet(repo, "99999999");
      expect(inexistente).toBeNull();
    });

    it("construye el DTO completo de vista previa", () => {
      const dto = construirVistaPreviaCarnet({
        cedula: "12345678",
        nombreCompleto: "Pedro Pérez",
        cargo: "Ingeniero",
      });
      expect(dto.cedula).toBe("12345678");
      expect(dto.htmlVistaPrevia).toContain("PEDRO PÉREZ");
    });
  });
});
