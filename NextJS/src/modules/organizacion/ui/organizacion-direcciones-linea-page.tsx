"use client";

/**
 * Página del flujo "Crear Direcciones" (/organizacion/direcciones-linea).
 * Paridad con el legado (`crear-ubicacion-administrativa-direccion/` + `create-direction-dependency.tsx`):
 * - PageLayout con título "Crear Direcciones Administrativas"
 * - Selectores jerárquicos y RadioGroup para D/O/G, División/Línea y Coordinación
 * - Pestaña con listado administrativo de direcciones de línea
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Network, PlusCircle, ListFilter } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import type { DireccionGeneralDTO, DireccionLineaDTO } from "../application/dtos/organizacion-dto";
import {
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
} from "../infrastructure/actions/organizacion-actions";
import PageLayout from "@/components/layout/page-layout";
import CreateDirectionDependency from "./create-direction-dependency";
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
            <Link href="/organizacion">
              <ArrowLeft className="size-4 mr-1" aria-hidden="true" /> Volver a Organización
            </Link>
          </Button>
        </header>

        <Tabs defaultValue="crear" className="w-full">
          <TabsList className="mb-2">
            <TabsTrigger value="crear" className="flex items-center gap-1.5">
              <PlusCircle className="size-4" aria-hidden="true" />
              Crear Direcciones
            </TabsTrigger>
            <TabsTrigger value="listado" className="flex items-center gap-1.5">
              <ListFilter className="size-4" aria-hidden="true" />
              Listado de Direcciones ({items.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crear">
            <CreateDirectionDependency onSuccess={cargar} />
          </TabsContent>

          <TabsContent value="listado">
            <DireccionLineaAdmin dirGenerales={dirGenerales} items={items} onChanged={cargar} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
