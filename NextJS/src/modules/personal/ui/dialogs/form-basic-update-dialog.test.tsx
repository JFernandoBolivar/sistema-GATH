import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../infrastructure/actions/personal-actions", () => ({
  actualizarEmpleadoAction: vi.fn(),
  subirFotoEmpleadoAction: vi.fn(),
}));

const verificar = vi.hoisted(() => vi.fn());
vi.mock("../../infrastructure/actions/correccion-cedula-actions", () => ({
  verificarCorreccionCedulaAction: verificar,
  ejecutarCorreccionCedulaAction: vi.fn(),
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

describe("FormBasicUpdateDialog: corrección de cédula (personal.corregir_cedula)", () => {
  const previa = {
    trabajador: { cedulaActual: "99000302", nombre: "AUDITORIA E2E", condicion: "ACTIVO" },
    cedulaNueva: "99000303",
    cuenta: { existe: true, correo: "a@b.com", claveInicialPendiente: true },
    afectados: [{ tabla: "Asignación de cargo", registros: 1 }],
    totalRegistros: 1,
  };

  it("con el permiso, la cédula es editable y el cambio abre la confirmación con los afectados", async () => {
    verificar.mockResolvedValue(previa);
    render(
      <FormBasicUpdateDialog
        empleado={{ ...empleado, estadoCivilId: 1, nombres: "JUAN" } as EmpleadoDTO}
        catalogos={null}
        onGuardado={vi.fn()}
        puedeCorregirCedula
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Actualizar Informaci/i }));
    const campo = screen.getByLabelText("Cédula");
    fireEvent.change(campo, { target: { value: "99000303" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));

    expect(await screen.findByTestId("tabla-afectados")).toHaveTextContent("Asignación de cargo");
    expect(screen.getByText(/Se cerrarán sus sesiones abiertas/)).toBeInTheDocument();
    expect(screen.getByText(/Ver detalle/)).toBeInTheDocument();
    const boton = screen.getByRole("button", { name: /Corregir cédula y guardar/ });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Error de transcripción" } });
    fireEvent.change(screen.getByLabelText(/Escriba la cédula nueva/), { target: { value: "99000303" } });
    expect(boton).toBeEnabled();
  });

  it("un 409 muestra el mensaje y no abre la confirmación", async () => {
    verificar.mockResolvedValue({ error: "La cédula nueva ya existe.", status: 409 });
    render(
      <FormBasicUpdateDialog
        empleado={{ ...empleado, estadoCivilId: 1, nombres: "JUAN" } as EmpleadoDTO}
        catalogos={null}
        onGuardado={vi.fn()}
        puedeCorregirCedula
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Actualizar Informaci/i }));
    const campo = screen.getByLabelText("Cédula");
    fireEvent.change(campo, { target: { value: "99000303" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    expect(await screen.findByText("La cédula nueva ya existe.")).toBeInTheDocument();
    expect(screen.queryByTestId("tabla-afectados")).toBeNull();
  });
});

describe("FormBasicUpdateDialog: nacionalidad (personal.editar_nacionalidad)", () => {
  const catalogos = {
    nacionalidades: [
      { id: 1, codigo: "V", nombre: "Venezolana" },
      { id: 2, codigo: "E", nombre: "Extranjera" },
    ],
  } as unknown as Parameters<typeof FormBasicUpdateDialog>[0]["catalogos"];

  async function abrir(permiso: boolean) {
    render(
      <FormBasicUpdateDialog
        empleado={{ ...empleado, estadoCivilId: 1, nombres: "JUAN" } as EmpleadoDTO}
        catalogos={catalogos}
        onGuardado={vi.fn()}
        puedeEditarNacionalidad={permiso}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Actualizar Informaci/i }));
  }

  it("sin el permiso el select está deshabilitado, con el valor visible y la ayuda", async () => {
    await abrir(false);
    const select = screen.getByRole("combobox", { name: /Nacionalidad/i });
    expect(select).toBeDisabled();
    expect(select).toHaveTextContent("V - Venezolana");
    expect(screen.getByText("Requiere permiso para modificar la nacionalidad")).toBeInTheDocument();
  });

  it("con el permiso el select está habilitado y sin ayuda", async () => {
    await abrir(true);
    expect(screen.getByRole("combobox", { name: /Nacionalidad/i })).toBeEnabled();
    expect(screen.queryByText("Requiere permiso para modificar la nacionalidad")).toBeNull();
  });
});
