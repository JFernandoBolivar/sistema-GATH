/**
 * Feedback de diseño en /dashboard/gestion-trabajadores/personal-trabajador/consultar:
 * "cuando actualizo una informacion no se actualiza en tiempo real sino que
 * tengo que recargar [la página]".
 *
 * Rastreo del flujo real (Ver Detalles -> Actualizar -> FormUpdate*):
 * - Cada formulario de actualización (este, form-basic-info, form-dwelling,
 *   form-academic_training, form-supplementary_training, form-health_profile,
 *   form-update-contrato) SÍ invalida correctamente el cache de SWR de la
 *   tabla llamando `mutate([mutateKey, searchParams])` con la misma key que
 *   usa `consultar/page.tsx` (`["api/empleados", searchParams || ""]`) — eso
 *   ya funciona y este test lo confirma (no hace falta tocar esa parte).
 * - Pero, a diferencia de `form-update-contrato.tsx` (que sí recibe y llama
 *   `onSuccess` para cerrar su Dialog, ver
 *   `.../components/employees/detail-info.tsx:363` y `:429`), el resto de los
 *   formularios de actualización (incluido este, `form-physical_profile.tsx`)
 *   no aceptan ningún callback de éxito y su <Dialog> en `detail-info.tsx`
 *   es no controlado (sin `open`/`onOpenChange`), por lo que se queda abierto
 *   mostrando el formulario ya enviado. El analista solo ve un toast y el
 *   mismo formulario; sin una señal visual de que el modal se cerró/refrescó,
 *   asume que "no pasó nada" y recarga la página para confirmar el cambio
 *   (que en realidad ya estaba guardado y ya estaba revalidado en el cache).
 *
 * Este test documenta ese hueco: hoy no existe forma de que
 * `FormUpdatePhysical` avise a su padre que terminó con éxito. Debe fallar
 * hasta que se agregue (por ejemplo) un prop `onSuccess?: () => void` que se
 * invoque tras un guardado exitoso, igual que ya hace `form-update-contrato.tsx`.
 *
 * No se modificó código de producción junto con este archivo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FormUpdatePhysical from "./form-physical_profile";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
  apiFetchGet: vi.fn(),
  apiFetchFormData: vi.fn(),
  apiFetchBlob: vi.fn(),
}));

vi.mock(
  "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac",
  () => ({
    getTallas: vi.fn(async () => ({ status: "success", message: "", data: [] })),
  }),
);

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("FormUpdatePhysical (Actualizar Información de Vestimenta)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revalida la tabla (mutate con la misma key de consultar/page.tsx) tras guardar con éxito", async () => {
    const mutate = vi.fn();
    const updateInfoEmployee = vi.fn(async () => ({
      success: true as const,
      message: "Actualizado",
    }));

    render(
      <FormUpdatePhysical
        idEmployee="1"
        mutate={mutate}
        updateInfoEmployee={updateInfoEmployee}
        defaultValues={{
          perfil_fisico: { tallaCamisa: 0, tallaPantalon: 0, tallaZapatos: 0 },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));

    await waitFor(() => expect(updateInfoEmployee).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(["api/empleados", ""]),
    );
  });

  it("avisa al padre (onSuccess) para poder cerrar el diálogo tras guardar con éxito, como ya hace FormUpdateContrato", async () => {
    const mutate = vi.fn();
    const onSuccess = vi.fn();
    const updateInfoEmployee = vi.fn(async () => ({
      success: true as const,
      message: "Actualizado",
    }));

    render(
      <FormUpdatePhysical
        idEmployee="1"
        mutate={mutate}
        updateInfoEmployee={updateInfoEmployee}
        onSuccess={onSuccess}
        defaultValues={{
          perfil_fisico: { tallaCamisa: 0, tallaPantalon: 0, tallaZapatos: 0 },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));

    await waitFor(() => expect(updateInfoEmployee).toHaveBeenCalledTimes(1));

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
