"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { toast } from "sonner";
import {
  CheckCircle2,
  Hash,
  IdCard,
  Loader2,
  Printer,
  Search,
  User,
  XCircle,
} from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buscarPersonalCarnetAction } from "../../infrastructure/actions/carnetizacion-actions";
import { schemaSearch, type SearchFormType } from "../schema/schema-carnet";
import SearchForm from "../components/search-form";
import type { EmployeeCarnet } from "../../domain/entities/carnet";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";

function truncarNombre(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 3) return nombreCompleto;
  const nombres = partes.slice(0, 2);
  const apellidos = partes.slice(-2);
  return [...nombres, ...apellidos].join(" ");
}

export function BuscarPersonalView() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const router = useRouter();

  const form = useForm<SearchFormType>({
    resolver: zodResolver(schemaSearch),
    defaultValues: { query: "" },
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSWR(
    debouncedQuery.length >= 2 ? ["search-carnet", debouncedQuery] : null,
    async () => {
      const resultado = await buscarPersonalCarnetAction(debouncedQuery);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const fallo = resultado as { error: string; errores?: Record<string, string[]> };
        aplicarErroresServidor(form, fallo.errores, { query: "query" });
        throw new Error(fallo.error);
      }
      return (resultado as EmployeeCarnet[]) || [];
    },
    {
      onError: (err) => toast.error(`Error al buscar personal: ${err.message}`),
    },
  );

  const lista = Array.isArray(results) ? results : [];

  const onSubmit = (values: SearchFormType) => {
    setQuery(values.query);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 50);
    setQuery(value);
    form.setValue("query", value);
    if (value.length < 2) setDebouncedQuery("");
  };

  const hasSearched = debouncedQuery.length >= 2;

  return (
    <PageLayout
      title="Buscar Personal"
      description="Busca un trabajador por cédula o nombre para generar su carnet institucional"
    >
      <div className="max-w-3xl mx-auto mt-6 flex flex-col gap-6">
        <Card className="shadow-sm border">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Search className="size-5 text-primary" />
              Búsqueda de Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pb-6">
            <SearchForm
              form={form}
              isLoading={isLoading}
              queryLength={query.length}
              onInputChange={handleInputChange}
              onSubmit={onSubmit}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          {isLoading && (
            <div className="text-center py-12">
              <Loader2 className="size-10 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-3">
                Buscando en GATH…
              </p>
            </div>
          )}

          {!isLoading && hasSearched && lista.length === 0 && (
            <Card className="shadow-sm">
              <CardContent className="text-center py-12">
                <User className="size-14 mx-auto text-muted-foreground/40" />
                <p className="text-lg font-medium text-foreground mt-4">
                  Sin resultados
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  No se encontraron trabajadores para &quot;{debouncedQuery}&quot;
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading &&
            lista.map((emp: EmployeeCarnet) => (
              <Card
                key={emp.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 shadow-sm border"
                onClick={() =>
                  router.push(`/carnetizacion/generar?cedula=${emp.cedula}`)
                }
              >
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                      <div
                        className={`rounded-full p-3 shrink-0 ${
                          emp.tiene_carnet ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <IdCard className="size-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base text-foreground">
                          {truncarNombre(emp.nombre_completo)}
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                          <span>C.I: {emp.cedula}</span>
                          {emp.codigo && (
                            <span className="flex items-center gap-1">
                              <Hash className="size-3" />
                              {emp.codigo}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {emp.cargo}
                          {emp.cargo && emp.departamento ? ", " : ""}
                          {emp.departamento}
                        </p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                      {emp.tiene_carnet ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                          <CheckCircle2 className="size-3 mr-1" />
                          Carnet activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="size-3 mr-1" />
                          Sin carnet
                        </Badge>
                      )}
                      <div className="flex items-center gap-2">
                        {emp.total_solicitudes > 0 && (
                          <span className="text-xs text-muted-foreground">
                            <Printer className="size-3 inline mr-1" />
                            {emp.total_solicitudes}{" "}
                            {emp.total_solicitudes === 1 ? "emisión" : "emisiones"}
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
