import type { Metadata } from "next";
import { VerificarCarnetQrView } from "@/modules/carnetizacion/ui/views/verificar-carnet-qr-view";

interface Props {
  params: Promise<{ hash: string }>;
}

export const metadata: Metadata = {
  title: "Verificación de Credencial Institucional",
  description: "Ficha oficial de verificación y autenticación del carnet institucional.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function VerificarCarnetPage({ params }: Props) {
  const { hash } = await params;
  return (
    <main className="min-h-svh bg-muted/20 py-8 px-4 flex flex-col items-center justify-center">
      <VerificarCarnetQrView securityHash={hash} />
    </main>
  );
}
