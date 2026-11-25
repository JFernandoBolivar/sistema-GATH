import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import type { DocumentoExpedienteDTO } from "@/modules/documentos/domain/lib/documentos-expediente";

const acciones = vi.hoisted(() => ({
  listarDocumentosExpedienteAction: vi.fn(),
  descargarDocumentoExpedienteAction: vi.fn(),
}));
vi.mock("../../infrastructure/actions/captacion-actions", () => acciones);
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { SeccionDocumentosExpediente } from "./seccion-documentos";

const FIRMADO: DocumentoExpedienteDTO = {
  plantillaId: "p1", codigo: "OFERTA", nombre: "Oferta de servicios", descripcion: "", proceso: "ventana2", procesoEtiqueta: "Datos complementarios", version: 2, firmante: "postulante",
  requiereFirma: true,
  camposPropios: [{ clave: "sueldo", etiqueta: "Sueldo al que aspira", tipo: "texto", obligatorio: true, ayuda: "", opciones: [] }],
  valores: { sueldo: "1500 USD" }, faltan: [], estado: "firmado", firmaInvalidada: false, documentoId: "d1",
  firma: { firmadoEn: "2026-11-24T14:00:00Z", ipEnmascarada: "190.12.•.•", sha256: "cd".repeat(32), textoConformidad: "Acepto y declaro", documentoId: "d1", version: 2 },
  textoConformidad: "", trabajadorCedula: "", archivoUrl: "/x",
};
const PENDIENTE: DocumentoExpedienteDTO = {
  ...FIRMADO, plantillaId: "p2", codigo: "CAJA", nombre: "Caja de Ahorro", valores: {}, faltan: ["Sueldo al que aspira"],
  estado: "pendiente_datos", documentoId: null, firma: null,
};

function montar(docs: DocumentoExpedienteDTO[] | Error) {
  if (docs instanceof Error) acciones.listarDocumentosExpedienteAction.mockResolvedValue({ ok: false, error: docs.message });
  else acciones.listarDocumentosExpedienteAction.mockResolvedValue({ ok: true, data: docs });
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SeccionDocumentosExpediente expedienteId="e1" />
    </SWRConfig>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("pestaña «Documentos» de Captación", () => {
  it("muestra el estado de cada documento, lo llenado y la evidencia con la IP enmascarada", async () => {
    montar([FIRMADO, PENDIENTE]);
    const firmado = await screen.findByTestId("documento-OFERTA");
    expect(firmado).toHaveTextContent("Firmado");
    expect(firmado).toHaveTextContent("1500 USD");
    expect(screen.getByTestId("evidencia-firma")).toHaveTextContent("190.12.•.•");
    expect(screen.getByTestId("evidencia-firma")).toHaveTextContent("cdcdcdcd…cdcdcdcd");
    expect(screen.getByTestId("documento-CAJA")).toHaveTextContent("Faltan datos");
    expect(screen.getByTestId("documento-CAJA")).toHaveTextContent("Faltan datos del postulante: Sueldo al que aspira");
    expect(screen.getByTestId("resumen-documentos")).toHaveTextContent("2 documentos · 1 firmado");
    expect(screen.getByRole("button", { name: "Ver el PDF de Oferta de servicios" })).toHaveTextContent("Ver PDF");
    expect(screen.getByRole("button", { name: "Ver el PDF de Caja de Ahorro" })).toHaveTextContent("sin firmar");
  });

  it("un documento listo pero sin firma se rotula como pendiente de firma", async () => {
    montar([{ ...PENDIENTE, faltan: [], estado: "listo_para_revisar" }]);
    expect(await screen.findByTestId("estado-documento")).toHaveTextContent("Falta la firma del postulante");
  });

  it("la descarga pide el PDF por código y la acción deja el resto al servidor", async () => {
    montar([FIRMADO]);
    acciones.descargarDocumentoExpedienteAction.mockResolvedValue({ ok: true, data: { base64: btoa("%PDF-1.4"), nombre: "oferta.pdf" } });
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    await userEvent.click(await screen.findByRole("button", { name: /Descargar el PDF/ }));
    expect(acciones.descargarDocumentoExpedienteAction).toHaveBeenCalledWith("e1", "OFERTA");
  });

  it("sin plantillas activas muestra el estado vacío", async () => {
    montar([]);
    expect(await screen.findByText("Sin documentos")).toBeInTheDocument();
  });

  it("si el servidor niega el permiso lo dice", async () => {
    montar(new Error("No tiene permiso para esta acción."));
    expect(await screen.findByText(/No tiene permiso/)).toBeInTheDocument();
  });
});
