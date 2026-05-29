import { columns } from "./columns";
import { DataTable } from "./data-table";
import { EmployeeData } from "@/app/types/types";
export default function TablePasive({
  pasiveData,
}: {
  pasiveData: EmployeeData[];
}) {
  return (
    <div>
      <DataTable columns={columns} data={pasiveData || []} />
    </div>
  );
}
