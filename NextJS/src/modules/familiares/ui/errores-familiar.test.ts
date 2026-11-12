import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";

import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";

import { MAPA_ERRORES_FAMILIAR } from "./errores-familiar";

function formulario() {
  return renderHook(() =>
    useForm({
      defaultValues: {
        primerNombre: "",
        segundoNombre: null,
        segundoApellido: null,
        perfilSalud: { grupoSanguineoId: 0, alergias: [], patologiasCronicas: [], discapacidades: [] },
      },
    }),
  ).result.current;
}

describe("MAPA_ERRORES_FAMILIAR", () => {
  it("marca el grupo sanguíneo en su campo anidado aunque el objeto esté vacío", () => {
    const form = formulario();

    const sinUbicar = aplicarErroresServidor(
      form,
      { "perfil_salud.grupo_sanguineo_id": ["Seleccione el grupo sanguíneo"] },
      MAPA_ERRORES_FAMILIAR,
    );

    expect(sinUbicar).toEqual([]);
    expect(form.getFieldState("perfilSalud.grupoSanguineoId").error?.message).toBe(
      "Seleccione el grupo sanguíneo",
    );
  });

  it("marca los segundos nombres (los dos errores del «Hay 2 datos por corregir»)", () => {
    const form = formulario();

    const sinUbicar = aplicarErroresServidor(
      form,
      { segundo_nombre: ["Este campo no puede ser nulo."], segundo_apellido: ["Este campo no puede ser nulo."] },
      MAPA_ERRORES_FAMILIAR,
    );

    expect(sinUbicar).toEqual([]);
    expect(form.getFieldState("segundoNombre").error?.message).toBe("Este campo no puede ser nulo.");
    expect(form.getFieldState("segundoApellido").error?.message).toBe("Este campo no puede ser nulo.");
  });

  it("devuelve el texto de los errores que no tienen campo visible", () => {
    const form = formulario();

    const sinUbicar = aplicarErroresServidor(
      form,
      { campo_inexistente: ["No se pudo guardar el familiar."] },
      MAPA_ERRORES_FAMILIAR,
    );

    expect(sinUbicar).toEqual(["No se pudo guardar el familiar."]);
  });
});
