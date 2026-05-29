"use client";
import { UseFormReturn } from "react-hook-form";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface SearchFormValues {
  query: string;
}

interface Props {
  form: UseFormReturn<SearchFormValues>;
  isLoading: boolean;
  queryLength: number;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (values: SearchFormValues) => void;
}

export default function SearchForm({
  form,
  isLoading,
  queryLength,
  onInputChange,
  onSubmit,
}: Props) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
        <FormField
          control={form.control}
          name="query"
          render={({ field }) => (
            <FormItem className="relative flex-1">
              <FormControl>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ingrese cédula o nombre del trabajador..."
                    className="pl-10 flex-1"
                    autoFocus
                    {...field}
                    onChange={onInputChange}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading || queryLength < 2}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Buscar
        </Button>
      </form>
    </Form>
  );
}
