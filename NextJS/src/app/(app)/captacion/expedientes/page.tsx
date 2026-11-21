import { BandejaExpedientesView } from "@/modules/captacion/ui/views/bandeja-expedientes-view";

export const metadata = {
  title: "Bandeja de Captación",
  description: "Expedientes de postulantes en revisión de Captación.",
};

/** Thin wrapper (R10): la bandeja vive en el módulo `captacion`. */
export default function Page() {
  return <BandejaExpedientesView />;
}
