import { Metadata } from "next";
import { CargaMasivaPage } from "@/modules/carga-masiva/ui/carga-masiva-page";

export const metadata: Metadata = {
  title: "Carga Masiva de Pasivos | GATH",
  description: "Importación masiva de personal pasivo por Excel con validación en seco y confirmación de movimientos.",
};

/** Thin wrapper (R10): ruta de carga masiva limitada a la población pasiva (FIX-CARGA1). */
export default function CargaMasivaPasivosRoutePage() {
  return <CargaMasivaPage poblacionFija="PASIVOS" />;
}
