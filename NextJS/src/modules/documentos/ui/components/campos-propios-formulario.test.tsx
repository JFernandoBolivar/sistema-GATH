import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CamposPropiosFormulario } from "./campos-propios-formulario";
import type { CampoPropioDTO } from "../../domain/lib/documentos-expediente";

const campos: CampoPropioDTO[] = [
  { clave: "sueldo", etiqueta: "Sueldo al que aspira", tipo: "texto", obligatorio: true, ayuda: "En USD", opciones: [] },
  { clave: "notas", etiqueta: "Notas", tipo: "texto_largo", obligatorio: false, ayuda: "", opciones: [] },
  { clave: "inicio", etiqueta: "Fecha de inicio", tipo: "fecha", obligatorio: false, ayuda: "", opciones: [] },
  { clave: "traslado", etiqueta: "Acepta traslados", tipo: "si_no", obligatorio: false, ayuda: "", opciones: [] },
  { clave: "turno", etiqueta: "Turno", tipo: "opcion", obligatorio: false, ayuda: "", opciones: ["DIURNO", "NOCTURNO"] },
];

function montar(extra: Partial<Parameters<typeof CamposPropiosFormulario>[0]> = {}) {
  const onCambio = vi.fn();
  render(<CamposPropiosFormulario idBase="d" campos={campos} controles={{}} onCambio={onCambio} {...extra} />);
  return onCambio;
}

describe("CamposPropiosFormulario", () => {
  it("dibuja un control por cada tipo de campo", () => {
    montar();
    expect(screen.getByLabelText(/Sueldo al que aspira/).tagName).toBe("INPUT");
    expect(screen.getByLabelText("Notas").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Fecha de inicio")).toHaveAttribute("type", "date");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("marca el obligatorio y muestra la ayuda", () => {
    montar();
    expect(screen.getByText("(obligatorio)")).toBeInTheDocument();
    expect(screen.getByText("En USD")).toBeInTheDocument();
  });

  it("avisa de cada cambio con la clave del campo", () => {
    const onCambio = montar();
    fireEvent.change(screen.getByLabelText(/Sueldo al que aspira/), { target: { value: "1500" } });
    expect(onCambio).toHaveBeenCalledWith("sueldo", "1500");
    fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2026-12-01" } });
    expect(onCambio).toHaveBeenCalledWith("inicio", "2026-12-01");
    fireEvent.click(screen.getByRole("radio", { name: "Sí" }));
    expect(onCambio).toHaveBeenCalledWith("traslado", "SI");
  });

  it("muestra el error de un campo asociado a su control", () => {
    montar({ errores: { sueldo: "«Sueldo» es obligatorio." } });
    expect(screen.getByRole("alert")).toHaveTextContent("es obligatorio");
    expect(screen.getByLabelText(/Sueldo al que aspira/)).toHaveAttribute("aria-invalid", "true");
  });

  it("deshabilitado bloquea los controles", () => {
    montar({ deshabilitado: true });
    expect(screen.getByLabelText(/Sueldo al que aspira/)).toBeDisabled();
  });
});
