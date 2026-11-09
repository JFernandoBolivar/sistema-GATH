import { describe, expect, it, vi } from "vitest";

const redirecciones = vi.hoisted(() => ({ redirigir: vi.fn((destino: string) => { throw new Error(destino); }) }));
vi.mock("next/navigation", () => ({ redirect: redirecciones.redirigir }));

import UsersModificarPage from "../../../app/(app)/usuarios/modificar/page";
import RolRegistrarPage from "../../../app/(app)/usuarios/roles/registrar/page";
import MatrizRoute from "../../../app/(app)/usuarios/matriz/page";

describe("O30: redirecciones de las rutas viejas", () => {
  it.each([
    ["/usuarios/modificar", () => UsersModificarPage()],
    ["/usuarios/roles/registrar", () => RolRegistrarPage()],
    ["/usuarios/matriz", () => MatrizRoute()],
  ])("%s redirige a la nueva ubicación", (ruta, ejecutar) => {
    expect(ejecutar).toThrow();
    expect(redirecciones.redirigir).toHaveBeenLastCalledWith(
      ruta === "/usuarios/matriz" ? "/usuarios/roles?tab=matriz" : ruta === "/usuarios/modificar" ? "/usuarios" : "/usuarios/roles",
    );
  });
});
