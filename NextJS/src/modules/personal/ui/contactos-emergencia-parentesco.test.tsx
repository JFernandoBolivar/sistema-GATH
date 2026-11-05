import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useForm, FormProvider } from "react-hook-form";
import { useSession } from "next-auth/react";

import { ContactosEmergenciaCampos } from "./contactos-emergencia-campos";
import { catalogosApi } from "@/modules/catalogos/infrastructure/http/catalogos-api";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/modules/catalogos/infrastructure/http/catalogos-api", () => ({
  catalogosApi: {
    crearParentesco: vi.fn(),
    getParentescos: vi.fn(),
  },
}));

function ContenedorPrueba({
  parentescos,
}: {
  parentescos: Array<{ id: number; nombre: string; codigo: string | null }>;
}) {
  const form = useForm({
    defaultValues: {
      contacto_emergencia: [
        {
          nombres: "Carlos",
          apellidos: "Gomez",
          telefono: "04121234567",
          relacion_id: 1,
        },
      ],
    },
  });

  return (
    <FormProvider {...form}>
      <ContactosEmergenciaCampos parentescos={parentescos} />
    </FormProvider>
  );
}

describe("ContactosEmergenciaCampos - Parentesco y permiso catalogos.crear", () => {
  const parentescosBase = [
    { id: 1, nombre: "MADRE", codigo: null },
    { id: 2, nombre: "PADRE", codigo: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ofrece la opción «Otros…» cuando el usuario tiene permiso catalogos.crear", () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          permisos: ["catalogos.crear", "personal.ver"],
        },
        expires: "2099-01-01",
      } as never,
      status: "authenticated",
      update: vi.fn(),
    });

    render(<ContenedorPrueba parentescos={parentescosBase} />);

    const trigger = screen.getByLabelText("Parentesco del contacto 1");
    expect(trigger).toBeDefined();
    expect(trigger).toBeInTheDocument();
  });

  it("no ofrece la opción «Otros…» cuando el usuario no tiene permiso catalogos.crear", () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          permisos: ["personal.ver"],
        },
        expires: "2099-01-01",
      } as never,
      status: "authenticated",
      update: vi.fn(),
    });

    render(<ContenedorPrueba parentescos={parentescosBase} />);

    const trigger = screen.getByLabelText("Parentesco del contacto 1");
    expect(trigger).toBeInTheDocument();
  });

  it("catalogosApi.getParentescos acepta parámetro de uso", async () => {
    vi.mocked(catalogosApi.getParentescos).mockResolvedValueOnce([
      { id: 1, nombre: "MADRE" },
    ]);

    const res = await catalogosApi.getParentescos("contacto");
    expect(catalogosApi.getParentescos).toHaveBeenCalledWith("contacto");
    expect(res).toHaveLength(1);
  });
});
