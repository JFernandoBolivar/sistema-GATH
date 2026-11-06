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

    expect(await screen.findByRole("button", { name: /guardar cambios \(0\)/i })).toBeDisabled();

    const interruptor = screen.getByLabelText("Registrar personal para ADMIN_BIENESTAR");
    await waitFor(() => expect(interruptor).toBeEnabled());
    await usuario.click(interruptor);

    expect(await screen.findByRole("button", { name: /guardar cambios \(1\)/i })).toBeEnabled();
  });

  it("filtra permisos por código", async () => {
    const usuario = userEvent.setup();
    render(<MatrizPermisosPage />);

    const buscador = await screen.findByLabelText(/buscar permiso/i);
    await usuario.type(buscador, "crear");

    expect(screen.getByText("personal.crear")).toBeInTheDocument();
    expect(screen.queryByText("personal.ver")).not.toBeInTheDocument();
  });

  it("filtra la matriz para ver solo un rol", async () => {
    const usuario = userEvent.setup();
    render(<MatrizPermisosPage />);
    await usuario.click(await screen.findByRole("button", { name: /comparar roles/i }));
    await screen.findByText(/2 roles/);
    await usuario.selectOptions(screen.getByLabelText(/ver solo un rol/i), "2");
    expect(await screen.findByText(/1 roles/)).toBeInTheDocument();
  });

  it("en vista móvil ofrece selector de rol accesible arriba y lista de permisos debajo (TLF-F)", async () => {
    render(<MatrizPermisosPage />);
    const selectMovil = await screen.findByLabelText(/^rol$/i);
    expect(selectMovil).toBeInTheDocument();
    expect(selectMovil.tagName.toLowerCase()).toBe("select");
    expect(screen.getByText("Personal activo")).toBeInTheDocument();
  });
});
