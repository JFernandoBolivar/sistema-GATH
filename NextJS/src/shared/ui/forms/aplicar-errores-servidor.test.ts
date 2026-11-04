import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { aplicarErroresServidor } from "./aplicar-errores-servidor";

function formulario() {
  return renderHook(() =>
    useForm({
      defaultValues: { cedula: "", fechaNacimiento: "", contactos: [{ telefono: "" }, { telefono: "" }] },
    }),
  ).result.current;
}

describe("aplicarErroresServidor", () => {
  it("marca el campo por nombre directo y por camelCase", () => {
    const form = formulario();
    const resto = aplicarErroresServidor(form, {
      cedula: ["Ya registrada."],
      fecha_nacimiento: ["Inválida."],
    });
    expect(resto).toEqual([]);
    expect(form.getFieldState("cedula").error?.message).toBe("Ya registrada.");
    expect(form.getFieldState("fechaNacimiento").error?.message).toBe("Inválida.");
  });

  it("traduce rutas con índice usando el mapa de prefijos", () => {
    const form = formulario();
    aplicarErroresServidor(form, { "contacto_emergencia.1.telefono": ["Teléfono inválido."] }, {
      contacto_emergencia: "contactos",
    });
    expect(form.getFieldState("contactos.1.telefono").error?.message).toBe("Teléfono inválido.");
  });

  it("devuelve los mensajes que no corresponden a ningún campo", () => {
    const form = formulario();
    expect(aplicarErroresServidor(form, { otro: ["Mensaje general."] })).toEqual(["Mensaje general."]);
    expect(aplicarErroresServidor(form, undefined)).toEqual([]);
  });
});
