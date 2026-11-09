"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import z from "zod";

import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

const schemaSearchEmployee = z.object({ searchEmployeeForm: z.string().trim() });

interface EmployeeSearchFormProps {
  onSearch: (cedula: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function EmployeeSearchForm({
  onSearch,
  label = "Buscar Trabajador",
  placeholder = "00000000",
  disabled = false,
}: EmployeeSearchFormProps) {
  const form = useForm({
    resolver: zodResolver(schemaSearchEmployee),
    defaultValues: { searchEmployeeForm: "" },
  });

  const handleSearch = (values: z.infer<typeof schemaSearchEmployee>) => {
    if (!values.searchEmployeeForm) return;
    onSearch(values.searchEmployeeForm);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSearch)} className="flex flex-row items-end gap-2 w-full">
      <div className="flex-1 flex flex-col gap-1.5">
        <Label htmlFor="searchEmployeeForm">{label}</Label>
        <Input
          id="searchEmployeeForm"
          type="text"
          placeholder={placeholder}
          {...form.register("searchEmployeeForm")}
          disabled={disabled}
          className="bg-white"
        />
      </div>
      <Button type="submit" className="cursor-pointer shrink-0" disabled={disabled}>
        <Search className="size-4" />
      </Button>
    </form>
  );
}

export default EmployeeSearchForm;
