"use client";

/**
 * Página del flujo "dirección de línea" (uno de los 4 flujos separados de
 * ubicación administrativa), en ruta propia
 * `/organizacion/direcciones-linea`.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";

import { Button } from "@/shared/ui/components/button";

import type { DireccionGeneralDTO, DireccionLineaDTO } from "../application/dtos/organizacion-dto";
import {
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
} from "../infrastructure/actions/organizacion-actions";
import PageLayout from "@/components/layout/page-layout";
import DireccionLineaAdmin from "./direccion-linea-admin";

export default function OrganizacionDireccionesLineaPage() {
  const [dirGenerales, setDirGenerales] = useState<DireccionGeneralDTO[]>([]);
  const [items, setItems] = useState<DireccionLineaDTO[]>([]);

  const cargar = () => {
    getDireccionesGeneralesAction().then(setDirGenerales);
    getDireccionesLineaAction().then(setItems);
  };

  useEffect(() => {
    cargar();
  }, []);

  return (
    <PageLayout
      title="Crear Direcciones Administrativas"
      description="Registre Nuevas Direcciones de Línea, Divisiones o Coordinaciones"
    >
      <div className="flex flex-col gap-4 mt-2">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="size-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-semibold tracking-tight">Direcciones de Línea</h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/organizacion"><ArrowLeft className="size-4 mr-1" aria-hidden="true" /> Volver a Organización</Link>
          </Button>
        </header>
        <DireccionLineaAdmin dirGenerales={dirGenerales} items={items} onChanged={cargar} />
      </div>
    </PageLayout>
  );
}
