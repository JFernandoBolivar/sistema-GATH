"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import z from "zod";

import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schemaSearchEmployee = z.object({ searchEmployeeForm: z.string() });

interface EmployeeSearchFormProps {
  onSearch: (cedula: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function EmployeeSearchForm({
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSearch)} className="flex flex-row gap-2 w-full">
        <FormField
          control={form.control}
          name="searchEmployeeForm"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <Input type="number" placeholder={placeholder} {...field} disabled={disabled} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" className="self-end cursor-pointer" disabled={disabled}>
          <Search className="h-4 w-4" />
        </Button>
      </form>
    </Form>
  );
}
