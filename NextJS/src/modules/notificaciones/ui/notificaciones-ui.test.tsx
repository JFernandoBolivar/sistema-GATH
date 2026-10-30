import { beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import type { NotificacionDTO } from "../application/dtos/notificacion-dto";

// La suite completa corre en paralelo y a veces lenta: margen amplio para esperas asíncronas.
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20_000 });

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

const ID = (i: number) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`;

const n = (sobre: Partial<NotificacionDTO> = {}): NotificacionDTO => ({
  id: ID(1),
  tipo: "x.y",
  titulo: "Ventana habilitada",
  mensaje: "Puede actualizar sus datos",
  enlace: "/autogestion/solicitudes",
  leida: false,
  fechaLectura: null,
  creadaEn: "2026-10-29T15:00:00Z",
  ...sobre,
});

const muchas = (cantidad: number) =>
  Array.from({ length: cantidad }, (_, i) => n({ id: ID(i + 1), titulo: `Aviso ${i + 1}` }));

const pagina = (resultados: NotificacionDTO[], total = resultados.length, desplazamiento = 0) => ({
  ok: true as const,
  mensaje: "",
  datos: { total, limite: 10, desplazamiento, resultados },
});

const ultimaLlamadaListar = () => {
  const llamadas = acciones.listarNotificacionesAction.mock.calls;
  return llamadas[llamadas.length - 1][0];
};

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

const campana = (props: { modulo?: "autogestion" | "personal"; ruta?: string } = {}) => (
  <CampanaNotificaciones
    modulo={props.modulo ?? "autogestion"}
    rutaBandeja={props.ruta ?? "/autogestion/notificaciones"}
  />
);

describe("CampanaNotificaciones", () => {
  it("muestra el conteo del módulo en el nombre accesible del botón", async () => {
    render(campana({ modulo: "personal", ruta: "/personal/notificaciones" }), {
      wrapper: Envoltorio,
    });
    expect(
      await screen.findByRole("button", { name: "Notificaciones: 2 notificaciones sin leer" }),
    ).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("2 notificaciones sin leer");
    expect(acciones.contarNoLeidasAction).toHaveBeenCalledWith("personal");
  });

  it("sin el permiso no se muestra ni se consulta nada", () => {
    sesion.permisos = ["autogestion.ver_propio"];
    const { container } = render(campana(), { wrapper: Envoltorio });
    expect(container.innerHTML).toBe("");
    expect(acciones.contarNoLeidasAction).not.toHaveBeenCalled();
  });

  it("muestra como máximo las 4 últimas no leídas del módulo", async () => {
    acciones.listarNotificacionesAction.mockResolvedValue(pagina(muchas(7), 7));
    const user = userEvent.setup();
    render(campana({ modulo: "personal", ruta: "/personal/notificaciones" }), {
      wrapper: Envoltorio,
    });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    expect(await screen.findByText("Aviso 1")).toBeDefined();
    expect(screen.getAllByText(/^Aviso \d$/)).toHaveLength(4);
    expect(acciones.listarNotificacionesAction).toHaveBeenCalledWith({
      modulo: "personal",
      leida: false,
      limite: 4,
    });
  });

  it("«Ver todas» es un enlace a la bandeja del módulo actual", async () => {
    const user = userEvent.setup();
    render(campana({ modulo: "personal", ruta: "/personal/notificaciones" }), {
      wrapper: Envoltorio,
    });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    const enlace = await screen.findByRole("link", { name: "Ver todas" });
    expect(enlace.getAttribute("href")).toBe("/personal/notificaciones");
  });

  it("«Marcar todas como leídas» marca solo las del módulo y refresca el conteo", async () => {
    const user = userEvent.setup();
    render(campana({ modulo: "personal", ruta: "/personal/notificaciones" }), {
      wrapper: Envoltorio,
    });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    expect(await screen.findByText("Ventana habilitada")).toBeDefined();
    acciones.contarNoLeidasAction.mockResolvedValue({ ok: true, mensaje: "", datos: 0 });
    await user.click(screen.getByRole("button", { name: /Marcar todas como leídas/ }));
    await waitFor(() => expect(acciones.marcarTodasLeidasAction).toHaveBeenCalledWith("personal"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Notificaciones: Sin notificaciones nuevas" }),
      ).toBeDefined(),
    );
  });

  it("sin permiso de Autogestión no se ofrece «Ver detalle» de un enlace a ese módulo", async () => {
    const user = userEvent.setup();
    render(campana(), { wrapper: Envoltorio });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    await screen.findByText("Ventana habilitada");
    expect(screen.queryByRole("link", { name: /Ver detalle/ })).toBeNull();
  });

  it("con permiso de Autogestión sí se ofrece «Ver detalle»", async () => {
    sesion.permisos = ["notificaciones.ver_propias", "autogestion.ver_propio"];
    const user = userEvent.setup();
    render(campana(), { wrapper: Envoltorio });
    await user.click(await screen.findByRole("button", { name: /Notificaciones: 2/ }));
    expect(await screen.findByRole("link", { name: /Ver detalle/ })).toBeDefined();
  });
});

describe("BandejaNotificacionesPage", () => {
  it("pide la bandeja del módulo con 10 por página y sin filtros", async () => {
    render(<BandejaNotificacionesPage modulo="personal" />, { wrapper: Envoltorio });
    await screen.findByText("Ventana habilitada");
    expect(ultimaLlamadaListar()).toEqual({
      modulo: "personal",
      limite: 10,
      desplazamiento: 0,
    });
  });

  it("muestra el estado vacío", async () => {
    acciones.listarNotificacionesAction.mockResolvedValue(pagina([]));
    render(<BandejaNotificacionesPage modulo="autogestion" />, { wrapper: Envoltorio });
    expect(await screen.findByText("No tiene notificaciones")).toBeDefined();
  });

  it("lista las notificaciones con estado en texto y enlace", async () => {
    acciones.listarNotificacionesAction.mockResolvedValue(
      pagina([n(), n({ id: ID(2), titulo: "Vieja", leida: true })]),
    );
    render(<BandejaNotificacionesPage modulo="autogestion" />, { wrapper: Envoltorio });
    expect(await screen.findByText("Ventana habilitada")).toBeDefined();
    expect(screen.getByText("Nueva")).toBeDefined();
    expect(screen.getByText("Leída")).toBeDefined();
  });

  it("marcar como leída llama a la acción con el id", async () => {
    const user = userEvent.setup();
    render(<BandejaNotificacionesPage modulo="autogestion" />, { wrapper: Envoltorio });
    await user.click(await screen.findByRole("button", { name: "Marcar como leída" }));
    await waitFor(() => expect(acciones.marcarLeidaAction).toHaveBeenCalledWith(ID(1)));
  });

  it("muestra el error con opción de reintentar", async () => {
    acciones.listarNotificacionesAction.mockResolvedValue({ ok: false, mensaje: "Falla" });
    render(<BandejaNotificacionesPage modulo="autogestion" />, { wrapper: Envoltorio });
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined();
  });

  it("pagina con Anterior/Siguiente y muestra el total", async () => {
    acciones.listarNotificacionesAction.mockImplementation(async (f: { desplazamiento: number }) =>
      pagina(muchas(10), 25, f.desplazamiento),
    );
    const user = userEvent.setup();
    render(<BandejaNotificacionesPage modulo="autogestion" />, { wrapper: Envoltorio });
    expect(await screen.findByText(/Mostrando 1–10 de 25/)).toBeDefined();
    const anterior = screen.getByRole("button", { name: /Anterior/ }) as HTMLButtonElement;
    expect(anterior.disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(await screen.findByText(/Mostrando 11–20 de 25/)).toBeDefined();
    await waitFor(() => expect(ultimaLlamadaListar().desplazamiento).toBe(10));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: /Siguiente/ }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );

    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await waitFor(() =>
      expect(screen.getByRole("navigation", { name: /Paginación/ }).textContent).toContain("21–25"),
    );
    expect((screen.getByRole("button", { name: /Siguiente/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await user.click(screen.getByRole("button", { name: /Anterior/ }));
    expect(await screen.findByText(/Mostrando 11–20 de 25/)).toBeDefined();
  });

  it("la búsqueda de texto espera (debounce) y vuelve a la primera página", async () => {
    const user = userEvent.setup();
    render(<BandejaNotificacionesPage modulo="autogestion" />, { wrapper: Envoltorio });
    await screen.findByText("Ventana habilitada");
    const antes = acciones.listarNotificacionesAction.mock.calls.length;
    await user.type(screen.getByLabelText("Buscar"), "venta");
    // Mientras se escribe no se consulta en cada pulsación.
    expect(acciones.listarNotificacionesAction.mock.calls.length).toBe(antes);
    await waitFor(() => expect(ultimaLlamadaListar().q).toBe("venta"), { timeout: 2000 });
    expect(ultimaLlamadaListar().desplazamiento).toBe(0);
  });

  it("los filtros de tipo, estado y fechas llegan a la acción", async () => {
    const user = userEvent.setup();
    render(<BandejaNotificacionesPage modulo="autogestion" />, { wrapper: Envoltorio });
    await screen.findByText("Ventana habilitada");

    await user.selectOptions(screen.getByLabelText("Tipo"), "autogestion.ventana_expirada");
    await waitFor(() => expect(ultimaLlamadaListar().tipo).toBe("autogestion.ventana_expirada"));

    await user.selectOptions(screen.getByLabelText("Estado"), "no");
    await waitFor(() => expect(ultimaLlamadaListar().leida).toBe(false));
    await user.selectOptions(screen.getByLabelText("Estado"), "si");
    await waitFor(() => expect(ultimaLlamadaListar().leida).toBe(true));

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-29" } });
    await waitFor(() => {
      const f = ultimaLlamadaListar();
      expect(f.desde).toBe("2026-10-01");
      expect(f.hasta).toBe("2026-10-29");
    });
  });

  it("con filtros sin resultados lo dice y con fechas invertidas no consulta", async () => {
    acciones.listarNotificacionesAction.mockResolvedValue(pagina([]));
    const user = userEvent.setup();
    render(<BandejaNotificacionesPage modulo="autogestion" />, { wrapper: Envoltorio });
    await user.selectOptions(screen.getByLabelText("Estado"), "no");
    expect(await screen.findByText("Ninguna notificación coincide con los filtros")).toBeDefined();

    const llamadas = acciones.listarNotificacionesAction.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-20" } });
    expect(await screen.findByText(/no puede ser posterior/)).toBeDefined();
    expect(acciones.listarNotificacionesAction.mock.calls.length).toBeLessThanOrEqual(llamadas + 1);
  });

  it("«Marcar todas como leídas» marca solo las del módulo", async () => {
    const user = userEvent.setup();
    render(<BandejaNotificacionesPage modulo="personal" />, { wrapper: Envoltorio });
    await screen.findByText("Ventana habilitada");
    await user.click(screen.getByRole("button", { name: /Marcar todas como leídas/ }));
    await waitFor(() => expect(acciones.marcarTodasLeidasAction).toHaveBeenCalledWith("personal"));
  });
});
