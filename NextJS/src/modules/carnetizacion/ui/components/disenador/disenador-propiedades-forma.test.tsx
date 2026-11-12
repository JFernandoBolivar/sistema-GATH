import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ElementoKonva } from "../../../domain/entities/disenador";
import { CodigoSvgAvanzado, DisenadorPropiedadesForma } from "./disenador-propiedades-forma";

const forma: ElementoKonva = {
  id: "f1", t: "path", name: "Forma", cara: "anverso", x: 0, y: 0, w: 30, h: 30, r: 0,
  fill: "rule:primario", stroke: "", sw: 0, rad: 0, shadow: 0, op: 100,
  path: "M 0 100 C 0 32 32 0 100 0 V 100 Z",
};

describe("Código SVG avanzado", () => {
  it("un path inválido no se aplica y muestra el error", () => {
    const onActualizar = vi.fn();
    render(<CodigoSvgAvanzado elemento={forma} onActualizarElemento={onActualizar} />);
    const caja = screen.getByLabelText(/Código SVG de la forma/);
    fireEvent.change(caja, { target: { value: "M 0 100 C 0 32 32 0 100 0 V 100 y" } });
    expect(onActualizar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe('Instrucción no válida: "y"');
    expect(caja.getAttribute("aria-invalid")).toBe("true");
  });

  it("un path válido sí se aplica", () => {
    const onActualizar = vi.fn();
    render(<CodigoSvgAvanzado elemento={forma} onActualizarElemento={onActualizar} />);
    fireEvent.change(screen.getByLabelText(/Código SVG de la forma/), {
      target: { value: "M 0 0 H 100 V 100 Z" },
    });
    expect(onActualizar).toHaveBeenCalledWith("f1", { path: "M 0 0 H 100 V 100 Z" });
  });

  it("con puntos el código es de solo lectura", () => {
    const conPuntos: ElementoKonva = {
      ...forma,
      puntos: [
        { x: 0, y: 0, r: 0 },
        { x: 100, y: 0, r: 0 },
        { x: 0, y: 100, r: 0 },
      ],
    };
    render(<CodigoSvgAvanzado elemento={conPuntos} onActualizarElemento={vi.fn()} />);
    const caja = screen.getByLabelText(/Código SVG de la forma/) as HTMLTextAreaElement;
    expect(caja.readOnly).toBe(true);
    expect(caja.value).toBe("M 0 0 L 100 0 L 0 100 Z");
  });
});

describe("DisenadorPropiedadesForma", () => {
  it("muestra el botón «Editar puntos» y lo lanza", () => {
    const onEditar = vi.fn();
    render(
      <DisenadorPropiedadesForma
        elemento={forma}
        onActualizarElemento={vi.fn()}
        control={{
          edicionPuntos: null,
          onEditarPuntos: onEditar,
          onTerminarEdicion: vi.fn(),
          onCambiarRadioPunto: vi.fn(),
          onEliminarPunto: vi.fn(),
          onConvertirAPathLibre: vi.fn(),
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Editar puntos/ }));
    expect(onEditar).toHaveBeenCalledWith("f1");
  });

  it("en un rectángulo, desbloquear el candado permite un radio por esquina", () => {
    const onActualizar = vi.fn();
    const rect: ElementoKonva = { ...forma, t: "rect", path: undefined, rad: 2 };
    render(<DisenadorPropiedadesForma elemento={rect} onActualizarElemento={onActualizar} />);
    fireEvent.click(screen.getByRole("button", { name: /Desbloquear/ }));
    // Orden: sup. izquierda, sup. derecha, inf. derecha, inf. izquierda
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "6" } });
    expect(onActualizar).toHaveBeenLastCalledWith("f1", { radios: [2, 6, 2, 2], rad: 2 });
  });
});
