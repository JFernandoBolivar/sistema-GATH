import type { Metadata } from "next";
import { ListaPlantillasView } from "@/modules/documentos/ui/views/lista-plantillas-view";

export const metadata: Metadata = {
  title: "Documentos digitales | GATH",
  description: "Plantillas de documentos: formularios propios y formatos de terceros sobre PDF.",
};

export default function Page() {
  return <ListaPlantillasView />;
}
