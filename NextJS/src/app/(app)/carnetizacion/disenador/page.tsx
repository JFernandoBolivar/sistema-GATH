"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { DisenadorView } from "@/modules/carnetizacion/ui/views/disenador-view";

function DisenadorContent() {
  const searchParams = useSearchParams();
  const plantillaId = searchParams.get("plantilla") || searchParams.get("id") || "default";

  return <DisenadorView plantillaId={plantillaId} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <DisenadorContent />
    </Suspense>
  );
}
