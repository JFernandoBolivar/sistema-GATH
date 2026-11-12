import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SECCIONES_DEF } from "../../domain/value-objects/campos-seccion";
import { identidadSchema } from "../schema/schema-solicitud";
import { SelectorCamposSolicitud } from "./selector-campos-solicitud";

function montar(codigo: keyof typeof SECCIONES_DEF, valor: string[] = []) {
  const onCambio = vi.fn();
  render(
    <ul>
      <SelectorCamposSolicitud
        seccion={SECCIONES_DEF[codigo]}
        requiereSoporte={false}
        valor={valor}
        onCambio={onCambio}
      />
    </ul>,
  );
  return onCambio;
}

describe("SelectorCamposSolicitud (paso 1)", () => {
  it("en el grupo familiar ofrece Agregar, Corregir y Quitar, no campos sueltos", () => {
    montar("familiar");
    expect(screen.getByRole("checkbox", { name: "Grupo familiar: Agregar" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Grupo familiar: Corregir" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Grupo familiar: Quitar" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Primer nombre/ })).toBeNull();
    // La casilla simple de la misma sección (¿Tiene hijos?) se conserva.
    expect(screen.getByRole("checkbox", { name: /Tiene hijos/ })).toBeInTheDocument();
  });

  it("marcar Agregar devuelve la clave de acción y respeta lo ya marcado", async () => {
    const onCambio = montar("familiar", ["employee.telefono_movil"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Grupo familiar: Agregar" }));
    expect(onCambio).toHaveBeenCalledWith(["employee.telefono_movil", "familiar.@CREAR"]);
  });

  it("desmarcar quita solo esa acción (se pueden marcar varias)", async () => {
    const onCambio = montar("familiar", ["familiar.@CREAR", "familiar.@ELIMINAR"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Grupo familiar: Quitar" }));
    expect(onCambio).toHaveBeenCalledWith(["familiar.@CREAR"]);
  });

  it("contacto mezcla campos simples (teléfonos) y acciones (contactos de emergencia)", () => {
    montar("contacto");
    expect(screen.getByRole("checkbox", { name: "Contacto: Teléfono móvil" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Contactos de emergencia: Agregar" }),
    ).toBeInTheDocument();
  });

  it("la sección Identidad no expone la cédula y el esquema no la exige (O49)", () => {
    const campos = SECCIONES_DEF.identidad.entidades[0].campos.map((c) => c.campo);
    expect(campos).not.toContain("cedulaidentidad");

    const resultado = identidadSchema.safeParse({
      nombres: "ANA",
      apellidos: "PEREZ",
      fecha_nacimiento: "1990-01-01",
      estadoCivil_id: undefined,
      carnet_patria: "",
      carnet_patria_serial: "",
    });
    expect(resultado.success).toBe(true);
  });

  it("las secciones simples siguen mostrando sus campos", () => {
    montar("contacto");
    expect(screen.getByRole("checkbox", { name: "Contacto: Teléfono móvil" })).toBeInTheDocument();
  });

  it("vivienda tiene una sola casilla «Actualizar mi vivienda», sin campos sueltos", () => {
    montar("vivienda");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "Actualizar mi vivienda" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Dirección exacta/ })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Agregar/ })).toBeNull();
  });

  it("marcar la casilla de vivienda habilita todos sus campos y respeta lo ya marcado", async () => {
    const onCambio = montar("vivienda", ["employee.telefono_movil"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Actualizar mi vivienda" }));
    const claves = SECCIONES_DEF.vivienda.entidades[0].campos.map((c) => `datos_vivienda.${c.campo}`);
    expect(onCambio).toHaveBeenCalledWith(["employee.telefono_movil", ...claves]);
  });

  it("desmarcar la casilla de vivienda quita todos sus campos y nada más", async () => {
    const claves = SECCIONES_DEF.vivienda.entidades[0].campos.map((c) => `datos_vivienda.${c.campo}`);
    const onCambio = montar("vivienda", ["employee.telefono_movil", ...claves]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Actualizar mi vivienda" }));
    expect(onCambio).toHaveBeenCalledWith(["employee.telefono_movil"]);
  });
});

describe("SelectorCamposSolicitud — O48 bloqueo y espera", () => {
  const seccion = SECCIONES_DEF.contacto;

  it("deshabilita la sección bloqueada y muestra el enlace a la solicitud", () => {
    render(
      <ul>
        <SelectorCamposSolicitud
          seccion={seccion}
          requiereSoporte={false}
          valor={[]}
          onCambio={vi.fn()}
          bloqueos={[
            {
              clave: "contacto",
              seccion: "contacto",
              solicitud_id: "sol-1",
              fecha: "01/11/2026",
              mensaje: "Ya tienes una solicitud pendiente sobre Contactos.",
            },
          ]}
        />
      </ul>,
    );

    expect(
      screen.getByRole("checkbox", { name: /Contacto: Teléfono móvil/i }),
    ).toBeDisabled();
    expect(screen.getByText(/Ya tienes una solicitud pendiente/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver solicitud/i })).toHaveAttribute(
      "href",
      "/autogestion/solicitudes/sol-1",
    );
  });

  it("deshabilita solo las acciones sujetas a la espera", () => {
    render(
      <ul>
        <SelectorCamposSolicitud
          seccion={seccion}
          requiereSoporte={false}
          valor={[]}
          onCambio={vi.fn()}
          esperas={[
            {
              seccion: "contacto",
              hasta: "2026-12-01",
              dias: 20,
              acciones: ["corregir"],
              mensaje: "Podrás volver a solicitar cambios en Contactos.",
            },
          ]}
        />
      </ul>,
    );

    expect(
      screen.getByRole("checkbox", { name: /Contacto: Teléfono móvil/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /Contactos de emergencia: Corregir/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /Contactos de emergencia: Agregar/i }),
    ).toBeEnabled();
    expect(screen.getByText(/Podrás volver a solicitar/i)).toBeInTheDocument();
  });

  it("deduplica los avisos por solicitud_id en la sección (PRUEBAS-USUARIO 1)", () => {
    render(
      <ul>
        <SelectorCamposSolicitud
          seccion={seccion}
          requiereSoporte={false}
          valor={[]}
          onCambio={vi.fn()}
          alcance="seccion"
          bloqueos={[
            {
              clave: "contacto",
              seccion: "contacto",
              solicitud_id: "sol-1",
              fecha: "01/11/2026",
              mensaje: "Ya tienes una solicitud pendiente sobre Contactos.",
            },
            {
              clave: "employee.telefono_movil",
              seccion: "contacto",
              solicitud_id: "sol-1",
              fecha: "01/11/2026",
              mensaje: "Ya tienes una solicitud pendiente sobre Contactos.",
            },
          ]}
        />
      </ul>,
    );

    // Debe mostrar exactamente un aviso por solicitud_id, no dos
    const avisos = screen.getAllByText(/Ya tienes una solicitud pendiente/i);
    expect(avisos).toHaveLength(1);
    const enlaces = screen.getAllByRole("link", { name: /Ver solicitud/i });
    expect(enlaces).toHaveLength(1);
  });

  it("con alcance 'registro' muestra el aviso junto al registro bloqueado y no repetido por sección (PRUEBAS-USUARIO 1)", () => {
    render(
      <ul>
        <SelectorCamposSolicitud
          seccion={seccion}
          requiereSoporte={false}
          valor={[]}
          onCambio={vi.fn()}
          alcance="registro"
          bloqueos={[
            {
              clave: "employee.telefono_movil",
              seccion: "contacto",
              solicitud_id: "sol-99",
              fecha: "08/11/2026",
              mensaje: "Ya tienes una solicitud pendiente sobre Contactos.",
            },
          ]}
        />
      </ul>,
    );

    // El checkbox bloqueado debe estar deshabilitado
    expect(
      screen.getByRole("checkbox", { name: /Contacto: Teléfono móvil/i }),
    ).toBeDisabled();

    // El otro checkbox no debe estar deshabilitado
    expect(
      screen.getByRole("checkbox", { name: /Contacto: Teléfono de habitación/i }),
    ).toBeEnabled();

    // El aviso debe estar visible junto al control y no duplicado
    const avisos = screen.getAllByText(/Ya tienes una solicitud pendiente/i);
    expect(avisos).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Ver solicitud/i })).toHaveAttribute(
      "href",
      "/autogestion/solicitudes/sol-99",
    );
  });
});
