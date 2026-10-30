import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const obtener = vi.fn();
vi.mock("../../infrastructure/actions/fe-de-vida-actions", () => ({
  obtenerEvidenciaAction: (...a: unknown[]) => obtener(...a),
}));

import { VisorEvidencia } from "./visor-evidencia";

const OK = { ok: true, mensaje: "", datos: { mime: "image/jpeg", base64: btoa("jpg") } };
const crear = vi.fn(() => "blob:foto-1");
const revocar = vi.fn();

beforeEach(() => {
  obtener.mockReset();
  crear.mockClear();
  revocar.mockClear();
  URL.createObjectURL = crear;
  URL.revokeObjectURL = revocar;
});
afterEach(() => vi.restoreAllMocks());

describe("VisorEvidencia", () => {
  it("carga la foto desde el backend (object URL, nunca una URL del almacén) y permite ampliarla", async () => {
    obtener.mockResolvedValue(OK);
    render(<VisorEvidencia solicitudId="abc" />);
    expect(screen.getByRole("status")).toHaveTextContent(/cargando la foto/i);
    const img = await screen.findByAltText(/foto del pasivo/i);
    expect(img).toHaveAttribute("src", "blob:foto-1");
    expect(obtener).toHaveBeenCalledWith("abc");
    const ampliar = screen.getByRole("button", { name: /ampliar/i });
    await userEvent.click(ampliar);
    expect(screen.getByRole("button", { name: /reducir/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("muestra un error claro con reintento, no una imagen rota, y recupera al reintentar", async () => {
    obtener.mockResolvedValueOnce({ ok: false, mensaje: "No se pudo obtener la foto." }).mockResolvedValueOnce(OK);
    render(<VisorEvidencia solicitudId="abc" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo obtener la foto/i);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("button", { name: /ampliar/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(await screen.findByAltText(/foto del pasivo/i)).toBeInTheDocument();
    expect(obtener).toHaveBeenCalledTimes(2);
  });

  it("si el navegador no puede pintar la imagen, pasa al estado de error", async () => {
    obtener.mockResolvedValue(OK);
    render(<VisorEvidencia solicitudId="abc" />);
    const img = await screen.findByAltText(/foto del pasivo/i);
    img.dispatchEvent(new Event("error"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo mostrar/i);
  });

  it("revoca el object URL al desmontar", async () => {
    obtener.mockResolvedValue(OK);
    const { unmount } = render(<VisorEvidencia solicitudId="abc" />);
    await screen.findByAltText(/foto del pasivo/i);
    unmount();
    await waitFor(() => expect(revocar).toHaveBeenCalledWith("blob:foto-1"));
  });
});
