import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cambioFake, detalleFake } from "../../domain/services/fixtures-solicitud";

const decidir = vi.fn();
vi.mock("../../infrastructure/actions/solicitudes-actions", () => ({
  decidirCambiosAction: (...args: unknown[]) => decidir(...args),
  listarCatalogoAction: vi.fn().mockResolvedValue({ ok: true, mensaje: "", datos: [] }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { VisorComparativo } from "./visor-comparativo";

const detalle = detalleFake({
  estado: "ENVIADA",
  version: 3,
  cambios: [
    cambioFake({ id: "a", campo: "telefono_movil" }),
    cambioFake({
      id: "b",
      campo: "telefono_habitacion",
      valorPropuesto: "0212-5555555",
      valorActual: null,
    }),
    cambioFake({
      id: "c",
      campo: "correo_alternativo",
      entidadDestino: "datos_complementarios",
      conflicto: true,
    }),
  ],
  soportes: [
    {
      id: "s1",
      seccion: "contacto",
      tipo: "CONSTANCIA",
      mimeReal: "application/pdf",
      tamanoBytes: 2048,
      nombreOriginal: "constancia.pdf",
      fecha: null,
      urlArchivo: "/api/v1/autogestion/soportes/s1/archivo/",
    },
  ],
});

async function decidirTodo(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole("button", { name: /aprobar todos/i }));
}

describe("VisorComparativo", () => {
  beforeEach(() => decidir.mockReset());

  it("muestra valor actual y propuesto campo por campo y los soportes", () => {
    render(<VisorComparativo detalle={detalle} puedeDecidir onDecidido={vi.fn()} />);
    expect(screen.getAllByText("Valor actual en la ficha")).toHaveLength(3);
    expect(screen.getByText("0212-5555555")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /constancia\.pdf/ })).toHaveAttribute(
      "href",
      "/api/v1/autogestion/soportes/s1/archivo/",
    );
    expect(screen.getByRole("note")).toHaveTextContent(/solo puede rechazarse/);
  });

  it("no deja aprobar un campo en conflicto", () => {
    render(<VisorComparativo detalle={detalle} puedeDecidir onDecidido={vi.fn()} />);
    const campo = screen.getByRole("region", { name: /correo alternativo/i });
    expect(within(campo).getByRole("button", { name: /aprobar/i })).toBeDisabled();
  });

  it("sin permiso o en solicitud propia no ofrece decidir y explica por qué", () => {
    render(
      <VisorComparativo
        detalle={detalle}
        puedeDecidir={false}
        motivoBloqueo="Es su propia solicitud: otra persona de Bienestar Social debe decidirla."
        onDecidido={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /revisar y confirmar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/propia solicitud/)).toBeInTheDocument();
  });

  it("exige decidir todos los campos y el motivo de cada rechazo", async () => {
    const usuario = userEvent.setup();
    render(<VisorComparativo detalle={detalle} puedeDecidir onDecidido={vi.fn()} />);
    await usuario.click(screen.getByRole("button", { name: /revisar y confirmar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Faltan 3 campos por decidir/);

    await decidirTodo(usuario);
    await usuario.click(screen.getByRole("button", { name: /revisar y confirmar/i }));
    // el campo en conflicto quedó rechazado con motivo automático; el resto aprobado: sin errores
    expect(await screen.findByText("¿Confirmar la decisión?")).toBeInTheDocument();
  });

  it("aprobación parcial: envía versión y decisiones al confirmar", async () => {
    decidir.mockResolvedValue({ ok: true, mensaje: "Decisión registrada.", datos: detalle });
    const alDecidir = vi.fn();
    const usuario = userEvent.setup();
    render(<VisorComparativo detalle={detalle} puedeDecidir onDecidido={alDecidir} />);
    await decidirTodo(usuario);
    await usuario.click(screen.getByRole("button", { name: /revisar y confirmar/i }));
    await usuario.click(await screen.findByRole("button", { name: /confirmar decisión/i }));
    expect(decidir).toHaveBeenCalledTimes(1);
    const [id, cuerpo] = decidir.mock.calls[0];
    expect(id).toBe(detalle.id);
    expect(cuerpo.decisiones).toEqual([
      { cambioId: "a", aprobado: true, motivo: "" },
      { cambioId: "b", aprobado: true, motivo: "" },
      { cambioId: "c", aprobado: false, motivo: "La ficha cambió después de la propuesta." },
    ]);
    expect(alDecidir).toHaveBeenCalled();
  });

  it("muestra el conflicto 409 del servidor con opción de recargar", async () => {
    decidir.mockResolvedValue({ ok: false, mensaje: "No puede decidir su propia solicitud." });
    const usuario = userEvent.setup();
    render(<VisorComparativo detalle={detalle} puedeDecidir onDecidido={vi.fn()} />);
    await decidirTodo(usuario);
    await usuario.click(screen.getByRole("button", { name: /revisar y confirmar/i }));
    await usuario.click(await screen.findByRole("button", { name: /confirmar decisión/i }));
    expect(await screen.findByText("No puede decidir su propia solicitud.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recargar la solicitud/i })).toBeInTheDocument();
  });

  it("rechazar todos pide el motivo de cada campo y el motivo general", async () => {
    const usuario = userEvent.setup();
    render(<VisorComparativo detalle={detalle} puedeDecidir onDecidido={vi.fn()} />);
    await usuario.click(screen.getByRole("button", { name: /rechazar todos/i }));
    expect(screen.getByLabelText(/motivo general del rechazo/i)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /revisar y confirmar/i }));
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/Indique el motivo del rechazo del campo/);
    expect(alerta).toHaveTextContent(/motivo general/);
    expect(decidir).not.toHaveBeenCalled();
  });
});
