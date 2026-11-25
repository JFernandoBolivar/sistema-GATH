import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DialogoAprobacion } from "./dialogo-aprobacion";

describe("<DialogoAprobacion />", () => {
  it("exige la fecha y no confirma sin ella", async () => {
    const onConfirmar = vi.fn();
    render(<DialogoAprobacion onConfirmar={onConfirmar} onCancelar={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: /registrar aprobación/i }));
    expect(screen.getByText(/indique la fecha en que se firmó/i)).toBeInTheDocument();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("rechaza un archivo que no es PDF y confirma sin PDF con fecha válida", async () => {
    const onConfirmar = vi.fn();
    render(<DialogoAprobacion onConfirmar={onConfirmar} onCancelar={() => undefined} />);
    await userEvent.upload(screen.getByLabelText(/escaneado en pdf/i), new File(["x"], "a.txt", { type: "text/plain" }), { applyAccept: false });
    expect(screen.getByText(/debe ser un archivo pdf/i)).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText(/escaneado en pdf/i), new File(["%PDF-"], "a.pdf", { type: "application/pdf" }));
    expect(screen.queryByText(/debe ser un archivo pdf/i)).not.toBeInTheDocument();
    const fecha = screen.getByLabelText(/fecha de la firma/i) as HTMLInputElement;
    await userEvent.type(fecha, "2020-01-15");
    await userEvent.click(screen.getByRole("button", { name: /registrar aprobación/i }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect((onConfirmar.mock.calls[0][0] as FormData).get("fecha_firma")).toBe("2020-01-15");
  });
});
