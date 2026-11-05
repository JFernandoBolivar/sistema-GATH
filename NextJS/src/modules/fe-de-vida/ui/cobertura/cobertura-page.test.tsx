import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import CoberturaPage from "./cobertura-page";
import type { CoberturaEntity } from "../../domain/entities/fe-de-vida";

const mockListarCoberturaAction = vi.fn();
const mockListarTiposPensionAction = vi.fn();

vi.mock("../../infrastructure/actions/fe-de-vida-actions", () => ({
  listarCoberturaAction: (...args: unknown[]) => mockListarCoberturaAction(...args),
  listarTiposPensionAction: (...args: unknown[]) => mockListarTiposPensionAction(...args),
}));

describe("CoberturaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListarTiposPensionAction.mockResolvedValue({
      ok: true,
      datos: [{ id: 1, nombre: "Jubilados" }],
    });
  });

  const renderConSWR = () =>
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CoberturaPage />
      </SWRConfig>,
    );

  it("muestra correo alternativo y badge 'Alternativo sin validar' cuando no está validado", async () => {
    const pasivoAltNoValidado: CoberturaEntity = {
      cedula: "V11111111",
      nombreCompleto: "Pasivo Con Alternativo",
      tipoNomina: "Jubilados",
      correo: "",
      correoAlternativo: "alt@correo.com",
      alternativoValidado: false,
      sinCorreo: false,
      tieneCuenta: false,
      canal: "",
    };

    const pasivoSinCorreo: CoberturaEntity = {
      cedula: "V22222222",
      nombreCompleto: "Pasivo Sin Nada",
      tipoNomina: "Jubilados",
      correo: "",
      correoAlternativo: "",
      alternativoValidado: false,
      sinCorreo: true,
      tieneCuenta: false,
      canal: "",
    };

    mockListarCoberturaAction.mockResolvedValue({
      ok: true,
      datos: {
        count: 2,
        results: [pasivoAltNoValidado, pasivoSinCorreo],
      },
    });

    renderConSWR();

    expect(await screen.findByText("Pasivo Con Alternativo")).toBeInTheDocument();
    expect(screen.getByText("Alternativo: alt@correo.com")).toBeInTheDocument();
    expect(screen.getByText("Alternativo sin validar")).toBeInTheDocument();

    // El pasivo con alternativo NO debe tener badge "Sin correo" en su fila
    expect(screen.getByText("Pasivo Sin Nada")).toBeInTheDocument();
  });

  it("no muestra badge 'Alternativo sin validar' si el correo alternativo ya está validado", async () => {
    const pasivoValidado: CoberturaEntity = {
      cedula: "V33333333",
      nombreCompleto: "Pasivo Validado",
      tipoNomina: "Jubilados",
      correo: "princ@correo.com",
      correoAlternativo: "alt.validado@correo.com",
      alternativoValidado: true,
      sinCorreo: false,
      tieneCuenta: true,
      canal: "EN_LINEA",
    };

    mockListarCoberturaAction.mockResolvedValue({
      ok: true,
      datos: {
        count: 1,
        results: [pasivoValidado],
      },
    });

    renderConSWR();

    expect(await screen.findByText("Pasivo Validado")).toBeInTheDocument();
    expect(screen.getByText("princ@correo.com")).toBeInTheDocument();
    expect(screen.getByText("Alternativo: alt.validado@correo.com")).toBeInTheDocument();
    expect(screen.queryByText("Alternativo sin validar")).not.toBeInTheDocument();
  });
});
