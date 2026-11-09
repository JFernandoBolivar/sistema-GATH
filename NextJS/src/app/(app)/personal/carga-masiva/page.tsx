import { Metadata } from "next";
import { CargaMasivaPage } from "@/modules/carga-masiva/ui/carga-masiva-page";

export const metadata: Metadata = {
  title: "Carga Masiva de Personal | GATH",
  description: "Asistente de importación masiva por Excel con validación en seco, historial y reversión.",
};

/** Thin wrapper (R10): ruta de carga masiva de personal (O28-F3). */
export default function CargaMasivaRoutePage() {
  return <CargaMasivaPage />;
}
