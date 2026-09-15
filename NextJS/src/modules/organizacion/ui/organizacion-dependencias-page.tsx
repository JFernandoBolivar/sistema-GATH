"use client";

/**
 * Página del flujo "dependencia" (uno de los 4 flujos separados de
 * ubicación administrativa), en ruta propia `/organizacion/dependencias`,
 * paridad estructural con el legado (`crear-ubicacion/` +
 * `actualizar-ubicacion/`, cada nivel jerárquico con su propio espacio).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";

import { Button } from "@/shared/ui/components/button";

import type { DependenciaDTO } from "../application/dtos/organizacion-dto";
import { getDependenciasAction } from "../infrastructure/actions/organizacion-actions";
import DependenciaAdmin from "./dependencia-admin";

export default function OrganizacionDependenciasPage() {
  const [dependencias, setDependencias] = useState<DependenciaDTO[]>([]);

  const cargar = () => {
    getDependenciasAction().then(setDependencias);
  };

  useEffect(() => {
    cargar();
  }, []);

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/organizacion"><ArrowLeft className="size-4" aria-hidden="true" /> Organización</Link>
        </Button>
      </header>
      <div className="flex items-center gap-2">
        <Network className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Dependencias</h1>
      </div>
      <DependenciaAdmin dependencias={dependencias} onChanged={cargar} />
    </section>
  );
}
