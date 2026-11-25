import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DefinicionFormulario, PlantillaCompleta } from "../../domain/entities/plantilla";
import { CATALOGO } from "../../domain/lib/fixtures";
import { useEditorPlantilla } from "./use-editor-plantilla";

const guardarMock = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../../infrastructure/actions/documentos-actions", () => ({
  guardarPlantillaAction: (...a: unknown[]) => guardarMock(...a),
  publicarPlantillaAction: vi.fn(),
  activarPlantillaAction: vi.fn(),
  duplicarPlantillaAction: vi.fn(),
}));

function crear(id: string, titulo = "Original"): PlantillaCompleta {
  return {
    id,
    codigo: "COD",
    nombre: "Plantilla",
    descripcion: "",
    modo: "formulario",
    proceso: "bajo_demanda",
    proceso_etiqueta: "Bajo demanda",
    firmante: "postulante",
    requiere_firma_clic: false,
    activa: false,
    estado: "borrador",
    ultima_version: null,
    cambios_sin_publicar: false,
    tiene_fondo: false,
    actualizada_en: null,
    definicion: {
      pagina: { tamano: "carta", orientacion: "vertical" },
      encabezado: { tipo: "institucional", titulo, subtitulo: "" },
      bloques: [{ id: "b1", tipo: "seccion", titulo: "A" }],
    },
    campos_propios: [],
    fondo_nombre: null,
    fondo_paginas: [],
  };
}

beforeEach(() => guardarMock.mockReset());

describe("useEditorPlantilla", () => {
  it("no se reinicia cuando SWR devuelve un objeto nuevo con el mismo id", () => {
    const { result, rerender } = renderHook(({ p }) => useEditorPlantilla({ plantilla: p, catalogo: CATALOGO }), {
      initialProps: { p: crear("p1") },
    });
    expect(result.current.dirty).toBe(false);
    act(() => result.current.cambiarDefinicion<DefinicionFormulario>((d) => ({ ...d, encabezado: { ...d.encabezado, titulo: "Editado" } })));
    expect(result.current.dirty).toBe(true);

    // Revalidación de SWR: objeto nuevo, mismo id, contenido distinto del servidor.
    rerender({ p: crear("p1", "Cambio remoto") });
    expect((result.current.borrador!.definicion as DefinicionFormulario).encabezado.titulo).toBe("Editado");
    expect(result.current.dirty).toBe(true);
  });

  it("se siembra de nuevo solo al cambiar el id", () => {
    const { result, rerender } = renderHook(({ p }) => useEditorPlantilla({ plantilla: p, catalogo: CATALOGO }), {
      initialProps: { p: crear("p1") },
    });
    act(() => result.current.cambiarMeta({ nombre: "Otro nombre" }));
    rerender({ p: crear("p2", "Segunda") });
    expect(result.current.borrador!.nombre).toBe("Plantilla");
    expect((result.current.borrador!.definicion as DefinicionFormulario).encabezado.titulo).toBe("Segunda");
    expect(result.current.dirty).toBe(false);
  });

  it("guardar limpia el indicador y no envía el código si ya se publicó", async () => {
    const publicada = { ...crear("p1"), ultima_version: 1, estado: "publicada" as const };
    guardarMock.mockResolvedValue({ success: true, data: publicada });
    const { result } = renderHook(() => useEditorPlantilla({ plantilla: publicada, catalogo: CATALOGO }));
    act(() => result.current.cambiarMeta({ nombre: "Nuevo" }));
    await act(async () => {
      await result.current.guardar();
    });
    expect(guardarMock).toHaveBeenCalledTimes(1);
    expect(guardarMock.mock.calls[0][1]).not.toHaveProperty("codigo");
    expect(guardarMock.mock.calls[0][1].nombre).toBe("Nuevo");
  });

  it("un error 400 con ruta queda en `errores` y conserva los cambios", async () => {
    guardarMock.mockResolvedValue({ success: false, error: "Inválido", status: 400, errores: { "definicion.bloques.0.titulo": ["Es obligatorio."] } });
    const { result } = renderHook(() => useEditorPlantilla({ plantilla: crear("p1"), catalogo: CATALOGO }));
    act(() => result.current.cambiarMeta({ nombre: "X" }));
    await act(async () => {
      await result.current.guardar();
    });
    expect(result.current.errores.some((e) => e.ruta === "bloques.0.titulo")).toBe(true);
    expect(result.current.dirty).toBe(true);
  });

  describe("cambiar el proceso de un borrador", () => {
    const conTabla = (): PlantillaCompleta => {
      const p = crear("p1");
      (p.definicion as DefinicionFormulario).bloques = [
        { id: "t1", tipo: "tabla", titulo: "Carga", coleccion: "familiares", columnas: [], filas_minimas: 1 },
      ];
      p.proceso = "ingreso_ventana2";
      return p;
    };

    it("se rechaza con aviso claro si el diseño usa datos que el proceso nuevo no ofrece", () => {
      const { result } = renderHook(() => useEditorPlantilla({ plantilla: conTabla(), catalogo: CATALOGO }));
      let aplicado = true;
      act(() => {
        aplicado = result.current.cambiarProceso("ingreso_contratacion");
      });
      expect(aplicado).toBe(false);
      expect(result.current.borrador!.proceso).toBe("ingreso_ventana2");
      expect(result.current.errorProceso).toContain("Contratación");
    });

    it("se aplica cuando el diseño es compatible", () => {
      const { result } = renderHook(() => useEditorPlantilla({ plantilla: crear("p1"), catalogo: CATALOGO }));
      act(() => {
        result.current.cambiarProceso("ingreso_contratacion");
      });
      expect(result.current.borrador!.proceso).toBe("ingreso_contratacion");
      expect(result.current.errorProceso).toBeNull();
    });

    it("una plantilla publicada no admite cambiar de proceso", () => {
      const publicada = { ...crear("p1"), ultima_version: 1, estado: "publicada" as const };
      const { result } = renderHook(() => useEditorPlantilla({ plantilla: publicada, catalogo: CATALOGO }));
      act(() => {
        result.current.cambiarProceso("ingreso_contratacion");
      });
      expect(result.current.borrador!.proceso).toBe("bajo_demanda");
      expect(result.current.errorProceso).toMatch(/publicada/);
    });
  });
});
