"use client";

/**
 * Página del flujo "Crear Ub. Administrativa" (/organizacion/dependencias).
 * Paridad con el legado (`crear-ubicacion/` + `create-dependency.tsx`):
 * - PageLayout con título "Gestión de Ubicaciones Administrativas"
 * - Formulario jerárquico con switches para D/O/G, Dirección de Línea y Coordinación
 * - Pestaña para administración/listado de dependencias existentes
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Network, PlusCircle, ListFilter } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import type { DependenciaDTO } from "../application/dtos/organizacion-dto";
import { getDependenciasAction } from "../infrastructure/actions/organizacion-actions";
import PageLayout from "@/components/layout/page-layout";
import CreateDependency from "./create-dependency";
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
    <PageLayout
      title="Gestión de Ubicaciones Administrativas"
      description="Registre Nuevas Ubicaciones Administrativas Para Trabajadores"
    >
      <div className="flex flex-col gap-4 mt-2">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="size-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-semibold tracking-tight">Dependencias</h2>
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
              Crear Ub. Administrativa
            </TabsTrigger>
            <TabsTrigger value="listado" className="flex items-center gap-1.5">
              <ListFilter className="size-4" aria-hidden="true" />
              Listado de Dependencias ({dependencias.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crear">
            <CreateDependency onSuccess={cargar} />
          </TabsContent>

          <TabsContent value="listado">
            <DependenciaAdmin dependencias={dependencias} onChanged={cargar} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
