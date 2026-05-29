import { useForm, useWatch } from "react-hook-form";
import {
  schemaUpdateAcademy,
  TypeSchemaUpdateAcademy,
} from "../schema/schemaAcademyUpdate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelectItem } from "@/components/ui/select";
import {
  getAcademyLevel,
  getCarrera,
  getInstituciones,
  getMencion,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import useSWR from "swr";
import { SelectForm } from "@/components/select-form";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import Loading from "../../../../loading/loading";
import updateInfoAction from "../action/updateInfoAction";
import { toast } from "sonner";
import { useSearchStore } from "@/hooks/use-search-params";
interface Props {
  id: number;
  mutate: (key: string[]) => void;
}
export default function UpdateFormAcademy({ id, mutate }: Props) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<TypeSchemaUpdateAcademy>({
    defaultValues: {
      formacion_academica_familiar: {
        capacitacion: undefined,
        carrera_id: undefined,
        nueva_carrera_nombre: undefined,
        mencion_id: undefined,
        nueva_mencion_nombre: undefined,
        institucion_id: undefined,
        nueva_institucion_nombre: undefined,
        nivel_Academico_id: undefined,
      },
    },
    resolver: zodResolver(schemaUpdateAcademy),
  });
  const { data: academy, isLoading: isLoadingAcademy } = useSWR(
    "academy",
    async () => await getAcademyLevel(),
  );
  const { data: carrera, isLoading: isLoadingCarrera } = useSWR(
    "carrera",
    async () => await getCarrera(),
  );
  const { data: instituciones } = useSWR("instituciones", getInstituciones);

  const carreraId = useWatch({
    control: form.control,
    name: "formacion_academica_familiar.carrera_id",
  });
  const hasCarrera = carreraId != null && Number(carreraId) > 0;

  const { data: menction, isLoading: isLoadingMenction } = useSWR(
    carreraId ? ["mencion", carreraId] : null,
    async () => await getMencion(String(carreraId)),
  );

  const watchedCarreraId = useWatch({ control: form.control, name: "formacion_academica_familiar.carrera_id" });
  const isOtherCarrera = watchedCarreraId === -1;

  const watchedMencionId = useWatch({ control: form.control, name: "formacion_academica_familiar.mencion_id" });
  const isOtherMencion = watchedMencionId === -1;

  const watchedInstitucionId = useWatch({ control: form.control, name: "formacion_academica_familiar.institucion_id" });
  const isOtherInstitucion = watchedInstitucionId === -1;

  const searchParams = useSearchStore((state) => state.searchParams);

  const onSubmit = (values: TypeSchemaUpdateAcademy) => {
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <SelectForm
                Formlabel="Selecciona Un Nivel Academico"
                SelectLabelItem="Selecciona Un Nivel Academico"
                form={form}
                isLoading={isLoadingAcademy}
                options={academy?.data ?? []}
                nameSalect="formacion_academica_familiar.nivel_Academico_id"
                labelKey="nivelacademico"
                placeholder="Selecciona un nivel academico"
                valueKey="id"
              />
              <SelectForm
                Formlabel={`Institución ${hasCarrera ? "*" : "(Opcional)"}`}
                SelectLabelItem="Seleccione una institución"
                form={form}
                isLoading={false}
                nameSalect="formacion_academica_familiar.institucion_id"
                options={instituciones?.data ?? []}
                placeholder="Seleccione una institución"
                valueKey="id"
                labelKey="nombre_institucion"
                selectedValue={watchedInstitucionId === -1 ? "-1" : String(watchedInstitucionId ?? "")}
                onCustomChange={(v) => {
                  if (v === "-1") {
                    form.setValue("formacion_academica_familiar.institucion_id", -1 as never);
                  } else {
                    form.setValue("formacion_academica_familiar.institucion_id", Number(v) as never);
                    form.setValue("formacion_academica_familiar.nueva_institucion_nombre", "" as never);
                  }
                }}
              >
                <SelectItem value="-1">Otra</SelectItem>
              </SelectForm>
              {isOtherInstitucion && (
                <FormField
                  control={form.control}
                  name="formacion_academica_familiar.nueva_institucion_nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Institución</FormLabel>
                      <FormControl>
                        <Input placeholder="Nueva institución..." {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <SelectForm
                Formlabel="Carrera"
                SelectLabelItem="Seleccione una carrera"
                form={form}
                isLoading={isLoadingCarrera}
                nameSalect="formacion_academica_familiar.carrera_id"
                options={carrera?.data ?? []}
                placeholder="Seleccione una carrera"
                valueKey="id"
                labelKey="nombre_carrera"
                selectedValue={isOtherCarrera ? "-1" : String(watchedCarreraId ?? "")}
                onCustomChange={(v) => {
                  if (v === "-1") {
                    form.setValue("formacion_academica_familiar.carrera_id", -1 as never);
                    form.setValue("formacion_academica_familiar.mencion_id", undefined as never);
                  } else {
                    form.setValue("formacion_academica_familiar.carrera_id", Number(v) as never);
                    form.setValue("formacion_academica_familiar.nueva_carrera_nombre", "" as never);
                  }
                }}
              >
                <SelectItem value="-1">Otra</SelectItem>
              </SelectForm>
              {isOtherCarrera && (
                <FormField
                  control={form.control}
                  name="formacion_academica_familiar.nueva_carrera_nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Carrera</FormLabel>
                      <FormControl>
                        <Input placeholder="Nueva carrera..." {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <SelectForm
                Formlabel="Seleccione una mención"
                SelectLabelItem="Seleccione una mención"
                form={form}
                isLoading={isLoadingMenction}
                nameSalect="formacion_academica_familiar.mencion_id"
                options={menction?.data ?? []}
                placeholder="Seleccione una mención"
                valueKey="id"
                labelKey="nombre_mencion"
                selectedValue={isOtherMencion ? "-1" : String(watchedMencionId ?? "")}
                onCustomChange={(v) => {
                  if (v === "-1") {
                    form.setValue("formacion_academica_familiar.mencion_id", -1 as never);
                  } else {
                    form.setValue("formacion_academica_familiar.mencion_id", Number(v) as never);
                    form.setValue("formacion_academica_familiar.nueva_mencion_nombre", "" as never);
                  }
                }}
              >
                {hasCarrera && <SelectItem value="-1">Otra</SelectItem>}
              </SelectForm>
              {isOtherMencion && (
                <FormField
                  control={form.control}
                  name="formacion_academica_familiar.nueva_mencion_nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Mención</FormLabel>
                      <FormControl>
                        <Input placeholder="Nueva mención..." {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="formacion_academica_familiar.capacitacion"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Capacitación (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Capacitado En..." {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button className="col-span-2 cursor-pointer">
                Guardar Información
              </Button>
            </div>
          </form>
        </Form>
      )}
    </>
  );
}
