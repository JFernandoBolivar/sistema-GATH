"use client";

/**
 * Página del flujo "dirección general" (uno de los 4 flujos separados de
 * ubicación administrativa), en ruta propia
 * `/organizacion/direcciones-generales`.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";

import { Button } from "@/shared/ui/components/button";

import type { DependenciaDTO, DireccionGeneralDTO } from "../application/dtos/organizacion-dto";
import {
  getDependenciasAction,
  getDireccionesGeneralesAction,
} from "../infrastructure/actions/organizacion-actions";
import DireccionGeneralAdmin from "./direccion-general-admin";

export default function OrganizacionDireccionesGeneralesPage() {
  const [dependencias, setDependencias] = useState<DependenciaDTO[]>([]);
  const [items, setItems] = useState<DireccionGeneralDTO[]>([]);

  const cargar = () => {
    getDependenciasAction().then(setDependencias);
    getDireccionesGeneralesAction().then(setItems);
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
        <h1 className="text-xl font-semibold tracking-tight">Direcciones generales</h1>
      </div>
      <DireccionGeneralAdmin dependencias={dependencias} items={items} onChanged={cargar} />
    </section>
  );
}
