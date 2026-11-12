import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ElementoBiblioteca } from "../../../domain/entities/carnet";
import type { ElementoKonva } from "../../../domain/entities/disenador";
import { DisenadorQrEstilo } from "./disenador-qr-estilo";

const qr: ElementoKonva = {
  id: "qr1", t: "qr", name: "Código QR", cara: "anverso", x: 1, y: 1, w: 22, h: 22, r: 0,
  fill: "#000000", stroke: "", sw: 0, rad: 0, shadow: 0, op: 100,
};

function medio(id: string, nombre: string, categoria: ElementoBiblioteca["categoria"]): ElementoBiblioteca {
  return {
    id, nombre, categoria, archivo_url: `/api/v1/carnetizacion/biblioteca/${id}/archivo/`,
    tamano_bytes: 1, mime_type: "image/png", ancho_px: 10, alto_px: 10, creado: "2026-01-01",
  };
}

describe("DisenadorQrEstilo", () => {
  it("elegir un preset actualiza props.qr_estilo del elemento", () => {
    const onActualizar = vi.fn();
    render(<DisenadorQrEstilo elemento={qr} onActualizarElemento={onActualizar} />);
    fireEvent.click(screen.getByRole("button", { name: "Estilo Degradado" }));
    expect(onActualizar).toHaveBeenCalledWith(
      "qr1",
      expect.objectContaining({
        qr_estilo: expect.objectContaining({ preset: "degradado", color_modulos_2: "#1B2A4A" }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Estilo Clásico" }));
    expect(onActualizar).toHaveBeenLastCalledWith(
      "qr1",
      expect.objectContaining({ qr_estilo: expect.objectContaining({ preset: "clasico", forma_modulos: "cuadrado" }) }),
    );
  });

  it("el selector de logo lista solo los medios de la categoría Logos y elige uno", () => {
    const onActualizar = vi.fn();
    render(
      <DisenadorQrEstilo
        elemento={qr}
        onActualizarElemento={onActualizar}
        mediosBiblioteca={[
          medio("l1", "Logo sede", "logo"),
          medio("f1", "Firma presidente", "firma"),
          medio("i1", "Foto edificio", "imagen"),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Logo Logo sede" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Firma presidente/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Foto edificio/ })).toBeNull();
    expect(screen.getByText("CONATEL")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Logo Logo sede" }));
    expect(onActualizar).toHaveBeenCalledWith(
      "qr1",
      expect.objectContaining({ qr_estilo: expect.objectContaining({ logo: expect.objectContaining({ medio_id: "l1" }) }) }),
    );
  });
});
