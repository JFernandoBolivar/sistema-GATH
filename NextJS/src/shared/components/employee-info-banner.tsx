"use client";

import { CircleAlert } from "lucide-react";
import { ReactNode } from "react";

interface EmployeeSummary {
  nombres: string;
  apellidos?: string;
  cedulaidentidad: string;
}

interface EmployeeInfoBannerProps {
  employee: EmployeeSummary | null;
  hasSearched: boolean;
  isLoading: boolean;
  extraFields?: { label: string; value: string }[];
  children?: ReactNode;
}

export function EmployeeInfoBanner({
  employee,
  hasSearched,
  isLoading,
  extraFields,
  children,
}: EmployeeInfoBannerProps) {
  if (isLoading || !hasSearched) return null;

  if (!employee) {
    return (
      <div className="border-2 border-red-400/45 bg-red-200/40 rounded-sm p-2 flex items-center gap-2">
        <CircleAlert className="h-4 w-4 text-red-600" />
        <span className="text-red-700">Cédula Inválida</span>
      </div>
    );
  }

  return (
    <div className="border-2 border-blue-400/45 bg-blue-200/40 rounded-sm p-2">
      <div className="flex flex-row gap-2 flex-wrap">
        <p>Nombres: {employee.nombres}</p>
        {employee.apellidos && <p>Apellidos: {employee.apellidos}</p>}
        <p>Cédula: {employee.cedulaidentidad}</p>
      </div>
      {extraFields?.map(
        (field, i) =>
          field.value && (
            <p key={i}>
              {field.label}: {field.value}
            </p>
          )
      )}
      {children}
    </div>
  );
}
