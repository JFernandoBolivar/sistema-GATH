"use client";

import PageLayout from "@/components/layout/page-layout";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import Loading from "@/shared/ui/components/loading";
import type { RolDTO } from "@/modules/identidad/application/dtos/usuario-dto";
import { getRolesAction } from "@/modules/identidad/infrastructure/actions/usuario-actions";
import TableRole from "@/modules/identidad/ui/components/table-role";

export default function RolesPage() {
  const [roles, setRoles] = useState<RolDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const data = await getRolesAction();
      setRoles(data);
    } catch {
      toast.error("Error al cargar roles");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  return (
    <PageLayout title="Roles">
      {isLoading ? <Loading /> : <TableRole roles={roles} onRefresh={loadRoles} />}
    </PageLayout>
  );
}
