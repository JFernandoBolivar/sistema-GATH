/**
 * Feedback de diseño en /dashboard/autogestion/consultar:
 * 1) La columna "APN" de la tabla muestra "0a 0m" para un trabajador sin
 *    antecedentes de servicio cerrados (feo/confuso, según QA).
 * 2) El detalle ("Ver") del mismo trabajador muestra "0a 0m 0d" en
 *    "Tiempo APN:".
 *
 * Causa raíz: `total_apn` viene del backend como un objeto
 * `{ years, months, days }` que SIEMPRE es truthy, incluso cuando los tres
 * valores son 0 (backend: AUTOGESTION/serializers/serializers_encuestas.py
 * `get_total_apn`, que solo suma antecedentes CERRADOS — ver
 * RAC/utils/tiempo_servicio.py `calcular_total_apn` — por diseño excluye el
 * cargo actual/abierto, así que un trabajador que solo tiene su cargo
 * vigente y ningún antecedente cerrado da legítimamente 0/0/0).
 *
 * El bug está en el frontend: page.tsx hace
 *   `emp.total_apn ? \`${emp.total_apn.years}a ${emp.total_apn.months}m\` : "N/A"`
 * (línea 618, tabla) y lo mismo con "d" en DetalleCenso (línea 97-100):
 * comprueba que el OBJETO exista, no que el valor sea distinto de cero, así
 * que el caso 0/0/0 legítimo cae en la rama "con datos" y se ve "0a 0m".
 *
 * Curiosamente el Excel (AUTOGESTION/serializers/serializers_encuestas.py
 * `CensoExcelRowSerializer.get_apn`) ya contempla este caso y devuelve la
 * cadena "0" en vez de "0 años, 0 meses, 0 días" — por eso el Excel NO
 * repite el mismo problema, solo la UI.
 *
 * Estos tests documentan el defecto de la UI tal como está hoy: deben
 * fallar hasta que se corrija la condición para tratar 0/0/0 como "sin
 * antecedentes previos" (p. ej. "N/A" o un texto explícito), igual que ya
 * hace el Excel. No se modificó código de producción junto con este archivo.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import ConsultarCensoPage from "./page";
import type { CensoEmpleadoItem } from "../api/getInfoAutogestion";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
  apiFetchGet: vi.fn(),
  apiFetchFormData: vi.fn(),
  apiFetchBlob: vi.fn(),
}));

const EMPLEADO_SIN_ANTECEDENTES_CERRADOS: CensoEmpleadoItem = {
  id: 1,
  cedula: "15218848",
  nombres: "ORQUIDEA COROMOTO",
  apellidos: "VERENZUELA BOLIVAR",
  fecha_nacimiento: "1990-01-01",
  carnet_patria: null,
  cargos: [],
  datos_vivienda: null,
  // Backend: sin antecedentes cerrados (solo el cargo actual, que no cuenta
  // para "total_apn" por diseño) -> {0,0,0}, pero SIGUE siendo un objeto truthy.
  total_apn: { years: 0, months: 0, days: 0 },
  fecha_ingreso_organismo: null,
  preguntas: [],
};

vi.mock("../api/getInfoAutogestion", () => ({
  consultarCensoEmpleado: vi.fn(async () => ({
    status: "success",
    message: "",
    data: [EMPLEADO_SIN_ANTECEDENTES_CERRADOS],
  })),
  exportarCensoExcel: vi.fn(),
  exportarCensoExcelConFiltros: vi.fn(),
}));

vi.mock("../../gestion-trabajadores/api/getInfoRac", () => ({
  getDependency: vi.fn(async () => ({ status: "success", message: "", data: [] })),
  getDirectionGeneralById: vi.fn(async () => ({ status: "success", message: "", data: [] })),
  getDirectionLine: vi.fn(async () => ({ status: "success", message: "", data: [] })),
  getCoordination: vi.fn(async () => ({ status: "success", message: "", data: [] })),
  getNominaGeneral: vi.fn(async () => ({ status: "success", message: "", data: [] })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Consultar Censo (columna/detalle APN) sin antecedentes cerrados", () => {
  it("la columna APN de la tabla no debería mostrar '0a 0m' para un trabajador sin antecedentes cerrados", async () => {
    render(<ConsultarCensoPage />);

    const row = await waitFor(() => screen.getByText("15218848").closest("tr")!);

    expect(within(row).queryByText("0a 0m")).not.toBeInTheDocument();
  });

  it("el detalle ('Ver') no debería mostrar 'Tiempo APN: 0a 0m 0d' para un trabajador sin antecedentes cerrados", async () => {
    render(<ConsultarCensoPage />);

    await waitFor(() => screen.getByText("15218848"));
    fireEvent.click(screen.getByRole("button", { name: /ver/i }));

    expect(await screen.findByText(/tiempo apn/i)).toBeInTheDocument();
    expect(screen.queryByText("0a 0m 0d")).not.toBeInTheDocument();
  });
});
