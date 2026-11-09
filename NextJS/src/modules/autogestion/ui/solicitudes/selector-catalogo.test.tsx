import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
}));

vi.mock("@/modules/catalogos/infrastructure/actions/catalogos-actions", () => ({
  crearParentescoAction: vi.fn(),
}));

vi.mock("./opciones-catalogo", () => ({
  // El catálogo llega después del montaje: reproduce el D5.
  opcionesCatalogo: vi
    .fn()
    .mockImplementation(
      () =>
        new Promise((resolver) =>
          setTimeout(
            () =>
              resolver([
                { id: 1, nombre: "Venezuela" },
                { id: 2, nombre: "Chile" },
              ]),
            20,
          ),
        ),
    ),
}));

import { SelectorCatalogo } from "./selector-catalogo";

function Formulario() {
  const { register, watch, setValue } = useForm<{ pais_id: string }>({
    defaultValues: { pais_id: "1" },
  });
  return (
    <SelectorCatalogo
      id="pais_id"
      etiqueta="País"
      catalogo="paises"
      registro={register("pais_id")}
      valor={watch("pais_id")}
      onCambio={(valor) => setValue("pais_id", valor)}
      requerido
    />
  );
}

describe("SelectorCatalogo nativo (D5/FIX-O46)", () => {
  it("refleja el valor guardado aunque las opciones carguen después", async () => {
    render(<Formulario />);

    const select = screen.getByLabelText(/País/) as HTMLSelectElement;
    await waitFor(() => expect(select).toHaveValue("1"));
    expect(select.options[select.selectedIndex].text).toBe("Venezuela");
  });
});
