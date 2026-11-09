"use client";

import BandejaNotificacionesPage from "@/modules/notificaciones/ui/bandeja-notificaciones-page";
import { useGuia } from "@/shared/ui/guias";
import { GUIA_NOTIFICACIONES } from "../guias/definiciones-guias";
import { useRegistrarGuia } from "../guias/contexto-guia";

/** Bandeja de notificaciones dentro de Autogestión, con su guía registrada. */
export function BandejaAutogestionConGuia() {
  const { iniciarGuia } = useGuia({ guia: GUIA_NOTIFICACIONES, autoIniciar: true });
  useRegistrarGuia(iniciarGuia);
  return <BandejaNotificacionesPage modulo="autogestion" />;
}
