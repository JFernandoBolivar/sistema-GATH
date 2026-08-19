import { Role } from "@/app/types/types";
import { columns } from "./columns";
import { DataTable } from "./data-table";

export default function TableRole({ role }: { role: Role[] }) {
  return (
    <div>
      <DataTable columns={columns} data={role || []} />
    </div>
  );
}
