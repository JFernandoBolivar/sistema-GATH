import { BandejaIngresosView } from "@/modules/direccion/ui/views/bandeja-ingresos-view";

export const metadata = {
  title: "Ingresos | Dirección General",
  description: "Puntos de Cuenta de ingreso pendientes de decisión.",
};

/** Thin wrapper (R10): la bandeja vive en el módulo `direccion`. */
export default function Page() {
  return <BandejaIngresosView />;
}
