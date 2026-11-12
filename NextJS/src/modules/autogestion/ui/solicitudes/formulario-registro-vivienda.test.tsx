import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
}));

vi.mock("@/modules/catalogos/infrastructure/actions/catalogos-actions", () => ({
  crearParentescoAction: vi.fn(),
}));

vi.mock("../../infrastructure/actions/solicitudes-actions", () => ({
  listarCatalogoAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { FormularioRegistro } from "./formulario-registro";
import { SECCIONES_DEF } from "../../domain/value-objects/campos-seccion";
import { esquemaDeEntidad } from "../schema/schema-solicitud";

vi.mock("./opciones-catalogo", () => ({
  opcionesCatalogo: vi.fn().mockImplementation((catalogo: string) => {
    if (catalogo === "paises") {
      return Promise.resolve([
        { id: 1, nombre: "VENEZUELA", esVenezuela: true },
        { id: 25, nombre: "ALEMANIA", esVenezuela: false },
      ]);
    }
    if (catalogo === "estados") {
      return Promise.resolve([
        { id: 2, nombre: "ANZOÁTEGUI" },
        { id: 3, nombre: "MÉRIDA" },
      ]);
    }
    if (catalogo === "municipios") {
      return Promise.resolve([{ id: 13, nombre: "CASANARE" }]);
    }
    if (catalogo === "parroquias") {
      return Promise.resolve([{ id: 47, nombre: "EL CHAPARRO" }]);
    }
    if (catalogo === "codigosPostales") {
      return Promise.resolve([{ id: 100, nombre: "6001" }]);
    }
    if (catalogo === "condicionesVivienda") {
      return Promise.resolve([{ id: 1, nombre: "PROPIA" }]);
    }
    return Promise.resolve([]);
  }),
}));

const definicion = SECCIONES_DEF.vivienda.entidades.find((e) => e.entidad === "datos_vivienda")!;
const esquema = esquemaDeEntidad("vivienda", "datos_vivienda")!;

describe("FormularioRegistro - Vivienda condicional presencial/autogestión (P11 y P12)", () => {
  it("con país extranjero muestra Ciudad o región y oculta ubicación de Venezuela", async () => {
    render(
      <FormularioRegistro
        seccion="vivienda"
        definicion={definicion}
        esquema={esquema}
        modo="CREAR"
        inicial={{ pais_id: 25 }}
        textoGuardar="Agregar al borrador"
        onGuardar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Ciudad o región/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Estado \*/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Municipio \*/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Parroquia \*/i)).not.toBeInTheDocument();
  });

  it("con país extranjero normaliza Ciudad o región a mayúsculas y permite guardar", async () => {
    const onGuardar = vi.fn();
    const user = userEvent.setup();

    render(
      <FormularioRegistro
        seccion="vivienda"
        definicion={definicion}
        esquema={esquema}
        modo="CREAR"
        inicial={{ pais_id: 25 }}
        textoGuardar="Agregar al borrador"
        onGuardar={onGuardar}
        onCancelar={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Dirección exacta/i)).toBeInTheDocument();
    });

    const ciudadInput = screen.getByRole("textbox", { name: /Ciudad o región/i });
    const dirInput = screen.getByLabelText(/Dirección exacta/i);

    await user.type(ciudadInput, "  berlin  mitte  ");
    await user.type(dirInput, "Alexanderplatz 1, edificio 2");

    // Seleccionar condición
    const condicionSelect = screen.getByLabelText(/Condición de la vivienda/i);
    await user.selectOptions(condicionSelect, "1");

    await user.click(screen.getByRole("button", { name: /Agregar al borrador/i }));

    await waitFor(() => {
      expect(onGuardar).toHaveBeenCalledTimes(1);
    });

    const guardado = onGuardar.mock.calls[0][0];
    expect(guardado.ciudad_region).toBe("BERLIN MITTE");
    expect(guardado.pais_id).toBe(25);
  });

  it("con Venezuela exige ubicación completa y avisa si faltan campos", async () => {
    const onGuardar = vi.fn();
    const user = userEvent.setup();

    render(
      <FormularioRegistro
        seccion="vivienda"
        definicion={definicion}
        esquema={esquema}
        modo="CREAR"
        inicial={{ pais_id: 1 }}
        textoGuardar="Agregar al borrador"
        onGuardar={onGuardar}
        onCancelar={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Dirección exacta/i)).toBeInTheDocument();
    });

    // Ciudad o región no debe aparecer en Venezuela
    expect(screen.queryByRole("textbox", { name: /Ciudad o región/i })).not.toBeInTheDocument();

    // Intentar guardar sin elegir estado/municipio/parroquia
    await user.type(screen.getByLabelText(/Dirección exacta/i), "Calle Bolívar casa 5");
    const condicionSelect = screen.getByLabelText(/Condición de la vivienda/i);
    await user.selectOptions(condicionSelect, "1");

    await user.click(screen.getByRole("button", { name: /Agregar al borrador/i }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Revise los campos marcados en rojo.");
  });
});

