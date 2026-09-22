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
import PageLayout from "@/components/layout/page-layout";
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
    <PageLayout
      title="Actualizar Información De Dependencias"
      description="Gestione las Coordinaciones de la Institución"
    >
      <div className="flex flex-col gap-4 mt-2">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="size-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-semibold tracking-tight">Coordinaciones</h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/organizacion"><ArrowLeft className="size-4 mr-1" aria-hidden="true" /> Volver a Organización</Link>
          </Button>
        </header>
        <CoordinacionAdmin dirLinea={dirLinea} items={items} onChanged={cargar} />
      </div>
    </PageLayout>
  );
}
