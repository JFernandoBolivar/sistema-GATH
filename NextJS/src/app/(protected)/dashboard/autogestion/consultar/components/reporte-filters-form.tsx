"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { z } from "zod";
import { Eraser, Filter } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectForm } from "@/components/select-form";
import { useReporteStore } from "@/hooks/use-reporte-store";
import {
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getCoordination,
} from "../../../gestion-trabajadores/api/getInfoRac";

const schema = z.object({
  dependencia_id: z.coerce.number().optional(),
  direccion_general_id: z.coerce.number().optional(),
  direccion_linea_id: z.coerce.number().optional(),
  coordinacion_id: z.coerce.number().optional(),
});

export function ReporteFiltersForm() {
  const setSearchParams = useReporteStore((s) => s.setSearchParams);
  const resetSearchParams = useReporteStore((s) => s.resetSearchParams);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      dependencia_id: undefined,
      direccion_general_id: undefined,
      direccion_linea_id: undefined,
      coordinacion_id: undefined,
    },
  });

  const watchedDep = form.watch("dependencia_id");
  const watchedDg = form.watch("direccion_general_id");
  const watchedDl = form.watch("direccion_linea_id");

  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    getDependency,
  );

  const { data: directionGeneral, isLoading: isLoadingDg } = useSWR(
    watchedDep ? ["dg-reporte", watchedDep] : null,
    () => getDirectionGeneralById(watchedDep!),
  );

  const { data: directionLine, isLoading: isLoadingDl } = useSWR(
    watchedDg ? ["dl-reporte", watchedDg] : null,
    () => getDirectionLine(String(watchedDg)),
  );

  const { data: coordination, isLoading: isLoadingCoord } = useSWR(
    watchedDl ? ["coord-reporte", watchedDl] : null,
    () => getCoordination(String(watchedDl)),
  );

  const buildAndSetParams = () => {
    const vals = form.getValues();
    const filteredEntries = Object.entries(vals).filter(
      ([, v]) => v !== undefined && v !== null && v !== 0,
    );
    const params = new URLSearchParams(filteredEntries as unknown as [string, string][]);
    setSearchParams(params.toString());
  };

  const handleClear = () => {
    form.reset({
      dependencia_id: undefined,
      direccion_general_id: undefined,
      direccion_linea_id: undefined,
      coordinacion_id: undefined,
    });
    resetSearchParams();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Filter className="size-4" /> Filtros para Reporte de Métricas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SelectForm
              form={form}
              nameSalect="dependencia_id"
              Formlabel="Nivel"
              SelectLabelItem="Nivel"
              placeholder="Seleccione un Nivel"
              options={dependency?.data || []}
              isLoading={isLoadingDependency}
              valueKey="id"
              labelKey="dependencia"
              onCustomChange={(v) => {
                const id = Number(v) || undefined;
                form.setValue("dependencia_id", id);
                form.setValue("direccion_general_id", undefined);
                form.setValue("direccion_linea_id", undefined);
                form.setValue("coordinacion_id", undefined);
                buildAndSetParams();
              }}
            />

            <SelectForm
              form={form}
              nameSalect="direccion_general_id"
              Formlabel="Dir. / Gcia. / Oficina"
              SelectLabelItem="Dirección General"
              placeholder="Seleccione Dir. / Gcia."
              options={directionGeneral?.data || []}
              isLoading={isLoadingDg}
              valueKey="id"
              labelKey="direccion_general"
              onCustomChange={(v) => {
                const id = Number(v) || undefined;
                form.setValue("direccion_general_id", id);
                form.setValue("direccion_linea_id", undefined);
                form.setValue("coordinacion_id", undefined);
                buildAndSetParams();
              }}
            />

            <SelectForm
              form={form}
              nameSalect="direccion_linea_id"
              Formlabel="División"
              SelectLabelItem="División"
              placeholder="Seleccione una División"
              options={directionLine?.data || []}
              isLoading={isLoadingDl}
              valueKey="id"
              labelKey="direccion_linea"
              onCustomChange={(v) => {
                const id = Number(v) || undefined;
                form.setValue("direccion_linea_id", id);
                form.setValue("coordinacion_id", undefined);
                buildAndSetParams();
              }}
            />

            <SelectForm
              form={form}
              nameSalect="coordinacion_id"
              Formlabel="Coordinación"
              SelectLabelItem="Coordinación"
              placeholder="Seleccione Coordinación"
              options={coordination?.data || []}
              isLoading={isLoadingCoord}
              valueKey="id"
              labelKey="coordinacion"
              onCustomChange={(v) => {
                const id = Number(v) || undefined;
                form.setValue("coordinacion_id", id);
                buildAndSetParams();
              }}
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={handleClear}
            >
              <Eraser className="size-4 mr-1" /> Limpiar Filtros
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