const vigente = {
  pais_id: 1,
  ciudad_region: null,
  estado_id: 2,
  municipio_id: 13,
  parroquia_id: 47,
  codigo_postal_id: 100,
  direccion_exacta: "Calle Bolívar casa 5",
  condicion_vivienda_id: 1,
};

function montarModificar(onGuardar = vi.fn()) {
  render(
    <FormularioRegistro
      seccion="vivienda"
      definicion={definicion}
      esquema={esquema}
      modo="MODIFICAR"
      inicial={vigente}
      textoGuardar="Guardar cambio"
      onGuardar={onGuardar}
      onCancelar={vi.fn()}
    />,
  );
  return onGuardar;
}

describe("FormularioRegistro - actualizar mi vivienda (cascada)", () => {
  beforeAll(() => {
    // cmdk (lista con buscador) usa scrollIntoView, que jsdom no implementa.
    Element.prototype.scrollIntoView = vi.fn();
  });


  it("abre precargado con los datos actuales", async () => {
    montarModificar();
    await waitFor(() => {
      expect(screen.getByLabelText(/Dirección exacta/i)).toHaveValue("Calle Bolívar casa 5");
    });
    expect(screen.queryByRole("textbox", { name: /Ciudad o región/i })).not.toBeInTheDocument();
  });

  it("cambiar el estado vacía municipio y parroquia y obliga a elegirlos", async () => {
    const user = userEvent.setup();
    const onGuardar = montarModificar();
    await waitFor(() => {
      expect(screen.getByLabelText(/Dirección exacta/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox", { name: /Estado/i }));
    await user.click(await screen.findByText("MÉRIDA"));

    await user.click(screen.getByRole("button", { name: /Guardar cambio/i }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(await screen.findByText("Seleccione el municipio.")).toBeInTheDocument();
    // Municipio y parroquia quedaron vacíos (ya no muestran el valor anterior).
    expect(screen.getByRole("combobox", { name: /Municipio/i })).toHaveTextContent("Seleccione…");
    expect(screen.getByRole("combobox", { name: /Parroquia/i })).toHaveTextContent(
      "Elija primero la opción anterior",
    );
  });

  it("pasar a un país extranjero oculta y vacía estado, municipio y parroquia", async () => {
    const user = userEvent.setup();
    const onGuardar = montarModificar();
    await waitFor(() => {
      expect(screen.getByLabelText(/Dirección exacta/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/^País/i), "25");

    expect(await screen.findByRole("textbox", { name: /Ciudad o región/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Estado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Municipio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Parroquia/i })).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /Ciudad o región/i }), "berlin");
    await user.click(screen.getByRole("button", { name: /Guardar cambio/i }));

    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    const guardado = onGuardar.mock.calls[0][0];
    expect(guardado.pais_id).toBe(25);
    expect(guardado.ciudad_region).toBe("BERLIN");
    expect(guardado.estado_id).toBe("");
    expect(guardado.municipio_id).toBe("");
    expect(guardado.parroquia_id).toBe("");
  });

  it("volver a Venezuela desde el exterior deja la ubicación por elegir", async () => {
    const user = userEvent.setup();
    const onGuardar = montarModificar();
    await waitFor(() => {
      expect(screen.getByLabelText(/Dirección exacta/i)).toBeInTheDocument();
    });
    await user.selectOptions(screen.getByLabelText(/^País/i), "25");
    await user.selectOptions(screen.getByLabelText(/^País/i), "1");

    await user.click(screen.getByRole("button", { name: /Guardar cambio/i }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(await screen.findByText("Seleccione el estado.")).toBeInTheDocument();
  });

  it("cambiar solo la dirección deja lo demás igual", async () => {
    const user = userEvent.setup();
    const onGuardar = montarModificar();
    const direccion = await screen.findByLabelText(/Dirección exacta/i);
    await user.clear(direccion);
    await user.type(direccion, "Avenida Principal casa 9");
    await user.click(screen.getByRole("button", { name: /Guardar cambio/i }));

    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    const guardado = onGuardar.mock.calls[0][0];
    expect(guardado.direccion_exacta).toBe("Avenida Principal casa 9");
    expect(guardado.estado_id).toBe(2);
    expect(guardado.municipio_id).toBe(13);
    expect(guardado.parroquia_id).toBe(47);
  });
});
