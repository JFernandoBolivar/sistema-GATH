import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfiguracionPuntoCuentaPage } from "./configuracion-punto-cuenta-page";
import type { ConfiguracionPuntoCuenta } from "@/modules/puntocuenta/domain/entities/configuracion-punto-cuenta";

const mockObtenerConfig = vi.fn();
const mockGuardarConfig = vi.fn();

vi.mock("@/modules/puntocuenta/infrastructure/actions/puntocuenta-actions", () => ({
  obtenerConfiguracionPuntoCuentaAction: () => mockObtenerConfig(),
  guardarConfiguracionPuntoCuentaAction: (datos: unknown) => mockGuardarConfig(datos),
}));

describe("ConfiguracionPuntoCuentaPage", () => {
  const configInicial: ConfiguracionPuntoCuenta = {
    generar: true,
    procesos_habilitados: {
      cambio_oficina: true,
      cambio_nivel: true,
      cambio_division: false,
      cambio_cargo_misma_oficina: false,
      egreso_activo: false,
      pase_a_pasivo: false,
      encargaduria_prestamo: false,
      cambio_estatus: false,
    },
    titulo: "PUNTO DE CUENTA GENERAL",
    encabezado: "Encabezado general para pruebas",
    cuerpo: "El funcionario {nombre} con cédula {cedula}.",
    mostrar_nivel: true,
    firmas: [{ cargo: "Director de RRHH", nombre: "Carlos Mora" }],
    plantillas_procesos: {
      cambio_oficina: {
        personalizado: true,
        titulo: "PUNTO DE CUENTA - TRASLADO",
        encabezado: "Encabezado exclusivo de traslado",
        cuerpo: "{nombre} se traslada desde {origen} hacia {destino}.",
      },
    },
    variables_disponibles: [
      { tag: "{nombre}", desc: "Nombre completo" },
      { tag: "{cedula}", desc: "Cédula" },
      { tag: "{cargo}", desc: "Cargo" },
      { tag: "{origen}", desc: "Origen" },
      { tag: "{destino}", desc: "Destino" },
      { tag: "{fecha}", desc: "Fecha" },
      { tag: "{motivo}", desc: "Motivo" },
      { tag: "{numero}", desc: "Número" },
    ],
    version: 4,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockObtenerConfig.mockResolvedValue({
      success: true,
      data: configInicial,
    });
    mockGuardarConfig.mockResolvedValue({
      success: true,
      data: { ...configInicial, version: 5 },
    });
  });

  it("renderiza la configuración inicial, pestañas de procesos habilitados y variables disponibles", async () => {
    render(<ConfiguracionPuntoCuentaPage />);

    expect(await screen.findByText("Configuración de Punto de Cuenta")).toBeInTheDocument();
    expect(screen.getByText("Versión de configuración: v4")).toBeInTheDocument();

    // Variables visibles en la pantalla
    expect(screen.getAllByText("{nombre}").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("{cedula}").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("{origen}").length).toBeGreaterThanOrEqual(1);

    // Pestañas
    expect(screen.getByRole("tab", { name: /Plantilla general/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Cambio de Gerencia \/ Oficina/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Cambio de Nivel/i })).toBeInTheDocument();
  });

  it("permite cambiar a la plantilla de un proceso y muestra sus textos personalizados", async () => {
    const user = userEvent.setup();
    render(<ConfiguracionPuntoCuentaPage />);

    expect(await screen.findByText("Configuración de Punto de Cuenta")).toBeInTheDocument();

    const tabTraslado = screen.getByRole("tab", { name: /Cambio de Gerencia \/ Oficina/i });
    await user.click(tabTraslado);

    // Debe mostrar el título personalizado del proceso
    expect(await screen.findByDisplayValue("PUNTO DE CUENTA - TRASLADO")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Encabezado exclusivo de traslado")).toBeInTheDocument();
  });

  it("muestra fallback a plantilla general si el proceso no está personalizado", async () => {
    const user = userEvent.setup();
    render(<ConfiguracionPuntoCuentaPage />);

    expect(await screen.findByText("Configuración de Punto de Cuenta")).toBeInTheDocument();

    const tabNivel = screen.getByRole("tab", { name: /Cambio de Nivel/i });
    await user.click(tabNivel);

    expect(await screen.findByText("Actualmente hereda la plantilla general predeterminada.")).toBeInTheDocument();
    expect(screen.getByText("Usando plantilla general:")).toBeInTheDocument();
  });

  it("detecta variables no válidas y muestra una alerta accesible", async () => {
    render(<ConfiguracionPuntoCuentaPage />);

    expect(await screen.findByText("Configuración de Punto de Cuenta")).toBeInTheDocument();

    const inputTitulo = screen.getByDisplayValue("PUNTO DE CUENTA GENERAL");
    fireEvent.change(inputTitulo, { target: { value: "PUNTO CON {invalida}" } });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Variables no reconocidas en el texto/i)).toBeInTheDocument();
  });

  it("envía la configuración al guardar cuando los datos son válidos", async () => {
    const user = userEvent.setup();
    render(<ConfiguracionPuntoCuentaPage />);

    expect(await screen.findByText("Configuración de Punto de Cuenta")).toBeInTheDocument();

    const btnGuardar = screen.getByRole("button", { name: /Guardar configuración/i });
    await user.click(btnGuardar);

    await waitFor(() => {
      expect(mockGuardarConfig).toHaveBeenCalledTimes(1);
    });
  });
});
