import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlantillaResumen } from "../../domain/entities/plantilla";
import { CATALOGO } from "../../domain/lib/fixtures";
import { ListaPlantillasView } from "./lista-plantillas-view";

const usePlantillasMock = vi.fn();
const useVariablesMock = vi.fn();
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => "/documentos/plantillas",
}));
vi.mock("../hooks/use-ruta-documentos", () => ({ useRutaDocumentos: () => "/documentos/plantillas" }));
vi.mock("../hooks/use-documentos-datos", () => ({
  usePlantillas: (...args: unknown[]) => usePlantillasMock(...args),
  useVariables: (...args: unknown[]) => useVariablesMock(...args),
}));
vi.mock("../hooks/use-permisos-documentos", () => ({
  usePermisosDocumentos: () => ({ puedeGestionar: true, puedeConfigurarPuntoCuenta: true }),
}));
vi.mock("../hooks/use-configuracion-punto-cuenta", () => ({
  useConfiguracionPuntoCuenta: () => ({
    config: {
      id: "c1",
      generar: true,
      procesos_habilitados: { cambio_oficina: true, cambio_nivel: false },
      version: 1,
      actualizado_por_id: null,
      updated_at: null,
    },
    faltantes: new Set<string>(),
    cargando: false,
    error: null,
    guardar: vi.fn(),
    recargar: vi.fn(),
    actualizarCache: vi.fn(),
  }),
}));
vi.mock("../../infrastructure/actions/documentos-actions", () => ({
  activarPlantillaAction: vi.fn(),
  duplicarPlantillaAction: vi.fn(),
}));
vi.mock("../components/crear-plantilla-dialog", () => ({ CrearPlantillaDialog: () => null }));
vi.mock("@/components/layout/page-layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const plantilla: PlantillaResumen = {
  id: "p1",
  codigo: "PC",
  nombre: "Punto de Cuenta",
  descripcion: "",
  modo: "formulario",
  proceso: "punto_cuenta:cambio_oficina",
  proceso_etiqueta: "Punto de Cuenta: cambio de oficina",
  grupo: "punto_cuenta",
  firmante: "conatel",
  requiere_firma_clic: false,
  activa: true,
  estado: "publicada",
  ultima_version: 1,
  cambios_sin_publicar: false,
  tiene_fondo: false,
  actualizada_en: null,
};

beforeEach(() => {
  usePlantillasMock.mockReset();
  useVariablesMock.mockReset();
  replaceMock.mockReset();
  useVariablesMock.mockReturnValue({ catalogo: CATALOGO, error: null, recargar: vi.fn() });
  usePlantillasMock.mockReturnValue({
    plantillas: [plantilla],
    alertas: [{
      proceso: "punto_cuenta:cambio_nivel",
      etiqueta: "Punto de Cuenta: cambio de nivel",
      mensaje: "Falta la plantilla del Punto de Cuenta de cambio de nivel",
    }],
    cargando: false,
    error: null,
    recargar: vi.fn(),
  });
});

describe("ListaPlantillasView", () => {
  it("filtra por grupo y proceso, y enlaza las alertas con el diseñador", () => {
    render(<ListaPlantillasView filtrosIniciales={{ grupo: "punto_cuenta" }} />);

    expect(usePlantillasMock).toHaveBeenCalledWith({ grupo: "punto_cuenta", proceso: undefined });
    expect(screen.getByRole("heading", { name: "Procesos del Punto de Cuenta" })).toBeInTheDocument();
    expect(screen.getByText("Falta la plantilla del Punto de Cuenta de cambio de nivel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Diseñar plantilla" })).toHaveAttribute(
      "href",
      "/documentos/plantillas?crear=1&proceso=punto_cuenta%3Acambio_nivel&grupo=punto_cuenta",
    );

    fireEvent.change(screen.getByLabelText("Filtrar por proceso"), { target: { value: "punto_cuenta:cambio_nivel" } });
    expect(usePlantillasMock).toHaveBeenLastCalledWith({
      grupo: "punto_cuenta",
      proceso: "punto_cuenta:cambio_nivel",
    });
  });

  it("permite reintentar el catálogo y no ofrece diseño sin procesos", () => {
    const recargar = vi.fn();
    useVariablesMock.mockReturnValue({ catalogo: null, error: "Catálogo no disponible", recargar });
    render(<ListaPlantillasView />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el catálogo de procesos");
    expect(screen.queryByRole("button", { name: "Nueva plantilla" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(recargar).toHaveBeenCalledOnce();
  });
});
