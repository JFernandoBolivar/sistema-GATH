import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        permisos: [
          "identidad.ver_usuarios",
          "identidad.editar_usuarios",
          "identidad.desactivar_usuarios",
          "identidad.restablecer_acceso",
          "identidad.cambiar_correo_acceso",
          "identidad.gestionar_permisos_individuales",
        ],
      },
    },
  }),
}));

const mockUsuarioSinExcepciones = {
  id: 10,
  cedula: "12345678",
  nombres: "Carlos",
  apellidos: "Gómez",
  correo: "carlos.gomez@conatel.gob.ve",
  telefono: null,
  rolId: 2,
  rolNombre: "ANALISTA",
  isActive: true,
  ultimoAcceso: "2026-11-01T10:00:00Z",
  condicion: "ACTIVO",
  passwordInicialPendiente: false,
  permisos: {
    rolId: 2,
    rolNombre: "ANALISTA",
    delRol: ["identidad.ver_usuarios", "personal.ver_empleados"],
    allow: [],
    deny: [],
    efectivos: ["identidad.ver_usuarios", "personal.ver_empleados"],
    version: 3,
  },
};

const mockUsuarioConExcepciones = {
  ...mockUsuarioSinExcepciones,
  id: 11,
  permisos: {
    ...mockUsuarioSinExcepciones.permisos,
    allow: ["cargos.ver_cargos"],
    deny: ["personal.ver_empleados"],
    motivo: "Aprobación de auditoría especial",
    fechaActualizacion: "2026-11-04T12:00:00Z",
    asignadoPor: "admin_ti",
  },
};

const mockObtenerDetalleUsuarioAction = vi.fn();

vi.mock("../infrastructure/actions/usuario-actions", () => ({
  obtenerDetalleUsuarioAction: (id: number) => mockObtenerDetalleUsuarioAction(id),
  getRolesAction: vi.fn().mockResolvedValue([{ id: 2, nombreRol: "ANALISTA" }]),
  getPermisosAction: vi.fn().mockResolvedValue([
    { codigo: "cargos.ver_cargos", nombre: "Ver cargos", modulo: "cargos" },
    { codigo: "personal.ver_empleados", nombre: "Ver empleados", modulo: "personal" },
  ]),
  editarUsuarioAction: vi.fn(),
  cambiarEstadoUsuarioAction: vi.fn(),
  restablecerAccesoAction: vi.fn(),
  cambiarCorreoAccesoAction: vi.fn(),
  guardarOverridesAction: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import UsuarioDetallePage from "./usuario-detalle-page";

describe("UsuarioDetallePage (O18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("elimina el bloque «Permiso efectivo», muestra enlace a la matriz y mensaje «Sin permisos individuales» cuando no tiene excepciones", async () => {
    mockObtenerDetalleUsuarioAction.mockResolvedValueOnce(mockUsuarioSinExcepciones);

    render(<UsuarioDetallePage id={10} />);

    // Esperar a que cargue
    expect(await screen.findByText("Carlos Gómez")).toBeInTheDocument();

    // 1. Debe haber eliminado completamente el bloque «Permiso efectivo»
    expect(screen.queryByText(/Permiso efectivo/i)).toBeNull();

    // 2. Línea normativa: Rol: ANALISTA — ver permisos del rol en la Matriz →
    expect(screen.getByText(/ver permisos del rol en la Matriz →/i)).toBeInTheDocument();
    const linkMatriz = screen.getByRole("link", { name: /ver permisos del rol en la Matriz →/i });
    expect(linkMatriz).toHaveAttribute("href", "/usuarios/matriz?rolId=2");

    // 3. Al no tener excepciones individuales, muestra mensaje informativo normativo
    expect(
      screen.getByText(/Sin permisos individuales: usa solo los de su rol\./i),
    ).toBeInTheDocument();
  });

  it("muestra SOLO las excepciones individuales (concedidos y denegados) con motivo, fecha y quién lo asignó", async () => {
    mockObtenerDetalleUsuarioAction.mockResolvedValueOnce(mockUsuarioConExcepciones);

    render(<UsuarioDetallePage id={11} />);

    // Esperar a que cargue
    expect(await screen.findByText("Carlos Gómez")).toBeInTheDocument();

    // 1. No debe existir bloque de permiso efectivo
    expect(screen.queryByText(/Permiso efectivo/i)).toBeNull();

    // 2. No debe mostrar mensaje de sin permisos
    expect(screen.queryByText(/Sin permisos individuales: usa solo los de su rol\./i)).toBeNull();

    // 3. Excepción concedida (allow)
    expect(screen.getAllByText("cargos.ver_cargos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Concedido (allow)")).toBeInTheDocument();

    // 4. Excepción denegada (deny)
    expect(screen.getAllByText("personal.ver_empleados").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Denegado (deny)")).toBeInTheDocument();

    // 5. Detalles de la excepción
    expect(screen.getAllByText("Aprobación de auditoría especial").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("admin_ti").length).toBeGreaterThanOrEqual(1);
  });
});
