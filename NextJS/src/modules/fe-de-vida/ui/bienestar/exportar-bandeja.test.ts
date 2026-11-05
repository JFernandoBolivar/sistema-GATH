import { describe, expect, it } from "vitest";
import { consultaExportarBandeja, parametrosExportarBandeja } from "./exportar-bandeja";

describe("exportación de la bandeja", () => {
  it("envía los filtros activos y el histórico", () => {
    const params = parametrosExportarBandeja(
      { texto: "  maria  ", estado: "VALIDADA", procesoId: "p1", desde: "2026-10-01", hasta: "" },
      true,
      "pdf",
    );
    expect(params).toEqual({
      texto: "maria", estado: "VALIDADA", proceso_id: "p1",
      desde: "2026-10-01", hasta: "", historico: true, formato: "pdf",
    });
  });

  it("omite los filtros vacíos y el histórico en falso", () => {
    const query = consultaExportarBandeja(parametrosExportarBandeja(
      { texto: "", estado: "", procesoId: "", desde: "", hasta: "" }, false, "excel",
    ));
    expect(query).toBe("formato=excel");
  });
});
