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
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/organizacion"><ArrowLeft className="size-4" aria-hidden="true" /> Organización</Link>
        </Button>
      </header>
      <div className="flex items-center gap-2">
        <Network className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Direcciones de línea</h1>
      </div>
      <DireccionLineaAdmin dirGenerales={dirGenerales} items={items} onChanged={cargar} />
    </section>
  );
}
