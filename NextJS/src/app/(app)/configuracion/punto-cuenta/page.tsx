import type { Metadata } from "next";
import { ConfiguracionPuntoCuentaPage } from "@/modules/configuracion/ui/configuracion-punto-cuenta-page";

export const metadata: Metadata = {
  title: "Configuración de Punto de Cuenta | GATH",
  description: "Configuración de procesos y diseño de formato para puntos de cuenta automáticos.",
};

export default function Page() {
  return <ConfiguracionPuntoCuentaPage />;
}
