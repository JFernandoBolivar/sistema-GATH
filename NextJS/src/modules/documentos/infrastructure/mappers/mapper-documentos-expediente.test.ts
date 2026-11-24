import { describe, expect, it } from "vitest";
import { mapearDocumentoExpediente, mapearDocumentosExpediente } from "./mapper-documentos-expediente";

const CRUDO = {
  plantilla_id: "p1", codigo: "OFERTA", nombre: "Oferta de servicios", descripcion: "d", momento: "ventana2", version: 2,
  firmante: "postulante", requiere_firma: true,
  campos_propios: [
    { clave: "sueldo", etiqueta: "Sueldo", tipo: "texto", obligatorio: true, ayuda: "" },
    { clave: "turno", etiqueta: "Turno", tipo: "opcion", obligatorio: false, ayuda: "x", opciones: ["DIURNO", "NOCTURNO"] },
    { clave: "raro", etiqueta: "Raro", tipo: "inventado" },
  ],
  valores: { sueldo: "10" }, faltan: ["Sueldo"], estado: "firmado", firma_invalidada: false, documento_id: "d1",
  firma: { firmado_en: "2026-11-24T10:00:00Z", ip_enmascarada: "190.12.•.•", sha256: "a".repeat(64), texto_conformidad: "Acepto", documento_id: "d1", version: 2 },
  texto_conformidad: "Declaro…", archivo_url: "/api/v1/postulacion/expedientes/e/documentos/OFERTA/archivo/",
};

describe("mapearDocumentoExpediente", () => {
  it("convierte la respuesta de la API", () => {
    const d = mapearDocumentoExpediente(CRUDO);
    expect(d).toMatchObject({
      codigo: "OFERTA", version: 2, requiereFirma: true, estado: "firmado", documentoId: "d1", faltan: ["Sueldo"],
      valores: { sueldo: "10" }, archivoUrl: "/api/v1/postulacion/expedientes/e/documentos/OFERTA/archivo/",
    });
    expect(d.firma).toEqual({ firmadoEn: "2026-11-24T10:00:00Z", ipEnmascarada: "190.12.•.•", sha256: "a".repeat(64), textoConformidad: "Acepto", documentoId: "d1", version: 2 });
    expect(d.camposPropios.map((c) => [c.clave, c.tipo, c.obligatorio])).toEqual([["sueldo", "texto", true], ["turno", "opcion", false], ["raro", "texto", false]]);
    expect(d.camposPropios[1].opciones).toEqual(["DIURNO", "NOCTURNO"]);
  });

  it("tolera lo que falta: estado desconocido es «faltan datos» y sin firma queda en null", () => {
    const d = mapearDocumentoExpediente({ codigo: "X", estado: "raro" });
    expect(d).toMatchObject({ estado: "pendiente_datos", firma: null, documentoId: null, camposPropios: [], faltan: [], archivoUrl: null });
  });

  it("una lista que no es lista queda vacía", () => {
    expect(mapearDocumentosExpediente(null)).toEqual([]);
    expect(mapearDocumentosExpediente([CRUDO])).toHaveLength(1);
  });
});
