import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const mockGetRolesAction = vi.fn();
const mockRegistrarUsuarioAction = vi.fn();
const mockListarUsuariosAction = vi.fn();
const mockGetEmpleadoPorCedulaAction = vi.fn();

vi.mock("../infrastructure/actions/usuario-actions", () => ({
  getRolesAction: () => mockGetRolesAction(),
  registrarUsuarioAction: (input: unknown) => mockRegistrarUsuarioAction(input),
  listarUsuariosAction: (filtros: unknown) => mockListarUsuariosAction(filtros),
}));

vi.mock("@/modules/personal/infrastructure/actions/personal-actions", () => ({
  getEmpleadoPorCedulaAction: (cedula: string) => mockGetEmpleadoPorCedulaAction(cedula),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import UsuarioRegistrarPage from "./usuario-registrar-page";

describe("UsuarioRegistrarPage (O17 y FIX-QA7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRolesAction.mockResolvedValue([
      { id: 1, nombreRol: "ANALISTA", descripcionRol: "Rol de analista" },
      { id: 2, nombreRol: "ADMINISTRADOR", descripcionRol: "Rol administrador" },
    ]);
    mockRegistrarUsuarioAction.mockResolvedValue({
      id: 42,
      cedula: "12345678",
      rolId: null,
    });
    mockListarUsuariosAction.mockResolvedValue({
      resultados: [],
      total: 0,
      pagina: 1,
      tamano: 10,
      totalPaginas: 0,
    });
    mockGetEmpleadoPorCedulaAction.mockImplementation((cedula: string) => {
      if (cedula === "12345678" || cedula === "87654321") {
        return Promise.resolve({
          id: 101,
          cedula,
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
  });

  it("estado inicial: no muestra rol ni botón de registro antes de consultar la cédula", () => {
    render(<UsuarioRegistrarPage />);

    // No debe existir el campo de contraseña
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull();

    // Texto de ayuda normativo O17
    expect(
      screen.getByText(
        /Normalmente las cuentas se crean solas; use esta opción para casos puntuales. La contraseña inicial es la cédula y se pedirá cambiarla al entrar./i,
      ),
    ).toBeInTheDocument();

    // Mensaje de estado inicial
    expect(
      screen.getByText(/Ingrese la cédula del trabajador para validar su existencia y registrar su cuenta./i),
    ).toBeInTheDocument();

    // Ni el rol ni el botón de registro deben estar visibles en el estado inicial
    expect(screen.queryByLabelText(/rol del sistema/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /registrar usuario/i })).toBeNull();
  });

  it("estado 1 (buscando…): muestra indicador de carga mientras valida y oculta rol y botón", async () => {
    const user = userEvent.setup();
    render(<UsuarioRegistrarPage />);

    const inputCedula = screen.getByLabelText(/cédula del trabajador/i);
    await user.type(inputCedula, "12345678");

    // Indicador buscando visible inmediatamente tras ingresar cédula
    expect(
      screen.getByText(/Buscando datos del trabajador y verificando cuentas en el sistema.../i),
    ).toBeInTheDocument();

    // Rol y botón de registro no deben mostrarse durante la búsqueda
    expect(screen.queryByLabelText(/rol del sistema/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /registrar usuario/i })).toBeNull();

    // Esperar a que la búsqueda asíncrona concluya normalmente
    await screen.findByText("Trabajador válido", {}, { timeout: 4000 });
  });

  it("estado 2 («No es un trabajador registrado en el sistema»): muestra alerta sin acciones ni botón registrar", async () => {
    const user = userEvent.setup();
    render(<UsuarioRegistrarPage />);

    const inputCedula = screen.getByLabelText(/cédula del trabajador/i);
    await user.type(inputCedula, "99999999");

    // Alerta de no registrado
    const alertBox = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(within(alertBox).getByText(/No es un trabajador registrado en el sistema/i)).toBeInTheDocument();
    expect(within(alertBox).getByText(/No se encontró ningún expediente de personal activo ni egresado con esta cédula/i)).toBeInTheDocument();

    // Sin acciones: no hay select de rol ni botón de registro
    expect(screen.queryByLabelText(/rol del sistema/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /registrar usuario/i })).toBeNull();
  });

  it("estado 3 («Ya tiene una cuenta»): muestra rol actual, estado y enlace «Ver usuario» sin botón registrar", async () => {
    mockListarUsuariosAction.mockResolvedValueOnce({
      resultados: [
        {
          id: 55,
          cedula: "87654321",
          rolNombre: "ANALISTA DE BIENESTAR",
          isActive: true,
        },
      ],
      total: 1,
      pagina: 1,
      tamano: 10,
      totalPaginas: 1,
    });

    const user = userEvent.setup();
    render(<UsuarioRegistrarPage />);

    const inputCedula = screen.getByLabelText(/cédula del trabajador/i);
    await user.type(inputCedula, "87654321");

    // Alerta informativa: Ya tiene una cuenta
    const statusBox = await screen.findByRole("status", {}, { timeout: 4000 });
    expect(within(statusBox).getByText("Ya tiene una cuenta")).toBeInTheDocument();
    expect(within(statusBox).getByText("ANALISTA DE BIENESTAR")).toBeInTheDocument();
    expect(within(statusBox).getByText("Activo")).toBeInTheDocument();

    // Enlace a detalle del usuario existente
    const enlaceVer = within(statusBox).getByRole("link", { name: /ver usuario/i });
    expect(enlaceVer).toBeInTheDocument();
    expect(enlaceVer).toHaveAttribute("href", "/usuarios/55");

    // NO debe mostrar el botón registrar ni el select de rol
    expect(screen.queryByLabelText(/rol del sistema/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /registrar usuario/i })).toBeNull();
  });

  it("estado 4 («Trabajador válido»): muestra rol, correo y botón registrar y permite dar de alta", async () => {
    const user = userEvent.setup();
    render(<UsuarioRegistrarPage />);

    const inputCedula = screen.getByLabelText(/cédula del trabajador/i);
    await user.type(inputCedula, "12345678");

    // Indicador de trabajador válido
    expect(await screen.findByText("Trabajador válido", {}, { timeout: 4000 })).toBeInTheDocument();

    // Ficha resumida visible
    expect(screen.getByText("María Elena Rondón Pérez")).toBeInTheDocument();
    expect(screen.getByText("ANALISTA DE TELECOMUNICACIONES")).toBeInTheDocument();

    // Recién en este estado aparecen el rol y el botón de registro
    expect(screen.getByLabelText(/rol del sistema/i)).toBeInTheDocument();
    expect(screen.getByText(/Correo que se usará para el acceso/i)).toBeInTheDocument();

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
