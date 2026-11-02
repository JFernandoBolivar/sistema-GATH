import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { matriz } = vi.hoisted(() => ({
  matriz: {
    filas: [
      { modulo: "personal", codigo: "personal.ver", nombre: "Consultar personal" },
      { modulo: "personal", codigo: "personal.crear", nombre: "Registrar personal" },
    ],
    roles: [
      { rolId: 1, nombre: "ADMIN_BIENESTAR", codigos: ["personal.ver"] },
      { rolId: 2, nombre: "JEFE_RRHH", codigos: [] },
    ],
  },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        permisos: ["identidad.ver_roles", "identidad.asignar_permisos"],
      },
    },
  }),
}));

vi.mock("../infrastructure/actions/usuario-actions", () => ({
  obtenerMatrizAction: vi.fn().mockResolvedValue(matriz),
  guardarMatrizAction: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MatrizPermisosPage from "./matriz-permisos-page";

describe("MatrizPermisosPage", () => {
  it("muestra nombres de rol legibles, buscador y permisos por módulo", async () => {
    render(<MatrizPermisosPage />);

    expect(await screen.findByText("Admin Bienestar")).toBeInTheDocument();
    expect(screen.getByText("Jefe RRHH")).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar permiso/i)).toBeInTheDocument();
    expect(screen.getByText("Personal activo")).toBeInTheDocument();
    expect(screen.getByText("personal.ver")).toBeInTheDocument();
  });

  it("habilita el guardado solo cuando hay cambios y los cuenta", async () => {
    const usuario = userEvent.setup();
    render(<MatrizPermisosPage />);

    const [guardarAdmin] = await screen.findAllByRole("button", { name: /sin cambios/i });
    expect(guardarAdmin).toBeDisabled();

    const checkbox = screen.getByLabelText("personal.crear para ADMIN_BIENESTAR");
    await waitFor(() => expect(checkbox).toBeEnabled());
    await usuario.click(checkbox);

    expect(await screen.findByRole("button", { name: /guardar \(1\)/i })).toBeEnabled();
  });

  it("filtra permisos por código", async () => {
    const usuario = userEvent.setup();
    render(<MatrizPermisosPage />);

    const buscador = await screen.findByLabelText(/buscar permiso/i);
    await usuario.type(buscador, "crear");

    expect(screen.getByText("personal.crear")).toBeInTheDocument();
    expect(screen.queryByText("personal.ver")).not.toBeInTheDocument();
  });
});
