import type { Metadata } from "next";
import { RecibidoView } from "@/modules/postulacion/ui/recibido-view";

export const metadata: Metadata = { title: "Información recibida · Portal del postulante" };

const NUMERO_VALIDO = /^[A-Za-z0-9-]{1,30}$/;

export default async function RecibidoPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const { n } = await searchParams;
  return <RecibidoView numero={n && NUMERO_VALIDO.test(n) ? n : undefined} />;
}
