"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PageLayout from "@/components/layout/page-layout";
import { EmitirCarnetView } from "@/modules/carnetizacion/ui/views/emitir-carnet-view";

export default function Page() {
  return (
    <Suspense
      fallback={
        <PageLayout title="Emitir Carnet">
          <div className="flex justify-center items-center py-20">
            <Loader2 className="size-10 animate-spin text-primary" />
          </div>
        </PageLayout>
      }
    >
      <EmitirCarnetView />
    </Suspense>
  );
}
