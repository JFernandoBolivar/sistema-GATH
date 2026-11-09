import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../infrastructure/actions/personal-actions", () => ({
  actualizarEmpleadoAction: vi.fn(),
  subirFotoEmpleadoAction: vi.fn(),
}));

vi.mock("@/shared/components/captura-foto/captura-foto", () => ({
  CapturaFoto: () => <div data-testid="captura-foto" />,
}));

import type { EmpleadoDTO } from "../../application/dtos/empleado-dto";
import FormBasicUpdateDialog from "./form-basic-update-dialog";

const empleado = {
  id: 1,
  cedula: "99000302",
  nombres: "AUDITORIA E2E",
  apellidos: "AUTOGESTION",
  nombreCompleto: "AUDITORIA E2E AUTOGESTION",
  sexoId: 1,
  sexoNombre: "MASCULINO",
  correo: "e2e.autogestion@auditoria.local",
  correoAlternativo: null,
  telefonoMovil: "",
  telefonoHabitacion: "",
  fechaNacimiento: "1990-01-01",
  estadoCivilId: null,
  estadoCivilNombre: null,
  carnetPatria: "",
  carnetPatriaSerial: "",
  nacionalidadId: 1,
  nacionalidadCodigo: "V",
  nacionalidadNombre: "Venezolana",
} as unknown as EmpleadoDTO;

describe("FormBasicUpdateDialog — cédula inmutable (O49-BLOQUEO / PRUEBAS-USUARIO P8)", () => {
  it("muestra la cédula solo lectura en el encabezado y no tiene campo de edición de cédula", async () => {
    render(
      <FormBasicUpdateDialog empleado={empleado} catalogos={null} onGuardado={vi.fn()} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Actualizar Informaci/i }),
    );

    // Cédula se muestra en el encabezado del diálogo para identificar a la persona
    expect(screen.getByText(/Cédula 99000302/i)).toBeInTheDocument();

    // No existe campo de formulario / input editable o deshabilitado para cédula
    expect(screen.queryByLabelText(/Cédula/i)).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Cédula/i })).toBeNull();

    // Nombres y Apellidos sí están presentes
    expect(screen.getByLabelText(/Nombres/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Apellidos/i)).toBeInTheDocument();
  });
});
