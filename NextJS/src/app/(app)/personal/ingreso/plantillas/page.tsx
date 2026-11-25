import type { Metadata } from "next";
import { ListaPlantillasView } from "@/modules/documentos/ui/views/lista-plantillas-view";

export const metadata: Metadata = {
  title: "Plantillas de documentos | GATH",
  description: "Plantillas de los documentos del ingreso de personal.",
};

/** Thin wrapper (R10): misma vista que Configuración, dentro de Gestión de Trabajadores. */
export default function Page() {
  return <ListaPlantillasView />;
}
