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
import PageLayout from "@/components/layout/page-layout";
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
    <PageLayout
      title="Crear Direcciones Generales"
      description="Registre Nuevas Direcciones Generales, Gerencias u Oficinas"
    >
      <div className="flex flex-col gap-4 mt-2">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="size-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-semibold tracking-tight">Direcciones Generales</h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/organizacion"><ArrowLeft className="size-4 mr-1" aria-hidden="true" /> Volver a Organización</Link>
          </Button>
        </header>
        <DireccionGeneralAdmin dependencias={dependencias} items={items} onChanged={cargar} />
      </div>
    </PageLayout>
  );
}
