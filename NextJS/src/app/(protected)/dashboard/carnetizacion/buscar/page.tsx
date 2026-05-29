"use client";
import PageLayout from "@/components/layout/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IdCard,
  Search,
  Loader2,
  User,
  CheckCircle2,
  XCircle,
  Printer,
  Hash,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { searchEmployees } from "../api/getInfoCarnet";
import { schemaSearch } from "../schemas/schemaSearch";
import SearchForm from "../components/forms/search-form";
import type { EmployeeCarnet } from "../types/carnetizacion";
import { toast } from "sonner";

function truncarNombre(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 3) return nombreCompleto;
  const nombres = partes.slice(0, 2);
  const apellidos = partes.slice(-2);
  return [...nombres, ...apellidos].join(" ");
}

export default function BuscarPersonalPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(schemaSearch),
    defaultValues: { query: "" },
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSWR(
    debouncedQuery.length >= 2 ? ["search", debouncedQuery] : null,
    () => searchEmployees(debouncedQuery),
    {
      onError: (err) => toast.error(`Error al buscar personal: ${err.message}`),
    },
  );

  const onSubmit = (values: { query: string }) => {
    setQuery(values.query);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    form.setValue("query", value);
    if (value.length < 2) setDebouncedQuery("");
  };

  const hasSearched = debouncedQuery.length >= 2;

  return (
    <PageLayout
      title="Buscar Personal"
      description="Busca un trabajador por cédula o nombre para generar su carnet"
    >
      <div className="max-w-3xl mx-auto mt-6 space-y-6">
        <Card className="shadow-md border-0">
          <CardHeader className=" to-indigo-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 ">
              <Search className="h-5 w-5" />
              Búsqueda de Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <SearchForm
              form={form}
              isLoading={isLoading}
              queryLength={query.length}
              onInputChange={handleInputChange}
              onSubmit={onSubmit}
            />
          </CardContent>
        </Card>

        <div className="space-y-3">
          {isLoading && (
            <div className="text-center py-12">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600" />
              <p className="text-sm text-muted-foreground mt-3">
                Buscando en SAGP...
              </p>
            </div>
          )}

          {!isLoading && hasSearched && results?.length === 0 && (
            <Card className="shadow-sm">
              <CardContent className="text-center py-12">
                <User className="h-14 w-14 mx-auto text-gray-300" />
                <p className="text-lg font-medium text-gray-500 mt-4">
                  Sin resultados
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  No se encontraron trabajadores para &quot;{debouncedQuery}&quot;
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading &&
            results?.map((emp: EmployeeCarnet) => (
              <Card
                key={emp.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:border-blue-400 shadow-sm border"
                onClick={() =>
                  router.push(
                    `/dashboard/carnetizacion/generar?cedula=${emp.cedula}`,
                  )
                }
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`rounded-full p-3 ${
                          emp.tiene_carnet
                            ? "bg-emerald-100"
                            : "bg-gray-100"
                        }`}
                      >
                        <IdCard
                          className={`h-6 w-6 ${
                            emp.tiene_carnet
                              ? "text-emerald-700"
                              : "text-gray-500"
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {truncarNombre(emp.nombre_completo)}
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                          <span>C.I: {emp.cedula}</span>
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {emp.codigo}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {emp.cargo} — {emp.departamento}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {emp.tiene_carnet ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Carnet activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Sin carnet
                        </Badge>
                      )}
                      <div className="flex items-center gap-2">
                        {emp.total_solicitudes > 0 && (
                          <span className="text-xs text-muted-foreground">
                            <Printer className="h-3 w-3 inline mr-1" />
                            {emp.total_solicitudes}{" "}
                            {emp.total_solicitudes === 1
                              ? "emisión"
                              : "emisiones"}
                          </span>
                        )}
                        <Button size="sm" variant="outline">
                          Generar Carnet
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </PageLayout>
  );
}
