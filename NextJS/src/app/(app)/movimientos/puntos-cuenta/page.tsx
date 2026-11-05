import type { Metadata } from "next";
import { PuntosCuentaPage } from "@/modules/puntocuenta/ui/puntos-cuenta-page";

export const metadata: Metadata = {
  title: "Puntos de Cuenta | Movimientos | GATH",
  description: "Consulta y descarga de puntos de cuenta generados por movimientos de personal.",
};

export default function Page() {
  return <PuntosCuentaPage />;
}
