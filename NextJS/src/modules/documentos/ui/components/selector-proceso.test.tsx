import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProcesoPlantilla } from "../../domain/entities/plantilla";
import { SelectorProceso } from "./selector-proceso";

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;

const procesos: ProcesoPlantilla[] = [
  {
    codigo: "ingreso_ventana2",
    etiqueta: "Ingreso por Ventana 2",
    descripcion: "Documentos que completa el postulante.",
    grupo: "ingreso",
    grupos_variables: ["Identificación"],
  },
  {
    codigo: "punto_cuenta:cambio_oficina",
    etiqueta: "Punto de Cuenta: cambio de oficina",
    descripcion: "Punto de cuenta por cambio de dependencia.",
    grupo: "punto_cuenta",
    grupos_variables: ["Identificación"],
  },
];

describe("SelectorProceso", () => {
  it("ofrece opciones agrupadas con etiqueta y descripción", async () => {
    const user = userEvent.setup();
    const onCambio = vi.fn();
    render(<SelectorProceso id="proceso" procesos={procesos} valor="" onCambio={onCambio} />);

    expect(screen.getByText("¿En qué proceso se usa?")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "¿En qué proceso se usa?" }));

    expect(await screen.findByText("Ingreso de personal")).toBeInTheDocument();
    expect(screen.getByText("Punto de cuenta")).toBeInTheDocument();
    const opcion = await screen.findByRole("option", {
      name: /Punto de Cuenta: cambio de oficina.*Punto de cuenta por cambio de dependencia/,
    });
    await user.click(opcion);
    expect(onCambio).toHaveBeenCalledWith("punto_cuenta:cambio_oficina");
  });

  it("muestra la descripción del proceso elegido bajo el control", () => {
    render(
      <SelectorProceso
        id="proceso"
        procesos={procesos}
        valor="ingreso_ventana2"
        onCambio={vi.fn()}
      />,
    );
    expect(screen.getByText(/Documentos que completa el postulante\./)).toHaveTextContent(
      "Solo se ofrecen las variables de este proceso",
    );
  });

  it("bloquea el selector cuando la plantilla ya está publicada", () => {
    render(
      <SelectorProceso
        id="proceso"
        procesos={procesos}
        valor="ingreso_ventana2"
        onCambio={vi.fn()}
        bloqueado
      />,
    );
    expect(screen.getByRole("combobox", { name: "¿En qué proceso se usa?" })).toBeDisabled();
    expect(screen.getByText(/El proceso queda fijo al publicar/)).toBeInTheDocument();
  });
});
