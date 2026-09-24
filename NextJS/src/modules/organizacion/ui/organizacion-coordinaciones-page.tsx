"use client";

/**
 * Página del flujo "Actualizar Ub. Administrativas" (/organizacion/coordinaciones).
 * Paridad con el legado (`actualizar-ubicacion/page.tsx`):
 * - PageLayout con título "Actualizar Información De Dependencias"
 * - Pestañas de actualización para D/O/G, División/Coordinación, Coordinación y Dependencia
 * - Pestaña con listado administrativo de coordinaciones
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit3, ListFilter, Network } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import type { CoordinacionDTO, DireccionLineaDTO } from "../application/dtos/organizacion-dto";
import {
  getCoordinacionesAction,
  getDireccionesLineaAction,
} from "../infrastructure/actions/organizacion-actions";
import PageLayout from "@/components/layout/page-layout";
import ActualizarUbicacionView from "./actualizar-ubicacion-view";
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
            <Link href="/organizacion">
              <ArrowLeft className="size-4 mr-1" aria-hidden="true" /> Volver a Organización
            </Link>
          </Button>
        </header>

        <Tabs defaultValue="actualizar" className="w-full">
          <TabsList className="mb-2">
            <TabsTrigger value="actualizar" className="flex items-center gap-1.5">
              <Edit3 className="size-4" aria-hidden="true" />
              Actualizar Ub. Administrativas
            </TabsTrigger>
            <TabsTrigger value="listado" className="flex items-center gap-1.5">
              <ListFilter className="size-4" aria-hidden="true" />
              Listado de Coordinaciones ({items.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actualizar">
            <ActualizarUbicacionView onUpdated={cargar} />
          </TabsContent>

          <TabsContent value="listado">
            <CoordinacionAdmin dirLinea={dirLinea} items={items} onChanged={cargar} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
