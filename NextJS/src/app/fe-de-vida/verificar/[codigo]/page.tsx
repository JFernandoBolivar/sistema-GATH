import type { Metadata } from "next";
import VerificacionConstanciaPage from "@/modules/fe-de-vida/ui/verificacion/verificacion-constancia-page";

export const metadata: Metadata = {
  title: "Verificación de constancia de fe de vida - CONATEL",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return (
    <div className="min-h-full bg-background">
      <VerificacionConstanciaPage codigo={codigo} />
    </div>
  );
}
