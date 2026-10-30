import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import type { NotificacionDTO } from "../application/dtos/notificacion-dto";

const acciones = vi.hoisted(() => ({
  contarNoLeidasAction: vi.fn(),
  listarNotificacionesAction: vi.fn(),
  marcarLeidaAction: vi.fn(),
  marcarTodasLeidasAction: vi.fn(),
}));
vi.mock("../infrastructure/actions/notificaciones-actions", () => acciones);

const sesion = vi.hoisted(() => ({ permisos: ["notificaciones.ver_propias"] as string[] }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { permisos: sesion.permisos } } }),
}));

import { CampanaNotificaciones } from "./campana-notificaciones";
import BandejaNotificacionesPage from "./bandeja-notificaciones-page";

const n = (sobre: Partial<NotificacionDTO> = {}): NotificacionDTO => ({
  id: "11111111-1111-4111-8111-111111111111",
  tipo: "x.y",
  titulo: "Ventana habilitada",
  mensaje: "Puede actualizar sus datos",
  enlace: "/autogestion/solicitudes",
  leida: false,
  fechaLectura: null,
  creadaEn: "2026-10-29T15:00:00Z",
  ...sobre,
});

const pagina = (resultados: NotificacionDTO[]) => ({
  ok: true as const,
  mensaje: "",
  datos: { total: resultados.length, limite: 20, desplazamiento: 0, resultados },
});

function Envoltorio({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sesion.permisos = ["notificaciones.ver_propias"];
  acciones.contarNoLeidasAction.mockResolvedValue({ ok: true, mensaje: "", datos: 2 });
  acciones.listarNotificacionesAction.mockResolvedValue(pagina([n()]));
  acciones.marcarLeidaAction.mockResolvedValue({ ok: true, mensaje: "", datos: undefined });
  acciones.marcarTodasLeidasAction.mockResolvedValue({ ok: true, mensaje: "", datos: 2 });
});

describe("CampanaNotificaciones", () => {
  it("muestra el conteo en el nombre accesible del botón", async () => {
    render(<CampanaNotificaciones />, { wrapper: Envoltorio });
    expect(
      await screen.findByRole("button", { name: "Notificaciones: 2 notificaciones sin leer" }),
    ).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("2 notificaciones sin leer");
  });

  it("sin el permiso no se muestra ni se consulta nada", () => {
    sesion.permisos = ["autogestion.ver_propio"];
    const { container } = render(<CampanaNotificaciones />, { wrapper: Envoltorio });
    expect(container.innerHTML).toBe("");
    expect(acciones.contarNoLeidasAction).not.toHaveBeenCalled();
  });

  it("«Marcar todas como leídas» llama a la acción y refresca el conteo", async () => {
    const user = userEvent.setup();
    render(<CampanaNotificaciones />, { wrapper: Envoltorio });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    expect(await screen.findByText("Ventana habilitada")).toBeDefined();
    acciones.contarNoLeidasAction.mockResolvedValue({ ok: true, mensaje: "", datos: 0 });
    await user.click(screen.getByRole("button", { name: /Marcar todas como leídas/ }));
    await waitFor(() => expect(acciones.marcarTodasLeidasAction).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Notificaciones: Sin notificaciones nuevas" }),
      ).toBeDefined(),
    );
  });
});

describe("CampanaNotificaciones: modo de la bandeja", () => {
  it("modo página: «Ver todas» es un enlace a la bandeja de Autogestión", async () => {
    const user = userEvent.setup();
    render(<CampanaNotificaciones modoBandeja="pagina" />, { wrapper: Envoltorio });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    const enlace = await screen.findByRole("link", { name: "Ver todas las notificaciones" });
    expect(enlace.getAttribute("href")).toBe("/autogestion/notificaciones");
  });

  it("modo panel: «Ver todas» abre la bandeja en un panel y no es un enlace", async () => {
    const user = userEvent.setup();
    render(<CampanaNotificaciones modoBandeja="panel" />, { wrapper: Envoltorio });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    expect(screen.queryByRole("link", { name: "Ver todas las notificaciones" })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Ver todas las notificaciones" }));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("Notificaciones")).toBeDefined();
    expect(await within(panel).findByText("Solo no leídas")).toBeDefined();
  });

  it("sin permiso de Autogestión no se ofrece «Ver detalle» de un enlace a ese módulo", async () => {
    const user = userEvent.setup();
    render(<CampanaNotificaciones modoBandeja="panel" />, { wrapper: Envoltorio });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    await screen.findByText("Ventana habilitada");
    expect(screen.queryByRole("link", { name: /Ver detalle/ })).toBeNull();
  });

  it("con permiso de Autogestión sí se ofrece «Ver detalle»", async () => {
    sesion.permisos = ["notificaciones.ver_propias", "autogestion.ver_propio"];
    const user = userEvent.setup();
    render(<CampanaNotificaciones modoBandeja="panel" />, { wrapper: Envoltorio });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    expect(await screen.findByRole("link", { name: /Ver detalle/ })).toBeDefined();
  });
});

describe("BandejaNotificacionesPage", () => {
  it("muestra el estado vacío", async () => {
    acciones.listarNotificacionesAction.mockResolvedValue(pagina([]));
    render(<BandejaNotificacionesPage />, { wrapper: Envoltorio });
    expect(await screen.findByText("No tiene notificaciones")).toBeDefined();
  });

  it("lista las notificaciones con estado en texto y enlace", async () => {
    acciones.listarNotificacionesAction.mockResolvedValue(
      pagina([
        n(),
        n({ id: "22222222-2222-4222-8222-222222222222", titulo: "Vieja", leida: true }),
      ]),
    );
    render(<BandejaNotificacionesPage />, { wrapper: Envoltorio });
    expect(await screen.findByText("Ventana habilitada")).toBeDefined();
    expect(screen.getByText("Nueva")).toBeDefined();
    expect(screen.getByText("Leída")).toBeDefined();
    const enlaces = screen.getAllByRole("link", { name: /Ver detalle/ });
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].getAttribute("href")).toBe("/autogestion/solicitudes");
  });

  it("marcar como leída llama a la acción con el id", async () => {
    const user = userEvent.setup();
    render(<BandejaNotificacionesPage />, { wrapper: Envoltorio });
    await user.click(await screen.findByRole("button", { name: "Marcar como leída" }));
    await waitFor(() =>
      expect(acciones.marcarLeidaAction).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
      ),
    );
  });

  it("muestra el error con opción de reintentar", async () => {
    acciones.listarNotificacionesAction.mockResolvedValue({ ok: false, mensaje: "Falla" });
    render(<BandejaNotificacionesPage />, { wrapper: Envoltorio });
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined();
  });
});
