"use client";
import PageLayout from "@/components/layout/page-layout";
import useSWR from "swr";
import Loading from "../../gestion-trabajadores/components/loading/loading";
import { getRole } from "../api/getInfo";
import TableRole from "./tableRole/page";

export default function RolesPage() {
  const { data: role, isLoading: isLoadingRole } = useSWR(
    "role",
    async () => await getRole(),
  );
  return (
    <PageLayout title="Roles">
      {isLoadingRole ? <Loading /> : <TableRole role={role?.data ?? []} />}
    </PageLayout>
  );
}
