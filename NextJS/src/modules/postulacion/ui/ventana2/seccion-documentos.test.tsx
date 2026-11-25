import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DocumentoExpedienteDTO } from "@/modules/documentos/domain/lib/documentos-expediente";

const acciones = vi.hoisted(() => ({
  listarDocumentosAction: vi.fn(),
  guardarCamposDocumentoAction: vi.fn(),
  firmarDocumentoAction: vi.fn(),
  refrescarVentana2Action: vi.fn(),
}));
vi.mock("../../infrastructure/actions/postulacion-actions", () => acciones);

import { SeccionDocumentos } from "./seccion-documentos";

const BASE: DocumentoExpedienteDTO = {
  plantillaId: "p1", codigo: "OFERTA", nombre: "Oferta de servicios", descripcion: "Tu planilla de ingreso", proceso: "ventana2", procesoEtiqueta: "Datos complementarios",
  version: 1, firmante: "postulante", requiereFirma: true,
  camposPropios: [
    { clave: "sueldo", etiqueta: "Sueldo al que aspira", tipo: "texto", obligatorio: true, ayuda: "", opciones: [] },
    { clave: "inicio", etiqueta: "Fecha de inicio", tipo: "fecha", obligatorio: false, ayuda: "", opciones: [] },
  ],
  valores: {}, faltan: ["Sueldo al que aspira"], estado: "pendiente_datos", firmaInvalidada: false, documentoId: null, firma: null,
  textoConformidad: "Declaro que los datos son verdaderos. Acepto y declaro.", trabajadorCedula: "", archivoUrl: null,
};
const FIRMA = { firmadoEn: "2026-11-24T14:00:00Z", ipEnmascarada: "190.12.•.•", sha256: "ab".repeat(32), textoConformidad: "Acepto", documentoId: "d1", version: 1 };

function montar(docs: DocumentoExpedienteDTO[]) {
  acciones.listarDocumentosAction.mockResolvedValue({ ok: true, datos: docs });
  acciones.refrescarVentana2Action.mockResolvedValue({ ok: true, datos: { faltantes: [] } });
  const props = { onFaltantes: vi.fn(), onContinuar: vi.fn(), onAnterior: vi.fn(), onSesionCaida: vi.fn() };
  render(<SeccionDocumentos {...props} />);
  return props;
}

beforeEach(() => vi.clearAllMocks());

describe("paso «Documentos» de la Ventana 2", () => {
  it("lista cada documento con su estado y sus campos propios", async () => {
    montar([BASE]);
    expect(await screen.findByRole("heading", { name: /Oferta de servicios/ })).toBeInTheDocument();
    expect(screen.getByTestId("estado-documento")).toHaveTextContent("Faltan datos");
    expect(screen.getByLabelText(/Sueldo al que aspira/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver mi planilla/ })).toBeEnabled();
    expect(screen.getByText(/te falta 1 documento/i)).toBeInTheDocument();
  });

  it("sin documentos lo dice y deja continuar", async () => {
    const p = montar([]);
    expect(await screen.findByText(/no tienes documentos por completar/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(p.onContinuar).toHaveBeenCalled();
  });

  it("no se puede firmar sin marcar la casilla de conformidad", async () => {
    montar([{ ...BASE, faltan: [], estado: "listo_para_revisar", valores: { sueldo: "10" } }]);
    const boton = await screen.findByRole("button", { name: "Firmar documento" });
    expect(boton).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(boton).toBeEnabled();
    expect(screen.getByText(/Acepto y declaro/)).toBeInTheDocument();
  });

  it("firmar manda la conformidad, muestra la evidencia y recalcula lo que falta", async () => {
    const listo = { ...BASE, faltan: [], estado: "listo_para_revisar" as const, valores: { sueldo: "10" } };
    const p = montar([listo]);
    acciones.firmarDocumentoAction.mockResolvedValue({ ok: true, datos: { ...listo, estado: "firmado", documentoId: "d1", firma: FIRMA } });
    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Firmar documento" }));
    expect(acciones.firmarDocumentoAction).toHaveBeenCalledWith("OFERTA", true);
    expect(await screen.findByText("Documento firmado")).toBeInTheDocument();
    expect(screen.getByTestId("estado-documento")).toHaveTextContent("Firmado");
    expect(screen.getByText("abababab…abababab")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver mi documento firmado/ })).toHaveAttribute("href", "/postulacion/documento/OFERTA?tipo=archivo");
    await waitFor(() => expect(p.onFaltantes).toHaveBeenCalledWith([]));
  });

  it("con obligatorios vacíos avisa antes de firmar y no llama al servidor", async () => {
    montar([{ ...BASE, faltan: [], estado: "listo_para_revisar" }]);
    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Firmar documento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Completa antes de firmar: Sueldo al que aspira");
    expect(acciones.firmarDocumentoAction).not.toHaveBeenCalled();
  });

  it("guardar un cambio sobre un documento firmado avisa que la firma quedó sin efecto", async () => {
    const firmado = { ...BASE, faltan: [], estado: "firmado" as const, valores: { sueldo: "10" }, documentoId: "d1", firma: FIRMA };
    montar([firmado]);
    acciones.guardarCamposDocumentoAction.mockResolvedValue({
      ok: true, datos: { ...firmado, estado: "listo_para_revisar", firma: null, documentoId: null, firmaInvalidada: true, valores: { sueldo: "20" } },
    });
    const campo = await screen.findByLabelText(/Sueldo al que aspira/);
    await userEvent.clear(campo);
    await userEvent.type(campo, "20");
    expect(screen.getByText(/tendrás que firmar de nuevo/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    expect(acciones.guardarCamposDocumentoAction).toHaveBeenCalledWith("OFERTA", { sueldo: "20" });
    expect((await screen.findAllByText(/firma anterior quedó sin efecto/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Firmar documento" })).toBeDisabled();
    expect(screen.getByTestId("estado-documento")).toHaveTextContent("Falta tu firma");
  });

  it("muestra el error de un campo que el servidor rechazó", async () => {
    montar([{ ...BASE, camposPropios: [{ ...BASE.camposPropios[0] }] }]);
    acciones.guardarCamposDocumentoAction.mockResolvedValue({
      ok: false, mensaje: "Revisa los campos marcados.", errores: { "valores.sueldo": ["Es demasiado largo."] },
    });
    await userEvent.type(await screen.findByLabelText(/Sueldo al que aspira/), "x");
    await userEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    expect(await screen.findByText("Es demasiado largo.")).toBeInTheDocument();
  });

  it("una sesión caída se avisa al formulario madre", async () => {
    acciones.listarDocumentosAction.mockResolvedValue({ ok: false, mensaje: "x", sesionCaida: true });
    const onSesionCaida = vi.fn();
    render(<SeccionDocumentos onFaltantes={vi.fn()} onContinuar={vi.fn()} onSesionCaida={onSesionCaida} />);
    await waitFor(() => expect(onSesionCaida).toHaveBeenCalled());
  });
});
