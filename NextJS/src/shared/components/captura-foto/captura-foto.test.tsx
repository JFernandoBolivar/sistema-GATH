import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CapturaFoto } from "./captura-foto";

function simularMedios(opciones: {
  camaras?: number;
  getUserMedia?: () => Promise<MediaStream>;
  seguro?: boolean;
}) {
  const stop = vi.fn();
  const flujo = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  Object.defineProperty(window, "isSecureContext", {
    value: opciones.seguro ?? true,
    configurable: true,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      enumerateDevices: vi
        .fn()
        .mockResolvedValue(
          Array.from({ length: opciones.camaras ?? 0 }, () => ({ kind: "videoinput" })),
        ),
      getUserMedia: vi.fn(opciones.getUserMedia ?? (() => Promise.resolve(flujo))),
    },
  });
  return { stop };
}

function archivo(nombre: string, bytes: number, tipo: string): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

describe("CapturaFoto", () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    URL.createObjectURL = vi.fn(() => "blob:prueba");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it("con cámara ofrece «Tomar foto» y «Subir foto» y abre la vista en vivo al pulsar", async () => {
    simularMedios({ camaras: 2 });
    const usuario = userEvent.setup();
    render(<CapturaFoto onChange={vi.fn()} />);
    const tomar = await screen.findByRole("button", { name: /tomar foto/i });
    expect(screen.getByRole("button", { name: /subir foto/i })).toBeInTheDocument();
    // No se abre sola: la cámara se pide con una acción explícita del usuario.
    expect(screen.queryByLabelText(/vista en vivo/i)).not.toBeInTheDocument();
    await usuario.click(tomar);
    expect(await screen.findByLabelText(/vista en vivo/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /cambiar cámara/i })).toBeInTheDocument();
  });

  it("sin cámara avisa y deja la vía de subida disponible", async () => {
    simularMedios({ camaras: 0 });
    render(<CapturaFoto onChange={vi.fn()} />);
    expect(await screen.findByText(/no se encontró ninguna cámara/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tomar foto/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/archivo jpg o png/i)).toBeInTheDocument();
  });

  it("muestra la caja centrada con el texto exacto y acepta arrastrar y soltar", async () => {
    simularMedios({ camaras: 0 });
    render(<CapturaFoto onChange={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: /seleccionar una foto para subir/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/haz clic aquí para seleccionar foto/i)).toBeInTheDocument();
    expect(screen.getByText(/png, jpg hasta 5mb/i)).toBeInTheDocument();
    expect(screen.getByText(/arrastra y suelta la imagen/i)).toBeInTheDocument();
  });

  it("en contexto no seguro avisa y no bloquea la subida", async () => {
    simularMedios({ camaras: 1, seguro: false });
    render(<CapturaFoto onChange={vi.fn()} />);
    expect(await screen.findByText(/conexión segura/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/archivo jpg o png/i)).toBeInTheDocument();
  });

  it("si se niega el permiso muestra el motivo real, sin saltar a «Subir foto»", async () => {
    simularMedios({
      camaras: 1,
      getUserMedia: () => Promise.reject(new DOMException("denegado", "NotAllowedError")),
    });
    const usuario = userEvent.setup();
    render(<CapturaFoto onChange={vi.fn()} />);
    await usuario.click(await screen.findByRole("button", { name: /tomar foto/i }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/no permitió el acceso a la cámara/i);
    expect(screen.getByRole("button", { name: /reintentar cámara/i })).toBeInTheDocument();
    // El respaldo sigue disponible, pero no se cambia de modo por su cuenta.
    await usuario.click(screen.getByRole("button", { name: /subir foto/i }));
    expect(await screen.findByLabelText(/archivo jpg o png/i)).toBeInTheDocument();
  });

  it("distingue la cámara inexistente de un permiso denegado", async () => {
    simularMedios({
      camaras: 1,
      getUserMedia: () => Promise.reject(new DOMException("sin cámara", "NotFoundError")),
    });
    const usuario = userEvent.setup();
    render(<CapturaFoto onChange={vi.fn()} />);
    await usuario.click(await screen.findByRole("button", { name: /tomar foto/i }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/no se encontró ninguna cámara/i);
    expect(alerta).not.toHaveTextContent(/permiso/i);
  });

  it("entrega el archivo válido con origen ARCHIVO y permite repetir", async () => {
    simularMedios({ camaras: 0 });
    const alCambiar = vi.fn();
    const usuario = userEvent.setup();
    render(<CapturaFoto onChange={alCambiar} />);
    const entrada = await screen.findByLabelText(/archivo jpg o png/i);
    const foto = archivo("yo.png", 2048, "image/png");
    await usuario.upload(entrada, foto);
    expect(alCambiar).toHaveBeenCalledWith(foto, "ARCHIVO");
    expect(screen.getByAltText(/vista previa/i)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /repetir foto/i }));
    expect(alCambiar).toHaveBeenLastCalledWith(null, null);
  });

  it("rechaza un archivo de tipo inválido sin llamar al padre", async () => {
    simularMedios({ camaras: 0 });
    const alCambiar = vi.fn();
    const usuario = userEvent.setup({ applyAccept: false });
    render(<CapturaFoto onChange={alCambiar} />);
    const entrada = await screen.findByLabelText(/archivo jpg o png/i);
    await usuario.upload(entrada, archivo("doc.pdf", 100, "application/pdf"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/jpg o png/i);
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("rechaza una foto de más de 5 MB", async () => {
    simularMedios({ camaras: 0 });
    const alCambiar = vi.fn();
    const usuario = userEvent.setup();
    render(<CapturaFoto onChange={alCambiar} />);
    const entrada = await screen.findByLabelText(/archivo jpg o png/i);
    await usuario.upload(entrada, archivo("grande.jpg", 6 * 1024 * 1024, "image/jpeg"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/5 MB/);
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("libera la cámara al desmontar", async () => {
    const { stop } = simularMedios({ camaras: 1 });
    const usuario = userEvent.setup();
    const { unmount } = render(<CapturaFoto onChange={vi.fn()} />);
    await usuario.click(await screen.findByRole("button", { name: /tomar foto/i }));
    await screen.findByLabelText(/vista en vivo/i);
    unmount();
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });
});
