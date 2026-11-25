import type { Metadata } from "next";
import { EditorPlantillaView } from "@/modules/documentos/ui/views/editor-plantilla-view";

export const metadata: Metadata = {
  title: "Editor de plantilla | GATH",
  description: "Diseñador de plantillas de documentos digitales.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorPlantillaView id={id} />;
}
