import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        permisos: ["identidad.crear_usuarios"],
      },
    },
  }),
}));

const mockGetRolesAction = vi.fn().mockResolvedValue([
  { id: 1, nombreRol: "ANALISTA", descripcionRol: "Rol de analista" },
  { id: 2, nombreRol: "ADMINISTRADOR", descripcionRol: "Rol administrador" },
]);

const mockRegistrarUsuarioAction = vi.fn().mockResolvedValue({
  id: 42,
  cedula: "12345678",
  rolId: null,
});

vi.mock("../infrastructure/actions/usuario-actions", () => ({
  getRolesAction: () => mockGetRolesAction(),
  registrarUsuarioAction: (input: unknown) => mockRegistrarUsuarioAction(input),
}));

const mockGetEmpleadoPorCedulaAction = vi.fn().mockImplementation((cedula: string) => {
  if (cedula === "12345678") {
    return Promise.resolve({
      id: 101,
      cedula: "12345678",
      nombres: "María Elena",
      apellidos: "Rondón Pérez",
      nombreCompleto: "María Elena Rondón Pérez",
      correo: "maria.rondon@conatel.gob.ve",
      asignaciones: [
        {
          id: 1,
          denominacionCargo: "ANALISTA DE TELECOMUNICACIONES",
          tipoNomina: "EMPLEADO FIJO",
          direccionGeneral: "GERENCIA DE TELECOMUNICACIONES",
        },
      ],
    });
  }
  return Promise.resolve({ error: "Empleado no encontrado" });
});

vi.mock("@/modules/personal/infrastructure/actions/personal-actions", () => ({
  getEmpleadoPorCedulaAction: (cedula: string) => mockGetEmpleadoPorCedulaAction(cedula),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import UsuarioRegistrarPage from "./usuario-registrar-page";

describe("UsuarioRegistrarPage (O17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no muestra campo de contraseña y muestra el texto de ayuda normativo", async () => {
    render(<UsuarioRegistrarPage />);

    // No debe existir el campo de contraseña
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull();

    // Texto de ayuda normativo O17
    expect(
      screen.getByText(
        /Normalmente las cuentas se crean solas; use esta opción para casos puntuales. La contraseña inicial es la cédula y se pedirá cambiarla al entrar./i,
      ),
    ).toBeInTheDocument();

    // Debe mostrar la sección explicativa ¿Qué pasará al crear la cuenta?
    expect(screen.getByText(/¿Qué pasará al crear la cuenta\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Contraseña inicial:/i)).toBeInTheDocument();
    expect(screen.getByText(/Cambio obligatorio:/i)).toBeInTheDocument();
  });

  it("busca al trabajador al escribir la cédula y muestra su ficha resumida y correo de acceso", async () => {
    const user = userEvent.setup();
    render(<UsuarioRegistrarPage />);

    const inputCedula = screen.getByLabelText(/cédula del trabajador/i);
    await user.type(inputCedula, "12345678");

    await waitFor(() => {
      expect(mockGetEmpleadoPorCedulaAction).toHaveBeenCalledWith("12345678");
    });

    // Ficha resumida del trabajador
    expect(await screen.findByText("María Elena Rondón Pérez")).toBeInTheDocument();
    expect(screen.getByText("ANALISTA DE TELECOMUNICACIONES")).toBeInTheDocument();
    expect(screen.getByText("EMPLEADO FIJO")).toBeInTheDocument();
    expect(screen.getByText("GERENCIA DE TELECOMUNICACIONES")).toBeInTheDocument();

    // Correo de acceso detectado
    expect(screen.getAllByText("maria.rondon@conatel.gob.ve").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Registrado")).toBeInTheDocument();
  });

  it("permite registrar al usuario sin ingresar contraseña una vez ubicado el trabajador", async () => {
    const user = userEvent.setup();
    render(<UsuarioRegistrarPage />);

    const inputCedula = screen.getByLabelText(/cédula del trabajador/i);
    await user.type(inputCedula, "12345678");

    // Esperar a que culmine la búsqueda asíncrona
    expect(await screen.findByText("Trabajador encontrado")).toBeInTheDocument();

    const boton = screen.getByRole("button", { name: /registrar usuario/i });
    expect(boton).toBeEnabled();
    await user.click(boton);

    await waitFor(() => {
      expect(mockRegistrarUsuarioAction).toHaveBeenCalledWith({
        cedula: "12345678",
        rolId: null,
      });
      expect(mockPush).toHaveBeenCalledWith("/usuarios");
    });
  });
});
