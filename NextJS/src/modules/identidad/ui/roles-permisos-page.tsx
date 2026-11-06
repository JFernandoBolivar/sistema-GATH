"use client";

import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { BadgePlus } from "lucide-react";

import Loading from "@/shared/ui/components/loading";
import { Button } from "@/shared/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import type { RolDTO } from "../application/dtos/usuario-dto";
import { getRolesAction } from "../infrastructure/actions/usuario-actions";
import TableRole from "./components/table-role";
import MatrizPermisosPage from "./matriz-permisos-page";
import RolDialog from "./rol-dialog";

type Pestana = "roles" | "matriz";

export function RolesPermisosPage({
  pestanaInicial = "roles",
  rolInicial,
}: {
  pestanaInicial?: Pestana;
  rolInicial?: number;
}) {
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const { data: session } = useSession();
  const puedeCrear = tienePermiso(session?.user?.permisos, "identidad.crear_roles");
  const [roles, setRoles] = useState<RolDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [, startTransition] = useTransition();

  const cargarRoles = () => {
    startTransition(async () => {
      setCargando(true);
      try {
        setRoles(await getRolesAction());
      } catch {
        toast.error("No fue posible cargar los roles.");
      } finally {
        setCargando(false);
      }
    });
  };

  useEffect(() => {
    cargarRoles();
  }, []);

  return (
    <section className="flex flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Roles y permisos</h1>
          <p className="text-sm text-muted-foreground">
            Administre los roles del sistema y qué puede hacer cada uno.
          </p>
        </div>
        {pestana === "roles" && puedeCrear ? (
          <Button type="button" onClick={() => setDialogoAbierto(true)}>
            <BadgePlus aria-hidden /> Nuevo rol
          </Button>
        ) : null}
      </header>

      <Tabs value={pestana} onValueChange={(valor) => setPestana(valor as Pestana)}>
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="matriz">Matriz de permisos</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="pt-3">
          {cargando ? <Loading /> : <TableRole roles={roles} onRefresh={cargarRoles} />}
        </TabsContent>
        <TabsContent value="matriz" className="pt-3">
          <MatrizPermisosPage rolInicial={rolInicial} />
        </TabsContent>
      </Tabs>

      <RolDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        rolEditando={null}
        onGuardado={() => {
          setDialogoAbierto(false);
          cargarRoles();
        }}
      />
    </section>
  );
}
