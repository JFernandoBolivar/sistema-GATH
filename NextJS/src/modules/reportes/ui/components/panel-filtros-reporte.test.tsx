import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { GrupoFiltrosReporte, PanelFiltrosReporte } from "./panel-filtros-reporte";

function ConFormulario({ children }: { children: ReactNode }) {
  const form = useForm({
    defaultValues: { filtros: { cargo_id: 3, nomina_id: "" } },
  });
  return <FormProvider {...form}>{children}</FormProvider>;
}

describe("PanelFiltrosReporte", () => {
  it("muestra el título y cuenta solo los filtros con valor", () => {
    render(
      <ConFormulario>
        <PanelFiltrosReporte>
          <GrupoFiltrosReporte
            titulo="Información De Cargo"
            campos={["filtros.cargo_id", "filtros.nomina_id"]}
          >
            <p>Contenido del grupo</p>
          </GrupoFiltrosReporte>
        </PanelFiltrosReporte>
      </ConFormulario>,
    );
    expect(screen.getByText("Información De Cargo")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Contenido del grupo")).toBeInTheDocument();
  });
});
