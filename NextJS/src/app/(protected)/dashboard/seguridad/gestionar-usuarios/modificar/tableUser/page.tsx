import { getColumns } from "./columns";
import { DataTable } from "./data-table";
import { Depart, Role, UserSystem } from "@/app/types/types";

export default function TableUser({
  user,
  roles,
  departamentos,
}: {
  user: UserSystem[];
  roles: Role[];
  departamentos: Depart[];
}) {
  return (
    <div>
      <DataTable columns={getColumns(roles, departamentos)} data={user || []} />
    </div>
  );
}
