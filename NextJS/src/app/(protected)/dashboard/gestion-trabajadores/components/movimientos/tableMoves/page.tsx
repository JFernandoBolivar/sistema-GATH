import { columns } from "./columns";
import { DataTable } from "./data-table";
import { EmployeeCargoHistory } from "@/app/types/types";
export default function TableMoves({
  movesData,
}: {
  movesData: EmployeeCargoHistory[];
}) {
  return (
    <div>
      <DataTable columns={columns} data={movesData || []} />
    </div>
  );
}
