import { BandejaSolicitudesView } from "@/modules/presupuesto/ui/views/bandeja-solicitudes-view";

export const metadata = {
  title: "Solicitudes de Presupuesto",
  description: "Solicitudes de postulantes por atender en Presupuesto.",
};

/** Thin wrapper (R10): la bandeja vive en el módulo `presupuesto`. */
export default function Page() {
  return <BandejaSolicitudesView />;
}
