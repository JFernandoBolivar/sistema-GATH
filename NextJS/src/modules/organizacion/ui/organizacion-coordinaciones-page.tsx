"use client";

/**
 * Página del flujo "coordinación" (uno de los 4 flujos separados de
 * ubicación administrativa), en ruta propia
 * `/organizacion/coordinaciones`.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";

import { Button } from "@/shared/ui/components/button";

import type { CoordinacionDTO, DireccionLineaDTO } from "../application/dtos/organizacion-dto";
import {
  getCoordinacionesAction,
  getDireccionesLineaAction,
} from "../infrastructure/actions/organizacion-actions";
import CoordinacionAdmin from "./coordinacion-admin";

export default function OrganizacionCoordinacionesPage() {
  const [dirLinea, setDirLinea] = useState<DireccionLineaDTO[]>([]);
  const [items, setItems] = useState<CoordinacionDTO[]>([]);

  const cargar = () => {
    getDireccionesLineaAction().then(setDirLinea);
    getCoordinacionesAction().then(setItems);
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
        <h1 className="text-xl font-semibold tracking-tight">Coordinaciones</h1>
      </div>
      <CoordinacionAdmin dirLinea={dirLinea} items={items} onChanged={cargar} />
    </section>
  );
}
