import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MiExpedienteDTO } from "@/modules/autogestion/application/dtos/mi-expediente-dto";
import { PasoContacto } from "./paso-contacto";

const ficha = {
  empleado: { cedula: "3333333", nombre_completo: "Ana Pérez", asignaciones: [] },
} as unknown as MiExpedienteDTO;

function montar(
  telefonoMovil = "",
  opciones: { correoAlternativo?: string; permiteSinCorreo?: boolean } = {},
) {
  const onContinuar = vi.fn();
  render(
    <PasoContacto
      ficha={ficha}
      valoresIniciales={{
        telefonoMovil,
        correoAlternativo: opciones.correoAlternativo ?? "ana@correo.test",
        tieneHijos: "no",
      }}
      guardando={false}
      permiteSinCorreo={opciones.permiteSinCorreo}
      onContinuar={onContinuar}
    />,
  );
  return { onContinuar, usuario: userEvent.setup() };
}

describe("PasoContacto: teléfono celular", () => {
  beforeAll(() => {
    // cmdk (lista de códigos) necesita estas APIs del navegador, que jsdom no trae.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("con un valor compuesto válido continúa sin error", async () => {
    const { onContinuar, usuario } = montar("+584147574312");
    await usuario.click(screen.getByRole("button", { name: /continuar/i }));
    await waitFor(() => expect(onContinuar).toHaveBeenCalledTimes(1));
    expect(onContinuar.mock.calls[0][0].telefonoMovil).toBe("+584147574312");
    expect(screen.queryByText("El teléfono celular es obligatorio")).toBeNull();
  });

  it("vacío muestra el mensaje de obligatorio", async () => {
    const { onContinuar, usuario } = montar("");
    await usuario.click(screen.getByRole("button", { name: /continuar/i }));
    expect(await screen.findByText("El teléfono celular es obligatorio")).toBeInTheDocument();
    expect(onContinuar).not.toHaveBeenCalled();
  });

  it("un formato inválido muestra el mensaje de formato", async () => {
    const { onContinuar, usuario } = montar("+58414123");
    await usuario.click(screen.getByRole("button", { name: /continuar/i }));
    expect(await screen.findByText(/Número venezolano inválido/)).toBeInTheDocument();
    expect(onContinuar).not.toHaveBeenCalled();
  });

  it("al elegir el código 0414 y escribir 7574312 pasa", async () => {
    const { onContinuar, usuario } = montar("");
    await usuario.click(screen.getByRole("button", { name: /continuar/i }));
    expect(await screen.findByText("El teléfono celular es obligatorio")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Código de operadora" }));
    await usuario.click(await screen.findByText("0414"));
    await usuario.type(screen.getByLabelText(/Teléfono celular/), "7574312");
    await waitFor(() =>
      expect(screen.queryByText("El teléfono celular es obligatorio")).toBeNull(),
    );
    await usuario.click(screen.getByRole("button", { name: /continuar/i }));
    await waitFor(() => expect(onContinuar).toHaveBeenCalledTimes(1));
    expect(onContinuar.mock.calls[0][0].telefonoMovil).toBe("+584147574312");
  }, 30000);

  it("sin correo alternativo no continúa (O39)", async () => {
    const { onContinuar, usuario } = montar("+584147574312", { correoAlternativo: "" });
    await usuario.click(screen.getByRole("button", { name: /continuar/i }));
    expect(
      await screen.findByText("El correo alternativo es obligatorio para la fe de vida."),
    ).toBeInTheDocument();
    expect(onContinuar).not.toHaveBeenCalled();
  });

  it("en línea permite «No tiene correo» con justificación (U1)", async () => {
    const { onContinuar, usuario } = montar("+584147574312", {
      correoAlternativo: "",
      permiteSinCorreo: true,
    });
    fireEvent.click(screen.getByLabelText("No tiene correo"));
    fireEvent.change(screen.getByLabelText(/Justificación/), {
      target: { value: "El pasivo no posee correo electrónico ni familiar de contacto." },
    });
    await usuario.click(screen.getByRole("button", { name: /continuar/i }));
    await waitFor(() => expect(onContinuar).toHaveBeenCalledTimes(1));
    expect(onContinuar.mock.calls[0][1]).toEqual({
      sinCorreoAlternativo: true,
      justificacionSinCorreo: "El pasivo no posee correo electrónico ni familiar de contacto.",
    });
  }, 30000);

  it("en línea no continúa con «No tiene correo» y justificación corta (U1)", async () => {
    const { onContinuar, usuario } = montar("+584147574312", {
      correoAlternativo: "",
      permiteSinCorreo: true,
    });
    fireEvent.click(screen.getByLabelText("No tiene correo"));
    fireEvent.change(screen.getByLabelText(/Justificación/), { target: { value: "corto" } });
    await usuario.click(screen.getByRole("button", { name: /continuar/i }));
    expect(await screen.findByText(/al menos 10 caracteres/i)).toBeInTheDocument();
    expect(onContinuar).not.toHaveBeenCalled();
  }, 30000);
});
