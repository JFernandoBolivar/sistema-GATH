import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArchivoElegido, ZonaSubida } from "./zona-subida";

function montar(onArchivo = vi.fn(), disabled = false) {
  render(
    <ZonaSubida
      etiquetaZona="Archivo de prueba"
      etiquetaInput="Entrada de prueba"
      accept=".pdf"
      titulo="Haz clic aquí para seleccionar"
      detalle="PDF hasta 10 MB"
      disabled={disabled}
      onArchivo={onArchivo}
    />,
  );
  return onArchivo;
}

describe("ZonaSubida", () => {
  it("muestra título, formatos y ayuda de arrastre", () => {
    montar();
    expect(screen.getByText("Haz clic aquí para seleccionar")).toBeInTheDocument();
    expect(screen.getByText("PDF hasta 10 MB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archivo de prueba" })).toBeInTheDocument();
  });

  it("entrega el archivo elegido con el input", async () => {
    const onArchivo = montar();
    const archivo = new File(["x"], "a.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Entrada de prueba"), archivo);
    expect(onArchivo).toHaveBeenCalledWith(archivo);
  });

  it("entrega el archivo soltado y abre el selector con el teclado", () => {
    const onArchivo = montar();
    const zona = screen.getByRole("button", { name: "Archivo de prueba" });
    const archivo = new File(["x"], "b.pdf", { type: "application/pdf" });
    fireEvent.drop(zona, { dataTransfer: { files: [archivo] } });
    expect(onArchivo).toHaveBeenCalledWith(archivo);
    const clic = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    fireEvent.keyDown(zona, { key: "Enter" });
    expect(clic).toHaveBeenCalledTimes(1);
    clic.mockRestore();
  });

  it("deshabilitada no acepta archivos soltados", () => {
    const onArchivo = montar(vi.fn(), true);
    const zona = screen.getByRole("button", { name: "Archivo de prueba" });
    fireEvent.drop(zona, { dataTransfer: { files: [new File(["x"], "c.pdf")] } });
    expect(onArchivo).not.toHaveBeenCalled();
    expect(zona).toHaveAttribute("aria-disabled", "true");
  });
});

describe("ArchivoElegido", () => {
  it("muestra el nombre y permite quitarlo", async () => {
    const onQuitar = vi.fn();
    render(<ArchivoElegido nombre="cedula.pdf" detalle="12 KB" onQuitar={onQuitar} />);
    expect(screen.getByText("cedula.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /quitar el archivo cedula\.pdf/i }));
    expect(onQuitar).toHaveBeenCalledTimes(1);
  });
});
