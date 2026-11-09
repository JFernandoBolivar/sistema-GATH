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
  getRolesAction: vi.fn().mockResolvedValue([{ id: 2, nombreRol: "ANALISTA", nombreVisible: "Analista" }]),
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

import UsuarioDetallePage, { inicialesDe } from "./usuario-detalle-page";

describe("inicialesDe (O38)", () => {
  it("usa la inicial del nombre y del apellido", () => {
    expect(inicialesDe("Carlos", "Gómez")).toBe("CG");
    expect(inicialesDe("ana", "pérez")).toBe("AP");
    expect(inicialesDe("", "")).toBe("?");
  });
});

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
    expect(screen.getAllByText("Ver cargos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Concedido")).toBeInTheDocument();

    // 4. Excepción denegada (deny)
    expect(screen.getAllByText("Ver empleados").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Denegado")).toBeInTheDocument();

    // 5. Detalles de la excepción
    expect(screen.getAllByText("Aprobación de auditoría especial").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("admin_ti").length).toBeGreaterThanOrEqual(1);
  });
  it("O43: muestra el nombre visible del rol y de los permisos, sin mostrar nunca el código", async () => {
    mockObtenerDetalleUsuarioAction.mockResolvedValueOnce({
      ...mockUsuarioConExcepciones,
      rolNombre: "ANALISTA_BIENESTAR",
      rolNombreVisible: "Analista de Bienestar",
      permisos: {
        ...mockUsuarioConExcepciones.permisos,
        rolNombre: "ANALISTA_BIENESTAR",
        rolNombreVisible: "Analista de Bienestar",
      },
    });

    render(<UsuarioDetallePage id={11} />);
    expect(await screen.findByText("Carlos Gómez")).toBeInTheDocument();

    expect(screen.getAllByText("Analista de Bienestar").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("ANALISTA_BIENESTAR")).toBeNull();
    // Permisos individuales: el nombre del catálogo encabeza la fila y el código queda debajo.
    expect((await screen.findAllByText("Ver cargos")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ver empleados").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("cargos.ver_cargos")).toBeNull();
    expect(screen.queryByText("personal.ver_empleados")).toBeNull();
  });
  it("O43: un permiso fuera del catálogo se muestra con un respaldo legible y los avisos están en español", async () => {
    mockObtenerDetalleUsuarioAction.mockResolvedValueOnce({
      ...mockUsuarioConExcepciones,
      permisos: { ...mockUsuarioConExcepciones.permisos, allow: ["cargos.asignar_titular"], deny: [] },
    });

    render(<UsuarioDetallePage id={11} />);
    expect(await screen.findByText("Carlos Gómez")).toBeInTheDocument();

    expect((await screen.findAllByText("Asignar titular")).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("cargos.asignar_titular")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Quitar Asignar titular de los permisos concedidos" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\((allow|deny)\)/)).toBeNull();
  });
});
