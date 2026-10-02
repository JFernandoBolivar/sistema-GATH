"use client";

import { Input } from "@/shared/ui/components/input";
import { Button } from "@/shared/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Eraser, Search } from "lucide-react";

interface ItemData {
  id: number;
  nombre?: string;
  codigo?: string;
  Codigo?: string;
  dependencia?: string;
  direccion_general?: string;
  direccion_linea?: string;
  coordinacion?: string;
  nomina?: string;
}

interface CodeFilterFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  dependencyData?: ItemData[];
  directionGeneralData?: ItemData[];
  directionLineData?: ItemData[];
  coordinationData?: ItemData[];
  nominaData?: ItemData[];
  isLoadingDependency?: boolean;
  isLoadingDirectionGeneral?: boolean;
  isLoadingDirectionLine?: boolean;
  isLoadingCoordination?: boolean;
  isLoadingNomina?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSearch: (values: any) => void;
  onClean: () => void;
}

export function CodeFilterForm({
  form,
  dependencyData,
  directionGeneralData,
  directionLineData,
  coordinationData,
  nominaData,
  isLoadingDependency,
  isLoadingDirectionGeneral,
  isLoadingDirectionLine,
  isLoadingCoordination,
  isLoadingNomina,
  onSearch,
  onClean,
}: CodeFilterFormProps) {
  const watchedDependencia = useWatch({ control: form.control, name: "dependencia_id" });
  const watchedDireccionGeneral = useWatch({ control: form.control, name: "direccion_general_id" });
  const watchedDireccionLinea = useWatch({ control: form.control, name: "direccion_linea_id" });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSearch)}>
        <div className="grid grid-cols-2 gap-2 w-full mb-2">
          <FormField
            control={form.control}
            name="codigo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buscar Código</FormLabel>
                <FormControl>
                  <Input placeholder="buscar código..." {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tipo_nomina"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Nómina</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  value={field.value?.toString() ?? ""}
                >
                  <FormControl>
                    <SelectTrigger className="w-full truncate">
                      <SelectValue
                        placeholder={
                          isLoadingNomina
                            ? "Cargando Nominas"
                            : "Seleccione un Tipo de Nómina"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="0">Ninguno</SelectItem>
                    {nominaData?.map((n) => (
                      <SelectItem key={n.id} value={n.id.toString()}>
                        {n.nomina || n.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dependencia_id"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Nivel</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  value={field.value?.toString() ?? ""}
                >
                  <FormControl>
                    <SelectTrigger className="w-full truncate">
                      <SelectValue
                        placeholder={
                          isLoadingDependency
                            ? "Cargando Niveles"
                            : "Seleccione un Nivel"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {dependencyData?.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.dependencia || d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="direccion_general_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  value={field.value?.toString() ?? ""}
                  disabled={!watchedDependencia || watchedDependencia === "0" || watchedDependencia === 0}
                >
                  <FormControl>
                    <SelectTrigger className="w-full truncate">
                      <SelectValue
                        placeholder={
                          isLoadingDirectionGeneral
                            ? "Cargando Direcciones"
                            : "Seleccione una Dirección"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {directionGeneralData?.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.Codigo || d.codigo ? `${d.Codigo || d.codigo}-` : ""}{d.direccion_general || d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="direccion_linea_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>División / Coordinación</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  value={field.value?.toString() ?? ""}
                  disabled={!watchedDireccionGeneral || watchedDireccionGeneral === "0" || watchedDireccionGeneral === 0}
                >
                  <FormControl>
                    <SelectTrigger className="w-full truncate">
                      <SelectValue
                        placeholder={
                          isLoadingDirectionLine
                            ? "Cargando División / Coordinación"
                            : "Seleccione una División / Coordinación"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {directionLineData?.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.Codigo || d.codigo ? `${d.Codigo || d.codigo}-` : ""}{d.direccion_linea || d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="coordinacion_id"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Coordinación</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  value={field.value?.toString() ?? ""}
                  disabled={!watchedDireccionLinea || watchedDireccionLinea === "0" || watchedDireccionLinea === 0}
                >
                  <FormControl>
                    <SelectTrigger className="w-full truncate">
                      <SelectValue
                        placeholder={
                          isLoadingCoordination
                            ? "Cargando Coordinaciones"
                            : "Seleccione una Coordinación"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {coordinationData?.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.Codigo || d.codigo ? `${d.Codigo || d.codigo}-` : ""}{d.coordinacion || d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex gap-2 mb-2">
          <Button type="submit" className="cursor-pointer flex-1">
            <Search className="mr-2" size={16} /> Buscar Cargos
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClean}
            className="cursor-pointer"
          >
            <Eraser className="mr-2" size={16} /> Limpiar
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default CodeFilterForm;
