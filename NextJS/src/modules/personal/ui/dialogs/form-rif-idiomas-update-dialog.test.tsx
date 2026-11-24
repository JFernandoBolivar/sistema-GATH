import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const accionRif = vi.hoisted(() => vi.fn());
const accionIdiomas = vi.hoisted(() => vi.fn());
const accionCatalogo = vi.hoisted(() => vi.fn());
vi.mock("../../infrastructure/actions/personal-actions", () => ({
  actualizarRifAction: accionRif,
  actualizarIdiomasAction: accionIdiomas,
  listarIdiomasCatalogoAction: accionCatalogo,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import FormIdiomasUpdateDialog from "./form-idiomas-update-dialog";
import FormRifUpdateDialog from "./form-rif-update-dialog";

describe("FormRifUpdateDialog", () => {
  beforeEach(() => accionRif.mockReset());

  it("precarga el RIF actual, guarda el nuevo y avisa al padre", async () => {
    accionRif.mockResolvedValue({ rif: "J-30123456-7" });
    const onGuardado = vi.fn();
    render(<FormRifUpdateDialog cedula="123" rif="V-12345678-9" onGuardado={onGuardado} />);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    const campo = screen.getByLabelText("RIF");
    expect(campo).toHaveValue("V-12345678-9");
    await userEvent.clear(campo);
    await userEvent.type(campo, "j-301234567");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(accionRif).toHaveBeenCalledWith("123", "j-301234567"));
    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
  });

  it("un RIF mal formado se rechaza sin llamar al servidor", async () => {
    render(<FormRifUpdateDialog cedula="123" rif={null} onGuardado={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await userEvent.type(screen.getByLabelText("RIF"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText(/RIF válido/)).toBeInTheDocument();
    expect(accionRif).not.toHaveBeenCalled();
  });

  it("vacío borra el RIF", async () => {
    accionRif.mockResolvedValue({ rif: null });
    render(<FormRifUpdateDialog cedula="123" rif="V-12345678-9" onGuardado={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await userEvent.clear(screen.getByLabelText("RIF"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(accionRif).toHaveBeenCalledWith("123", ""));
  });

  it("muestra el error del servidor y no refresca", async () => {
    accionRif.mockResolvedValue({ error: "No posee permiso." });
    const onGuardado = vi.fn();
    render(<FormRifUpdateDialog cedula="123" rif="V-12345678-9" onGuardado={onGuardado} />);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("No posee permiso.")).toBeInTheDocument();
    expect(onGuardado).not.toHaveBeenCalled();
  });
});

describe("FormIdiomasUpdateDialog", () => {
  beforeEach(() => {
    accionIdiomas.mockReset();
    accionCatalogo.mockReset();
    accionCatalogo.mockResolvedValue({ idiomas: [{ id: 7, nombre: "Inglés" }] });
  });

  it("precarga los idiomas, permite quitar uno y guardar la lista nueva", async () => {
    accionIdiomas.mockResolvedValue({ idiomas: [] });
    const onGuardado = vi.fn();
    render(
      <FormIdiomasUpdateDialog
        cedula="123"
        idiomas={[
          { id: 1, idiomaId: 7, otroIdioma: "", nombre: "Inglés", nivel: "BIEN" },
          { id: 2, idiomaId: null, otroIdioma: "Guaraní", nombre: "Guaraní", nivel: "POCO" },
        ]}
        onGuardado={onGuardado}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(await screen.findByDisplayValue("Guaraní")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar el idioma 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(accionIdiomas).toHaveBeenCalledWith("123", [{ idiomaId: null, otroIdioma: "Guaraní", nivel: "POCO" }]),
    );
    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
  });

  it("guardar sin idiomas envía la lista vacía", async () => {
    accionIdiomas.mockResolvedValue({ idiomas: [] });
    render(<FormIdiomasUpdateDialog cedula="123" idiomas={[]} onGuardado={vi.fn()} triggerLabel="Agregar" />);

    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(accionIdiomas).toHaveBeenCalledWith("123", []));
  });

  it("una fila sin idioma se rechaza sin llamar al servidor", async () => {
    render(<FormIdiomasUpdateDialog cedula="123" idiomas={[]} onGuardado={vi.fn()} triggerLabel="Agregar" />);

    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar idioma" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText(/Elija el idioma de cada fila/)).toBeInTheDocument();
    expect(accionIdiomas).not.toHaveBeenCalled();
  });

  it("un idioma repetido se rechaza", async () => {
    render(
      <FormIdiomasUpdateDialog
        cedula="123"
        idiomas={[
          { id: 1, idiomaId: 7, otroIdioma: "", nombre: "Inglés", nivel: "BIEN" },
          { id: 2, idiomaId: 7, otroIdioma: "", nombre: "Inglés", nivel: "POCO" },
        ]}
        onGuardado={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Este idioma ya está en la lista")).toBeInTheDocument();
    expect(accionIdiomas).not.toHaveBeenCalled();
  });

  it("muestra el error del servidor y no refresca", async () => {
    accionIdiomas.mockResolvedValue({ error: "No posee permiso." });
    const onGuardado = vi.fn();
    render(
      <FormIdiomasUpdateDialog
        cedula="123"
        idiomas={[{ id: 1, idiomaId: 7, otroIdioma: "", nombre: "Inglés", nivel: "BIEN" }]}
        onGuardado={onGuardado}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("No posee permiso.")).toBeInTheDocument();
    expect(onGuardado).not.toHaveBeenCalled();
  });
});
