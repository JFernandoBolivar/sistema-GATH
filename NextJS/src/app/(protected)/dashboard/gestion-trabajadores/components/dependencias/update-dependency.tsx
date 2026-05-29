import InputForm from "@/components/input-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { getDependency } from "../../api/getInfoRac";
import upgradeDependencyActions from "../../ubicacion-administrativa/actualizar-ubicacion/actions/upgradeDependency";
import {
  SchemaUpgradeDependnecyType,
  schemaUpgradeDependnecy,
} from "../../ubicacion-administrativa/actualizar-ubicacion/schema/schemaUpdateDependency";
import Loading from "../loading/loading";
import { zodResolver } from "@hookform/resolvers/zod";

export default function UpdateDependency() {
  const [isPending, startTransition] = useTransition();

  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
  );

  const form = useForm<SchemaUpgradeDependnecyType>({
    defaultValues: {
      id: 0,
      Codigo: "",
      dependencia: "",
    },
    resolver: zodResolver(schemaUpgradeDependnecy),
  });
  const onSubmit = (values: SchemaUpgradeDependnecyType) => {
    startTransition(async () => {
      const response = await upgradeDependencyActions(values);
      if (response.success) {
        toast.success(response.message);
        form.reset();
      } else {
        toast.error(response.message);
      }
    });
  };

  return (
    <>
      {isPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nivel</FormLabel>
                  <Select
                    onValueChange={(values) => {
                      field.onChange(Number.parseInt(values));
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full truncate">
                        <SelectValue
                          placeholder={`${
                            isLoadingDependency
                              ? "Cargando Niveles"
                              : "Seleccione un Nivel"
                          }`}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {dependency?.data.map((dependencia, i) => (
                        <SelectItem key={i} value={`${dependencia.id}`}>
                          {dependencia.dependencia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <InputForm
              form={form}
              label="Codigo"
              nameInput="Codigo"
              type="number"
              placeholder="Ej. 00000000000"
            />
            <InputForm
              form={form}
              label="Nuevo nombre de la dependencia"
              nameInput="dependencia"
              type="text"
              placeholder="Ej. Ministerio....."
            />
            <Button className="w-full"> Actualizar</Button>
          </form>
        </Form>
      )}
    </>
  );
}
