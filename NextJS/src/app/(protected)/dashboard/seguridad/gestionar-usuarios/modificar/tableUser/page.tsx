import { columns } from "./columns";
import { DataTable } from "./data-table";
import { EmployeeData, UserSystem } from "@/app/types/types";
export default function TableUser({ user }: { user: UserSystem[] }) {
  return (
    <div>
      <DataTable columns={columns} data={user || []} />
    </div>
  );
}
