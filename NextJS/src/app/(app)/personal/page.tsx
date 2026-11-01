"use client";

import { useSession } from "next-auth/react";

import PageLayout from "@/components/layout/page-layout";

export default function PersonalWelcomePage() {
  const { data: session } = useSession();

  return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center">
        <h1 className="mt-8 max-w-full break-words text-center text-4xl text-transparent bg-clip-text from-cyan-900 bg-linear-to-r to-purple-500 sm:mt-20 sm:text-8xl">
          Bienvenid@ a <span className="underline">GATH</span>
        </h1>
        <h2 className="mt-4 max-w-full break-words text-center text-2xl text-transparent bg-clip-text from-blue-600 bg-linear-to-r to-blue-900 select-none sm:text-6xl">
          {session?.user?.name}
        </h2>
        <p className="mt-4 max-w-full px-4 text-center text-base text-muted-foreground sm:text-xl">
          Gestión y Visualización de la Información de los Trabajadores de CONATEL
        </p>
      </div>
    </PageLayout>
  );
}
