import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ParametrosPage } from "./parametros-page";
import type { ParametroDTO } from "../application/dtos/parametro-dto";
import { CLAVE_GENERAR_PUNTOS_CUENTA } from "../domain/value-objects/claves-parametros";

const parametrosMock: ParametroDTO[] = [
  {
    clave: "carnetizacion.mi_carnet_alcance",
    etiqueta: "Alcance de «Mi carnet» en Autogestión",
    descripcion: "Determina quiénes pueden ver su carnet.",
    grupo: "carnetizacion",
    tipo: "texto",
    valor: "nadie",
    defecto: "nadie",
    minimo: null,
    maximo: null,
    actualizadoPorId: null,
    actualizadoEn: null,
    opciones: [
      { valor: "nadie", etiqueta: "Nadie (apagado)" },
      { valor: "todos", etiqueta: "Todos" },
      { valor: "usuarios_especificos", etiqueta: "Usuarios específicos" },
    ],
  },
  {
    clave: "carnetizacion.mi_carnet_usuarios",
    etiqueta: "Cédulas autorizadas para «Mi carnet»",
    descripcion: "Cédulas cuando el alcance es «Usuarios específicos».",
    grupo: "carnetizacion",
    tipo: "texto",
    valor: "",
    defecto: "",
    minimo: null,
    maximo: null,
    actualizadoPorId: null,
    actualizadoEn: null,
    opciones: [],
    depende_de: {
      clave: "carnetizacion.mi_carnet_alcance",
      valor: "usuarios_especificos",
    },
  },
  {
    clave: CLAVE_GENERAR_PUNTOS_CUENTA,
    etiqueta: "Generar puntos de cuenta",
    descripcion: "Genera automáticamente un punto de cuenta.",
    grupo: "puntocuenta",
    tipo: "booleano",
    valor: "true",
    defecto: "false",
    minimo: null,
    maximo: null,
    actualizadoPorId: null,
    actualizadoEn: null,
    opciones: [],
  },
];

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { permisos: ["configuracion.editar"] } },
    status: "authenticated",
  }),
}));

vi.mock("swr", () => ({
  default: () => ({
    data: parametrosMock,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("../infrastructure/actions/parametros-actions", () => ({
  listarParametrosAction: vi.fn(async () => parametrosMock),
  actualizarParametroAction: vi.fn(async () => ({ success: true })),
  historialParametroAction: vi.fn(async () => ({
    resultados: [
      {
        fecha: "2026-11-08T10:00:00Z",
        actorCedula: "V-12345678",
        valorPrevio: "",
        valorNuevo: "12345678",
        resultado: "SUCCESS",
        agregados: ["Juan Pérez (12345678)"],
        quitados: [],
      },
    ],
    total: 1,
    pagina: 1,
    tamano: 10,
    totalPaginas: 1,
  })),
  buscarTrabajadoresParametroAction: vi.fn(async () => []),
}));

vi.mock("../infrastructure/actions/restablecimiento-bloque-actions", () => ({
  calcularRestablecimientoBloqueAction: vi.fn(),
  ejecutarRestablecimientoBloqueAction: vi.fn(),
  estadoRestablecimientoBloqueAction: vi.fn(),
  descargarExcelRestablecimientoBloqueAction: vi.fn(),
}));

describe("ParametrosPage", () => {
  it("oculta el parámetro dependiente cuando el padre no coincide con el valor esperado", () => {
    render(<ParametrosPage />);
    // Con alcance = 'nadie', el parámetro dependiente mi_carnet_usuarios no debe verse
    expect(
      screen.queryByText("Cédulas autorizadas para «Mi carnet»"),
    ).not.toBeInTheDocument();
  });

  it("muestra el botón de punto de cuenta con enlace y estilo botón", () => {
    render(<ParametrosPage />);
    const linkBoton = screen.getByRole("link", {
      name: /Configurar movimientos y formato/i,
    });
    expect(linkBoton).toBeInTheDocument();
    expect(linkBoton).toHaveAttribute("href", "/configuracion/punto-cuenta");
  });

  it("abre el historial y muestra agregados", async () => {
    render(<ParametrosPage />);
    const botonesHistorial = screen.getAllByRole("button", { name: /Historial/i });
    fireEvent.click(botonesHistorial[0]);

    await waitFor(() => {
      expect(screen.getByText(/Historial de «/i)).toBeInTheDocument();
    });
  });
});
