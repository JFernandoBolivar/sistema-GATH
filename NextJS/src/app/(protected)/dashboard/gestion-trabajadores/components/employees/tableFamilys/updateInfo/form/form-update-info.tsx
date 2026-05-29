import {
  getMaritalstatus,
  getSex,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import FormDate from "@/components/form-date";
import TextAreaForm from "@/components/form-text-area";
import InputForm from "@/components/input-form";
import { SelectForm } from "@/components/select-form";
import { Card, CardHeader } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import {
  UpdateInfoFormValues,
  updateInfoSchema,
} from "../schema/updateInfoSchema";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import updateInfoAction from "../action/updateInfoAction";
import { toast } from "sonner";
import Loading from "../../../../loading/loading";
import { useSearchStore } from "@/hooks/use-search-params";
interface Props {
  id: number;
  mutate: (key: string[]) => void;
}
export default function UpdateBasicInfoFamily({ id, mutate }: Props) {
  const [isPending, startTransition] = useTransition();
  const { data: sex, isLoading: isLoadingSex } = useSWR("sex", async () =>
    getSex(),
  );
  const { data: maritalStatus, isLoading: isMaritalStatus } = useSWR(
    "maritalStatus",
    async () => getMaritalstatus(),
  );

  const form = useForm<UpdateInfoFormValues>({
    resolver: zodResolver(updateInfoSchema),
    defaultValues: {
      cedulaFamiliar: undefined,
      primer_nombre: undefined,
      segundo_nombre: undefined,
      primer_apellido: undefined,
      segundo_apellido: undefined,
      fechanacimiento: undefined,
      sexo: undefined,
      estadoCivil: undefined,
      observaciones: undefined,
    },
  });
  const searchParams = useSearchStore((state) => state.searchParams);
  const onSubmit = (values: UpdateInfoFormValues) => {
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
    <>
      {isPending ? (
        <Loading />
      ) : (
        <Card className="border-none shadow-none">
          <CardHeader>
            <h2 className="text-lg font-semibold">
              Actualizar Información Básica
            </h2>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <InputForm
                  form={form}
                  label="Cedula"
                  nameInput="cedulaFamiliar"
                  type="number"
                />
                <InputForm
                  form={form}
                  label="Primer Nombre"
                  nameInput="primer_nombre"
                  type="text"
                />
                <InputForm
                  form={form}
                  label="Segundo Nombre"
                  nameInput="segundo_nombre"
                  type="text"
                />
                <InputForm
                  form={form}
                  label="Primer Apellido"
                  nameInput="primer_apellido"
                  type="text"
                />
                <InputForm
                  form={form}
                  label="Segundo Apellido"
                  nameInput="segundo_apellido"
                  type="text"
                />
                <SelectForm
                  Formlabel="Estado Civil"
                  SelectLabelItem="Seleccione el Estado Civil"
                  form={form}
                  isLoading={isMaritalStatus}
                  nameSalect="estadoCivil"
                  options={maritalStatus?.data || []}
                  valueKey="id"
                  labelKey="estadoCivil"
                  placeholder="Seleccione un Estado Civil"
                />

                <SelectForm
                  Formlabel="Sexo"
                  SelectLabelItem="Seleccione el Sexo"
                  form={form}
                  isLoading={isLoadingSex}
                  nameSalect="sexo"
                  options={sex?.data || []}
                  valueKey="id"
                  labelKey="sexo"
                  placeholder="Seleccione un parentesco"
                  classNameItem="col-span-2"
                />
                <FormDate
                  form={form}
                  label="Fecha De Nacimiento"
                  nameInput="fechanacimiento"
                  className="col-span-2"
                />
                <TextAreaForm
                  form={form}
                  label="Observaciones"
                  className="col-span-2"
                  nameInput="observaciones"
                />
                <Button className="col-span-2 cursor-pointer">
                  Actualizar
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      )}
    </>
  );
}
