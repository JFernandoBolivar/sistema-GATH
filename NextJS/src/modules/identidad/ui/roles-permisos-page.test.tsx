import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const roles = vi.hoisted(() => [
  { id: 1, nombreRol: "ADMIN", nombreVisible: "Administrador", descripcionRol: "", nUsuarios: 2, nPermisos: 5 },
  { id: 2, nombreRol: "ANALISTA", nombreVisible: "Analista", descripcionRol: "", nUsuarios: 4, nPermisos: 9 },
]);

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { permisos: ["identidad.ver_roles", "identidad.crear_roles"] } } }),
}));
vi.mock("../infrastructure/actions/usuario-actions", () => ({
  getRolesAction: vi.fn().mockResolvedValue(roles),
}));
vi.mock("./components/table-role", () => ({
  default: ({ roles: filas }: { roles: typeof roles }) => (
    <ul>
      {filas.map((rol) => (
        <li key={rol.id}>
          {rol.nombreRol} · {rol.nUsuarios} usuarios · {rol.nPermisos} permisos
        </li>
      ))}
    </ul>
  ),
}));
vi.mock("./matriz-permisos-page", () => ({
  default: ({ rolInicial }: { rolInicial?: number }) => (
    <p>Matriz filtrada por rol {rolInicial ?? "todos"}</p>
  ),
}));
vi.mock("./rol-dialog", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { RolesPermisosPage } from "./roles-permisos-page";

describe("RolesPermisosPage", () => {
  it("tiene pestañas Roles y Matriz y muestra usuarios/permisos por rol", async () => {
    render(<RolesPermisosPage />);
    expect(await screen.findByText(/ADMIN · 2 usuarios · 5 permisos/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Roles" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Matriz de permisos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nuevo rol/i })).toBeInTheDocument();
  });

  it("abre la matriz con el rol indicado por la URL", async () => {
    const usuario = userEvent.setup();
    render(<RolesPermisosPage pestanaInicial="matriz" rolInicial={2} />);
    expect(await screen.findByText("Matriz filtrada por rol 2")).toBeInTheDocument();
    await usuario.click(screen.getByRole("tab", { name: "Roles" }));
    expect(await screen.findByText(/ANALISTA · 4 usuarios/)).toBeInTheDocument();
  });
});
