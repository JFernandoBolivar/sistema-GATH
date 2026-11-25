import type { Metadata } from "next";
import { ConfiguracionProcesoIngresoPage } from "@/modules/configuracion/ui/configuracion-proceso-ingreso-page";

export const metadata: Metadata = {
  title: "Proceso de ingreso | GATH",
  description: "Etapas del ingreso de personal que se hacen dentro del sistema.",
};

/** Thin wrapper (R10): misma pantalla que Configuración, dentro de Gestión de Trabajadores. */
export default function Page() {
  return <ConfiguracionProcesoIngresoPage />;
}
