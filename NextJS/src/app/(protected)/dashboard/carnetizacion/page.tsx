"use client";
import PageLayout from "@/components/layout/page-layout";
import { useSession } from "next-auth/react";

export default function CarnetizacionPage() {
  const { data: session } = useSession();
  return (
    <PageLayout>
      <h1 className="text-8xl text-center text-clip text-transparent bg-clip-text from-cyan-900 bg-linear-to-r to-purple-500 animate-gradient mt-20 animate-bounce">
        Sistema de <span className="underline">Carnetización</span>
      </h1>
      <h2 className="text-center text-6xl text-clip text-transparent bg-clip-text from-blue-600 bg-linear-to-r to-blue-900 select-none animate-pulse">
        {session?.user.name}
      </h2>
      <p className="text-center text-xl text-gray-500 mt-4">
        Generación y gestión de carnets del personal de CONATEL
      </p>
    </PageLayout>
  );
}
