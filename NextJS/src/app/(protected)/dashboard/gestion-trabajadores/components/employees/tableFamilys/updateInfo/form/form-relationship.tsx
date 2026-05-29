import { useForm, useWatch } from "react-hook-form";
import {
  schemaUpdateRelaction,
  SchemaUpdateRelaction,
} from "../schema/updateRelationSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { SelectForm } from "@/components/select-form";
import useSWR from "swr";
import { getParent } from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import FormCheck from "@/components/form-check";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTransition } from "react";
import updateInfoAction from "../action/updateInfoAction";
import { useSearchStore } from "@/hooks/use-search-params";
interface Props {
  id: number;
  mutate: (key: string[]) => void;
}
export default function FormRelationship({ id, mutate }: Props) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<SchemaUpdateRelaction>({
    resolver: zodResolver(schemaUpdateRelaction),
    defaultValues: {
      heredero: undefined,
      mismo_ente: undefined,
      parentesco: undefined,
      orden_hijo: undefined,
    },
  });
  const { data: parent, isLoading: isLoadingParent } = useSWR(
    "parent",
    async () => getParent(),
  );
  const searchParams = useSearchStore((state) => state.searchParams);

  const onSubmit = (values: SchemaUpdateRelaction) => {
    startTransition(async () => {
      const response = await updateInfoAction({ idFamily: id, values });
      if (response.success) {
        form.reset();
        toast.success(response.message);
        mutate(["api/family", searchParams]);
      } else {
        toast.error(response.message);
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <SelectForm
            Formlabel="Parentesco"
            SelectLabelItem="Seleccione un Parentesco"
            classNameItem="col-span-2"
            form={form}
            isLoading={isLoadingParent}
            options={parent?.data ?? []}
            valueKey="id"
            labelKey="descripcion_parentesco"
            nameSalect="parentesco"
            placeholder="Seleccione un parentesco"
          />
          <FormCheck
            form={form}
            id="heredero"
            nameInput="heredero"
            label="¿El familiar es heredero?"
          />
          <FormCheck
            form={form}
            id="mismo_ente"
            nameInput="mismo_ente"
            label="¿El familiar trabaja en el mismo ente?"
          />
          <Button type="submit" className="col-span-2 cursor-pointer">
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Form>
  );
}
