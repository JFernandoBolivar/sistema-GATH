"use client";

import { apiFetchFormData } from "@/lib/api-client";
import {
  getAcademyLevel,
  getAllergies,
  getBloodGroup,
  getCarrera,
  getDisability,
  getEmployeeById,
  getInstituciones,
  getMaritalstatus,
  getMencion,
  getParent,
  getPasiveById,
  getPatologys,
  getSex,
  getTallas,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import FileUpload from "@/app/(protected)/dashboard/gestion-trabajadores/components/employees/file-upload";
import {
  FamilyEmployeeTypeForm,
  schemaFamilyEmployeeOne,
} from "@/app/(protected)/dashboard/gestion-trabajadores/personal-trabajador/familiares/agregar-familiar/schema/schemaCreateFamily";
import {
  allergies,
  ApiResponse,
  DisabilitysType,
  EmployeeData,
  PatologysType,
  TallaItem,
} from "@/app/types/types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDate } from "date-fns";
import {
  BookAIcon,
  CalendarIcon,
  Contact,
  Database,
  HeartPulse,
  Search,
  Shirt,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { Button } from "../../../../../../components/ui/button";
import { Calendar } from "../../../../../../components/ui/calendar";
import { Card, CardContent } from "../../../../../../components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../../components/ui/form";
import { Input } from "../../../../../../components/ui/input";
import { Label } from "../../../../../../components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../../../components/ui/popover";
import { Switch } from "../../../../../../components/ui/switch";
import { Textarea } from "../../../../../../components/ui/textarea";

import { toast } from "sonner";

import z from "zod";

import { ScrollArea } from "@/components/ui/scroll-area";
import Error from "../../../gestion-trabajadores/components/error/error";
import Loading from "../../../gestion-trabajadores/components/loading/loading";
import createFamilyPasiveActions from "../../personal-jubilado/familiares/agregar-familiar/actions/create-family-pasive-actions";
import { getPasiveSearch } from "../../api/getInfoPasive";

function groupByRegion(tallas: TallaItem[]) {
  return tallas.reduce(
    (acc: Record<string, TallaItem[]>, item: TallaItem) => {
      const codigo = item.region.codigo;
      if (!acc[codigo]) acc[codigo] = [];
      acc[codigo].push(item);
      return acc;
    },
    {} as Record<string, TallaItem[]>,
  );
}

export function CreateFamilyPasiveForm() {
  const [employee, setEmployee] = useState<ApiResponse<EmployeeData>>();
  const [isPending, startTransition] = useTransition();

  const [down, setDown] = useState(false);
  const [mencionId, setMencionId] = useState<string>();

  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [selectedNivelId, setSelectedNivelId] = useState<number>();
  const { data: academyLevel, isLoading: isLoadingAcademyLevel } = useSWR(
    "academyLevel",
    async () => await getAcademyLevel(),
  );
  const { data: carrera, isLoading: isLoadingCarrera } = useSWR(
    selectedNivelId ? ["carrera", selectedNivelId] : null,
    async () => await getCarrera(selectedNivelId || undefined),
  );
  const { data: mencion, isLoading: isLoadingMencion } = useSWR(
    mencionId ? ["mencion", mencionId] : null,
    async () => await getMencion(mencionId!),
  );
  const { data: maritalStatus, isLoading: isLoadingMaritalStatus } = useSWR(
    "maritalStatus",
    async () => await getMaritalstatus(),
  );
  const form = useForm({
    defaultValues: {
      cedulaFamiliar: "",
      estadoCivil: 0,
      fechanacimiento: new Date(),
      file_cedula: undefined,
      file_partida_nacimiento: undefined,
      formacion_academica_familiar: undefined,
      heredero: undefined,
      mismo_ente: false,
      observaciones: "",
      orden_hijo: 0,
      parentesco: 0,
      perfil_fisico_familiar: {
        tallaCamisa: 0,
        tallaPantalon: 0,
        tallaZapatos: 0,
        tallaChaqueta: 0,
      },
      perfil_salud_familiar: {
        discapacidad: [],
        grupoSanguineo: 0,
        patologiaCronica: [],
      },
      primer_apellido: "",
      primer_nombre: "",
      segundo_apellido: "",
      segundo_nombre: "",
      sexo: 0,
    },
    resolver: zodResolver(schemaFamilyEmployeeOne),
    mode: "onSubmit",
  });
  const { data: tallas, isLoading: isLoadingTallas } = useSWR(
    "tallas",
    async () => await getTallas(),
  );

  const camisas = useMemo(
    () =>
      tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Camisa") ?? [],
    [tallas],
  );
  const pantalones = useMemo(
    () =>
      tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Pantalón") ?? [],
    [tallas],
  );
  const zapatos = useMemo(
    () =>
      tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Zapato") ?? [],
    [tallas],
  );
  const chaquetas = useMemo(
    () =>
      tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Chaqueta") ?? [],
    [tallas],
  );

  const camisasGrouped = useMemo(() => groupByRegion(camisas), [camisas]);
  const pantalonesGrouped = useMemo(
    () => groupByRegion(pantalones),
    [pantalones],
  );
  const zapatosGrouped = useMemo(() => groupByRegion(zapatos), [zapatos]);
  const chaquetasGrouped = useMemo(() => groupByRegion(chaquetas), [chaquetas]);

  const { data: patology, isLoading: isLoadingPatology } = useSWR(
    "patology",
    async () => await getPatologys(),
  );
  const { data: bloodGroup, isLoading: isLoadingBloodGroup } = useSWR(
    "blood",
    async () => await getBloodGroup(),
  );
  const { data: disability, isLoading: isLoadingDisability } = useSWR(
    "disability",
    async () => await getDisability(),
  );
  const { data: parent, isLoading: isLoadingParen } = useSWR(
    "parent",
    async () => getParent(),
  );

  const { data: sex, isLoading: isLoadingSex } = useSWR(
    "sex",
    async () => await getSex(),
  );
  const { data: instituciones } = useSWR("instituciones", getInstituciones);
  const { data: allergies, isLoading: isLoadingAllergies } = useSWR(
    "allergies",
    async () => await getAllergies(),
  );
  const allergiesGroupList = useMemo(() => {
    const data = allergies?.data;
    if (!data) return [];
    return allergies.data.reduce(
      (acc, item) => {
        const categoriaNombre = item.categoria.nombre_categoria;
        let grupo = acc.find((g) => g.categoria === categoriaNombre);
        if (!grupo) {
          grupo = { categoria: categoriaNombre, datos: [] };
          acc.push(grupo);
        }
        grupo.datos.push(item);
        return acc;
      },
      [] as { categoria: string; datos: allergies[] }[],
    );
  }, [allergies]);
  const disabilityGroupList = useMemo(() => {
    if (!disability?.data) return [];

    return disability.data.reduce(
      (acc, item) => {
        const categoriaNombre = item.categoria.nombre_categoria;
        let grupo = acc.find((g) => g.categoria === categoriaNombre);
        if (!grupo) {
          grupo = { categoria: categoriaNombre, datos: [] };
          acc.push(grupo);
        }
        grupo.datos.push(item);
        return acc;
      },
      [] as { categoria: string; datos: DisabilitysType[] }[],
    );
  }, [disability?.data]);

  const patologyGroupList = useMemo(() => {
    if (!patology?.data) return [];
    return patology.data.reduce(
      (acc, item) => {
        const categoriaNombre = item.categoria.nombre_categoria;
        let grupo = acc.find((g) => g.categoria === categoriaNombre);
        if (!grupo) {
          grupo = { categoria: categoriaNombre, datos: [] };
          acc.push(grupo);
        }
        grupo.datos.push(item);
        return acc;
      },
      [] as { categoria: string; datos: PatologysType[] }[],
    );
  }, [patology?.data]);
  const onSubmit = (data: FamilyEmployeeTypeForm) => {
    startTransition(async () => {
      if (Array.isArray(employee)) return;
      const response = await createFamilyPasiveActions(
        data,
        employee?.data.cedulaidentidad!,
      );
      if (response.success) {
        const familiarId = response.data?.id;
        if (familiarId && (data.file_cedula || data.file_partida_nacimiento)) {
          try {
            const uploadDoc = async (file: File, tipo: string) => {
              const fd = new FormData();
              fd.append("familiarId", String(familiarId));
              fd.append("document_type", tipo);
              fd.append("file", file);
              const { uploadFamilyDocument } =
                await import("../../../gestion-trabajadores/components/employees/tableFamilys/actions/upload-document");
              const result = await uploadFamilyDocument(fd);
              if (!result.success) {
                console.error(`Error subiendo ${tipo}:`, result.message);
              }
            };
            if (data.file_cedula) {
              await uploadDoc(data.file_cedula, "cedula");
            }
            if (data.file_partida_nacimiento) {
              await uploadDoc(
                data.file_partida_nacimiento,
                "partida_nacimiento",
              );
            }
          } catch (e) {
            console.error("Error subiendo documentos:", e);
          }
        }
        toast.success(response.message);
        form.reset();
      } else {
        toast.error(response.message);
      }
    });
  };
  const schemaSearchEmployee = z.object({
    searchEmployeeForm: z.string(),
  });
  const handleSearch = async (values: z.infer<typeof schemaSearchEmployee>) => {
    if (!values.searchEmployeeForm) return;

    const response = await getPasiveById(values.searchEmployeeForm);

    if (response.data) {
      setEmployee(response);
    }
  };
  const academyLevelId = useWatch({
    control: form.control,
    name: "formacion_academica_familiar.nivel_Academico_id",
  });
  const nivelSeleccionado = academyLevel?.data?.find(
    (n) => n.id === academyLevelId,
  );
  const esNoPosee =
    nivelSeleccionado?.nivelacademico?.toLowerCase().includes("no posee") ||
    nivelSeleccionado?.nivelacademico?.toLowerCase() === "n/p";

  const formSearch = useForm({
    defaultValues: {
      searchEmployeeForm: "",
    },
    resolver: zodResolver(schemaSearchEmployee),
  });
  return (
    <>
      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-2">
            <Form {...formSearch}>
              <form
                className="flex flex-row justify-between  gap-2"
                onSubmit={formSearch.handleSubmit(handleSearch)}
              >
                <FormField
                  name="searchEmployeeForm"
                  control={formSearch.control}
                  render={({ field }) => (
                    <FormItem className="flex-1 ">
                      <FormLabel>
                        Buscar Cédula del Personal Pasivo/Jubilado
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000000"
                          type="number"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button className="self-baseline-last cursor-pointer">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
            </Form>
            {employee && employee?.status !== "error" && (
              <div className={` rounded-sm p-2 `}>
                {!Array.isArray(employee) && (
                  <div className="flex flex-row gap-2  border-2 border-blue-400/45 bg-blue-200/40 p-2 rounded-sm">
                    <p>Nombres: {employee.data.nombres}</p>
                    <p>Cedula: {employee.data.cedulaidentidad}</p>
                  </div>
                )}
              </div>
            )}
            {employee && employee?.status == "error" && (
              <Error errorMessage="Cédula Invalida" />
            )}
          </div>

          {employee &&
            !Array.isArray(employee) &&
            employee?.status !== "error" && (
              <>
                {isPending ? (
                  <Loading promiseMessage="Agregando Familiar" />
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                      <fieldset className="p-3 " dir="rtl">
                        <div dir="ltr">
                          <div>
                            <div
                              className={`grid grid-cols-2 gap-2 space-y-4 `}
                            >
                              <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2 border-green-600 rounded-sm">
                                <legend className="flex gap-2 text-green-700 font-bold">
                                  Datos Personales <Database />
                                </legend>
                                <FormField
                                  control={form.control}
                                  name={`cedulaFamiliar`}
                                  render={({ field }) => (
                                    <FormItem className="col-span-2">
                                      <FormLabel className="cursor-pointer">
                                        Cédula Familiar
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="text"
                                          {...field}
                                          disabled={down}
                                          placeholder={`${down ? "Se tomara la cedula del trabajador como representante del menor de edad" : ""}`}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        <Label className="flex justify-end cursor-pointer">
                                          ¿El Familiar Es Menor De 9 años?{" "}
                                          <Switch
                                            className="cursor-pointer"
                                            onCheckedChange={(bool) => {
                                              setDown(bool);
                                              field.onChange(
                                                down ? undefined : "",
                                              );
                                            }}
                                          />
                                        </Label>
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`primer_nombre`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="cursor-pointer">
                                        Primer Nombre
                                      </FormLabel>
                                      <FormControl>
                                        <Input type="text" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`segundo_nombre`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="cursor-pointer">
                                        Segundo Nombre
                                      </FormLabel>
                                      <FormControl>
                                        <Input type="text" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`primer_apellido`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="cursor-pointer">
                                        Primer Apellido
                                      </FormLabel>
                                      <FormControl>
                                        <Input type="text" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`segundo_apellido`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="cursor-pointer">
                                        Segundo Apellido
                                      </FormLabel>
                                      <FormControl>
                                        <Input type="text" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`sexo`}
                                  render={({ field }) => (
                                    <FormItem className=" cursor-pointer">
                                      <FormLabel className="cursor-pointer">
                                        Sexo *
                                      </FormLabel>
                                      <Select
                                        onValueChange={(values) => {
                                          field.onChange(
                                            Number.parseInt(values),
                                          );
                                        }}
                                      >
                                        <FormControl>
                                          <SelectTrigger className="w-full truncate">
                                            <SelectValue
                                              placeholder={`${isLoadingSex ? "Cargando Generos" : "Seleccione un Genero"}`}
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {sex?.data.map((v, i) => (
                                            <SelectItem
                                              value={`${v.id}`}
                                              key={i}
                                            >
                                              {v.sexo}
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
                                  name={`fechanacimiento`}
                                  render={({ field }) => (
                                    <FormItem className="flex flex-col  grow shrink basis-40 cursor-pointer">
                                      <FormLabel className="cursor-pointer">
                                        {" "}
                                        Fecha de Nacimiento *
                                      </FormLabel>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <FormControl>
                                            <Button
                                              variant={"outline"}
                                              className="font-light"
                                            >
                                              {field.value ? (
                                                formatDate(
                                                  field.value,
                                                  "dd/MM/yyyy",
                                                )
                                              ) : (
                                                <span>
                                                  Selecciona una fecha
                                                </span>
                                              )}
                                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                          </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent
                                          className="w-auto p-0"
                                          align="start"
                                        >
                                          <Calendar
                                            selected={
                                              field.value
                                                ? new Date(field.value)
                                                : undefined
                                            }
                                            mode="single"
                                            onSelect={(date) =>
                                              field.onChange(date)
                                            }
                                            disabled={(date: Date) =>
                                              date > new Date() ||
                                              date < new Date("1900-01-01")
                                            }
                                            captionLayout="dropdown"
                                          />
                                        </PopoverContent>
                                      </Popover>

                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`estadoCivil`}
                                  render={({ field }) => (
                                    <FormItem className="cursor-pointer col-span-2 w-full">
                                      <FormLabel className="cursor-pointer ">
                                        Estado Civil{" "}
                                      </FormLabel>
                                      <Select
                                        onValueChange={(values) => {
                                          field.onChange(
                                            Number.parseInt(values),
                                          );
                                        }}
                                      >
                                        <FormControl>
                                          <SelectTrigger className="w-full truncate">
                                            <SelectValue
                                              placeholder={`${isLoadingMaritalStatus ? "Cargando Estado Civil" : "Seleccione Un Estado Civil"}`}
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {maritalStatus?.data.map(
                                            (status, i) => (
                                              <SelectItem
                                                key={i}
                                                value={`${status.id}`}
                                              >
                                                {status.estadoCivil}
                                              </SelectItem>
                                            ),
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />
                              </fieldset>
                              <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2 border-amber-700 rounded-sm">
                                <legend className="flex gap-2 text-amber-700 font-bold">
                                  {" "}
                                  Relación Y Parentesco <Contact />{" "}
                                </legend>
                                <FormField
                                  control={form.control}
                                  name={`parentesco`}
                                  render={({ field }) => (
                                    <FormItem className="cursor-pointer">
                                      <FormLabel className="cursor-pointer">
                                        Parentesco *
                                      </FormLabel>
                                      <Select
                                        onValueChange={(values) => {
                                          field.onChange(
                                            Number.parseInt(values),
                                          );
                                        }}
                                      >
                                        <FormControl>
                                          <SelectTrigger className="w-full truncate">
                                            <SelectValue
                                              placeholder={
                                                "Seleccione un Parentesco"
                                              }
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {parent?.data.map((parent, i) => (
                                            <SelectItem
                                              key={i}
                                              value={`${parent.id}`}
                                            >
                                              {parent.descripcion_parentesco}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {form.watch(`parentesco`) ==
                                  parent?.data.find(
                                    (v) =>
                                      v.descripcion_parentesco === "HIJO (A)",
                                  )?.id && (
                                  <>
                                    <FormField
                                      control={form.control}
                                      name={`orden_hijo`}
                                      render={({ field }) => (
                                        <FormItem className="cursor-pointer">
                                          <FormLabel className="cursor-pointer">
                                            Orden de nacimiento
                                          </FormLabel>
                                          <Select
                                            onValueChange={(values) => {
                                              const id =
                                                Number.parseInt(values);
                                              field.onChange(id);
                                              setSelectedNivelId(id);
                                            }}
                                          >
                                            <FormControl>
                                              <SelectTrigger className="w-full truncate">
                                                <SelectValue
                                                  placeholder={
                                                    "Seleccione Un Orden De Nacimiento"
                                                  }
                                                />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              <SelectItem value="1">
                                                1
                                              </SelectItem>
                                              <SelectItem value="2">
                                                2
                                              </SelectItem>
                                              <SelectItem value="3">
                                                3
                                              </SelectItem>
                                              <SelectItem value="4">
                                                4
                                              </SelectItem>
                                              <SelectItem value="5">
                                                5
                                              </SelectItem>
                                              <SelectItem value="6">
                                                6
                                              </SelectItem>
                                              <SelectItem value="7">
                                                7
                                              </SelectItem>
                                              <SelectItem value="8">
                                                8
                                              </SelectItem>
                                              <SelectItem value="9">
                                                9
                                              </SelectItem>
                                              <SelectItem value="10">
                                                10
                                              </SelectItem>
                                              <SelectItem value="11">
                                                11
                                              </SelectItem>
                                              <SelectItem value="12">
                                                12
                                              </SelectItem>
                                              <SelectItem value="13">
                                                13
                                              </SelectItem>
                                              <SelectItem value="14">
                                                14
                                              </SelectItem>
                                              <SelectItem value="15">
                                                15
                                              </SelectItem>
                                              <SelectItem value="16">
                                                16
                                              </SelectItem>
                                              <SelectItem value="17">
                                                17
                                              </SelectItem>
                                              <SelectItem value="18">
                                                18
                                              </SelectItem>
                                              <SelectItem value="19">
                                                19
                                              </SelectItem>
                                              <SelectItem value="20">
                                                20
                                              </SelectItem>
                                              <SelectItem value="21">
                                                21
                                              </SelectItem>
                                              <SelectItem value="22">
                                                22
                                              </SelectItem>
                                              <SelectItem value="23">
                                                23
                                              </SelectItem>
                                              <SelectItem value="24">
                                                24
                                              </SelectItem>
                                              <SelectItem value="25">
                                                25
                                              </SelectItem>
                                              <SelectItem value="26">
                                                26
                                              </SelectItem>
                                              <SelectItem value="27">
                                                27
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                      )}
                                    />
                                  </>
                                )}

                                <FormField
                                  name={`mismo_ente`}
                                  control={form.control}
                                  render={({ field }) => (
                                    <>
                                      <FormItem className="flex flex-row items-center  m-auto">
                                        <Label
                                          htmlFor="work"
                                          className="text-center cursor-pointer"
                                        >
                                          ¿El Familar Trabaja En Este Ente?
                                        </Label>
                                        <Switch
                                          id="work"
                                          onCheckedChange={field.onChange}
                                          className="scale-100 cursor-pointer"
                                        />
                                      </FormItem>
                                      <FormMessage />
                                    </>
                                  )}
                                />

                                <FormField
                                  name={`heredero`}
                                  control={form.control}
                                  render={({ field }) => (
                                    <>
                                      <FormItem className="flex flex-row items-center  m-auto">
                                        <Label
                                          htmlFor="soon"
                                          className="cursor-pointer"
                                        >
                                          ¿El Familiar Es Heredero?
                                        </Label>
                                        <Switch
                                          id="soon"
                                          onCheckedChange={field.onChange}
                                          className="scale-100 cursor-pointer"
                                        />
                                      </FormItem>
                                      <FormMessage />
                                    </>
                                  )}
                                />
                              </fieldset>
                              <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2  border-blue-700 rounded-sm">
                                <legend className="flex gap-2 text-blue-700 font-bold">
                                  Información Academica <BookAIcon />
                                </legend>
                                <FormField
                                  control={form.control}
                                  name={`formacion_academica_familiar.nivel_Academico_id`}
                                  render={({ field }) => (
                                    <FormItem className="col-span-2 cursor-pointer">
                                      <FormLabel className="cursor-pointer">
                                        Nivel Academico
                                      </FormLabel>
                                      <Select
                                        onValueChange={(values) => {
                                          field.onChange(
                                            Number.parseInt(values),
                                          );
                                        }}
                                      >
                                        <FormControl>
                                          <SelectTrigger className="w-full truncate">
                                            <SelectValue
                                              placeholder={`${isLoadingAcademyLevel ? "Cargando Niveles Academicos" : "Seleccione un Nivel Academico"}`}
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {academyLevel?.data.map(
                                            (nivel, i) => (
                                              <SelectItem
                                                key={i}
                                                value={`${nivel.id}`}
                                              >
                                                {nivel.nivelacademico}
                                              </SelectItem>
                                            ),
                                          )}
                                        </SelectContent>
                                      </Select>
                                      {!(
                                        academyLevelId == 1 ||
                                        academyLevelId == 2 ||
                                        esNoPosee
                                      ) && (
                                        <FormDescription className="flex flex-row gap-2 justify-end">
                                          <Label>
                                            Mas Detalles De Formacion Academica
                                          </Label>
                                          <Switch
                                            onCheckedChange={setShowMoreDetails}
                                          />
                                        </FormDescription>
                                      )}
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                {showMoreDetails && (
                                  <>
                                    <div className="flex items-start gap-2">
                                      <FormField
                                        control={form.control}
                                        name={`formacion_academica_familiar.carrera_id`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>
                                              Carrera (Opcional)
                                            </FormLabel>
                                            <Select
                                              onValueChange={(values) => {
                                                if (values === "-1") {
                                                  field.onChange(-1);
                                                  form.setValue(
                                                    "formacion_academica_familiar.nueva_carrera_nombre",
                                                    "" as never,
                                                  );
                                                } else {
                                                  field.onChange(
                                                    Number.parseInt(values),
                                                  );
                                                  form.setValue(
                                                    "formacion_academica_familiar.nueva_carrera_nombre",
                                                    "" as never,
                                                  );
                                                }
                                                setMencionId(values);
                                              }}
                                              value={
                                                field.value === -1
                                                  ? "-1"
                                                  : (field.value?.toString() ??
                                                    "")
                                              }
                                            >
                                              <FormControl>
                                                <SelectTrigger className="w-48">
                                                  <SelectValue
                                                    placeholder={
                                                      isLoadingCarrera
                                                        ? "Cargando..."
                                                        : "Seleccione"
                                                    }
                                                  />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                {carrera?.data.map((c, i) => (
                                                  <SelectItem
                                                    key={i}
                                                    value={`${c.id}`}
                                                  >
                                                    {c.nombre_carrera}
                                                  </SelectItem>
                                                ))}
                                                {!!academyLevelId &&
                                                  academyLevelId > 0 &&
                                                  !esNoPosee && (
                                                    <SelectItem value="-1">
                                                      Otra
                                                    </SelectItem>
                                                  )}
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <div
                                        className={
                                          form.watch(
                                            "formacion_academica_familiar.carrera_id",
                                          ) !== -1
                                            ? "hidden"
                                            : ""
                                        }
                                      >
                                        <FormField
                                          control={form.control}
                                          name="formacion_academica_familiar.nueva_carrera_nombre"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>&nbsp;</FormLabel>
                                              <FormControl>
                                                <Input
                                                  placeholder="Nueva carrera..."
                                                  {...field}
                                                  value={field.value ?? ""}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <FormField
                                        control={form.control}
                                        name={`formacion_academica_familiar.mencion_id`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>
                                              Mención (Opcional)
                                            </FormLabel>
                                            <Select
                                              onValueChange={(values) => {
                                                if (values === "-1") {
                                                  field.onChange(-1);
                                                  form.setValue(
                                                    "formacion_academica_familiar.nueva_mencion_nombre",
                                                    "" as never,
                                                  );
                                                } else {
                                                  field.onChange(
                                                    Number.parseInt(values),
                                                  );
                                                  form.setValue(
                                                    "formacion_academica_familiar.nueva_mencion_nombre",
                                                    "" as never,
                                                  );
                                                }
                                              }}
                                              value={
                                                field.value === -1
                                                  ? "-1"
                                                  : (field.value?.toString() ??
                                                    "")
                                              }
                                            >
                                              <FormControl>
                                                <SelectTrigger className="w-48">
                                                  <SelectValue
                                                    placeholder={
                                                      isLoadingMencion
                                                        ? "Cargando..."
                                                        : "Seleccione"
                                                    }
                                                  />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                {mencion?.data.map((m, i) => (
                                                  <SelectItem
                                                    key={i}
                                                    value={`${m.id}`}
                                                  >
                                                    {m.nombre_mencion}
                                                  </SelectItem>
                                                ))}
                                                {(form.watch(
                                                  "formacion_academica_familiar.carrera_id",
                                                ) as number) > 0 && (
                                                  <SelectItem value="-1">
                                                    Otra
                                                  </SelectItem>
                                                )}
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <div
                                        className={
                                          form.watch(
                                            "formacion_academica_familiar.mencion_id",
                                          ) !== -1
                                            ? "hidden"
                                            : ""
                                        }
                                      >
                                        <FormField
                                          control={form.control}
                                          name="formacion_academica_familiar.nueva_mencion_nombre"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>&nbsp;</FormLabel>
                                              <FormControl>
                                                <Input
                                                  placeholder="Nueva mención..."
                                                  {...field}
                                                  value={field.value ?? ""}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                    </div>

                                    <FormField
                                      name={`formacion_academica_familiar.capacitacion`}
                                      control={form.control}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="cursor-pointer">
                                            Capacitación (Opcional)
                                          </FormLabel>
                                          <FormControl>
                                            <Input
                                              type="text"
                                              placeholder="Capacitado En..."
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <div className="flex items-start gap-2">
                                      <FormField
                                        name="formacion_academica_familiar.institucion_id"
                                        control={form.control}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>
                                              Institución{" "}
                                              {(form.watch(
                                                "formacion_academica_familiar.carrera_id",
                                              ) as number) > 0 ? (
                                                <span className="text-red-500">
                                                  *
                                                </span>
                                              ) : (
                                                "(Opcional)"
                                              )}
                                            </FormLabel>
                                            <Select
                                              onValueChange={(values) => {
                                                if (values === "-1") {
                                                  field.onChange(-1);
                                                } else {
                                                  field.onChange(
                                                    Number(values),
                                                  );
                                                  form.setValue(
                                                    "formacion_academica_familiar.nueva_institucion_nombre",
                                                    "" as never,
                                                  );
                                                }
                                              }}
                                              value={
                                                field.value === -1
                                                  ? "-1"
                                                  : (field.value?.toString() ??
                                                    "")
                                              }
                                            >
                                              <FormControl>
                                                <SelectTrigger className="w-48">
                                                  <SelectValue placeholder="Seleccione" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                {instituciones?.data?.map(
                                                  (inst) => (
                                                    <SelectItem
                                                      key={inst.id}
                                                      value={inst.id.toString()}
                                                    >
                                                      {inst.nombre_institucion}
                                                    </SelectItem>
                                                  ),
                                                )}
                                                <SelectItem value="-1">
                                                  Otra
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <div
                                        className={
                                          form.watch(
                                            "formacion_academica_familiar.institucion_id",
                                          ) !== -1
                                            ? "hidden"
                                            : ""
                                        }
                                      >
                                        <FormField
                                          control={form.control}
                                          name="formacion_academica_familiar.nueva_institucion_nombre"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>&nbsp;</FormLabel>
                                              <FormControl>
                                                <Input
                                                  placeholder="Nueva institución..."
                                                  {...field}
                                                  value={field.value ?? ""}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                    </div>
                                  </>
                                )}
                              </fieldset>
                              <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2 border-purple-900 rounded-sm">
                                <legend className="flex flex-row gap-2 text-purple-900 font-bold">
                                  Información de Vestimenta <Shirt />
                                </legend>

                                <FormField
                                  control={form.control}
                                  name={`perfil_fisico_familiar.tallaCamisa`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Talla De Camisa</FormLabel>
                                      <Select
                                        onValueChange={(v) =>
                                          field.onChange(Number(v))
                                        }
                                        value={
                                          field.value
                                            ? field.value.toString()
                                            : ""
                                        }
                                      >
                                        <FormControl>
                                          <SelectTrigger className="w-full truncate">
                                            <SelectValue
                                              placeholder={
                                                isLoadingTallas
                                                  ? "Cargando..."
                                                  : "Seleccione una talla"
                                              }
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {Object.entries(camisasGrouped).map(
                                            ([region, items]) => (
                                              <SelectGroup key={region}>
                                                <SelectLabel className="text-xs font-bold text-muted-foreground">
                                                  {region}
                                                </SelectLabel>
                                                {items.map((item) => (
                                                  <SelectItem
                                                    key={item.id}
                                                    value={item.id.toString()}
                                                  >
                                                    {item.valor}
                                                  </SelectItem>
                                                ))}
                                              </SelectGroup>
                                            ),
                                          )}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`perfil_fisico_familiar.tallaPantalon`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Talla De Pantalón</FormLabel>
                                      <Select
                                        onValueChange={(v) =>
                                          field.onChange(Number(v))
                                        }
                                        value={
                                          field.value
                                            ? field.value.toString()
                                            : ""
                                        }
                                      >
                                        <FormControl>
                                          <SelectTrigger className="w-full truncate">
                                            <SelectValue
                                              placeholder={
                                                isLoadingTallas
                                                  ? "Cargando..."
                                                  : "Seleccione una talla"
                                              }
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {pantalones.map((item) => (
                                            <SelectItem
                                              key={item.id}
                                              value={item.id.toString()}
                                            >
                                              {item.valor}
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
                                  name={`perfil_fisico_familiar.tallaZapatos`}
                                  render={({ field }) => (
                                    <FormItem className="col-span-2">
                                      <FormLabel>Talla De Zapatos</FormLabel>
                                      <Select
                                        onValueChange={(v) =>
                                          field.onChange(Number(v))
                                        }
                                        value={
                                          field.value
                                            ? field.value.toString()
                                            : ""
                                        }
                                      >
                                        <FormControl>
                                          <SelectTrigger className="w-full truncate">
                                            <SelectValue
                                              placeholder={
                                                isLoadingTallas
                                                  ? "Cargando..."
                                                  : "Seleccione una talla"
                                              }
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {zapatos.map((item) => (
                                            <SelectItem
                                              key={item.id}
                                              value={item.id.toString()}
                                            >
                                              {item.valor}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </fieldset>
                              <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2 border-red-700 rounded-sm">
                                <legend className="flex gap-2 text-red-700 font-bold">
                                  Datos De Salud <HeartPulse />
                                </legend>
                                <FormField
                                  control={form.control}
                                  name={`perfil_salud_familiar.grupoSanguineo`}
                                  render={({ field }) => (
                                    <FormItem className="col-span-2 cursor-pointer">
                                      <FormLabel className="cursor-pointer">
                                        Grupo Sanguineo{" "}
                                      </FormLabel>
                                      <Select
                                        onValueChange={(values) => {
                                          field.onChange(
                                            Number.parseInt(values),
                                          );
                                        }}
                                      >
                                        <FormControl>
                                          <SelectTrigger className="w-full truncate">
                                            <SelectValue
                                              placeholder={`${isLoadingBloodGroup ? "Cargando Grupos Sanguineo" : "Seleccione un Grupo Sanguineo"}`}
                                            />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {bloodGroup?.data.map(
                                            (bloodGroup, i) => (
                                              <SelectItem
                                                key={i}
                                                value={`${bloodGroup.id}`}
                                              >
                                                {bloodGroup.GrupoSanguineo}
                                              </SelectItem>
                                            ),
                                          )}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <ScrollArea className="h-80 w-full col-span-2">
                                  <div className="flex flex-row justify-around gap-4 ">
                                    <div>
                                      <h2 className="font-bold">
                                        Patologias (Opcional)
                                      </h2>
                                      {patologyGroupList.map(
                                        (patologys, index) => (
                                          <div key={index}>
                                            <h2 className="p-2 text-sm font-bold">
                                              *{" "}
                                              {patologys.categoria.toUpperCase()}
                                            </h2>
                                            {patologys.datos.map(
                                              (patologyItem, i) => (
                                                <div
                                                  className="flex flex-col justify-start gap-2  "
                                                  key={i}
                                                >
                                                  <FormField
                                                    control={form.control}
                                                    name="perfil_salud_familiar.patologiaCronica"
                                                    render={({ field }) => {
                                                      const currentValues =
                                                        Array.isArray(
                                                          field.value,
                                                        )
                                                          ? field.value
                                                          : [];
                                                      if (isLoadingPatology) {
                                                        return <Loading />;
                                                      }
                                                      return (
                                                        <FormItem className="flex flex-row items-center space-y-2 ">
                                                          <FormControl>
                                                            <Checkbox
                                                              className="border-black"
                                                              checked={currentValues.includes(
                                                                patologyItem.id,
                                                              )}
                                                              onCheckedChange={(
                                                                checked,
                                                              ) => {
                                                                const newValue =
                                                                  checked
                                                                    ? [
                                                                        ...currentValues,
                                                                        patologyItem.id,
                                                                      ]
                                                                    : currentValues.filter(
                                                                        (id) =>
                                                                          id !==
                                                                          patologyItem.id,
                                                                      );

                                                                field.onChange(
                                                                  newValue,
                                                                );
                                                              }}
                                                            />
                                                          </FormControl>
                                                          <FormLabel
                                                            key={index}
                                                            className="cursor-pointer"
                                                          >
                                                            {
                                                              patologyItem.patologia
                                                            }
                                                          </FormLabel>
                                                        </FormItem>
                                                      );
                                                    }}
                                                  />
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                    <div>
                                      <h2 className="font-bold">
                                        {" "}
                                        Dispacidades (Opcional)
                                      </h2>
                                      {disabilityGroupList.map(
                                        (disability, index) => (
                                          <div key={index}>
                                            <h2 className="p-2 text-sm font-bold">
                                              *{" "}
                                              {disability.categoria.toUpperCase()}
                                            </h2>
                                            {disability.datos.map(
                                              (disabilityItem, i) => (
                                                <div
                                                  className="flex flex-col justify-start gap-2 "
                                                  key={i}
                                                >
                                                  <FormField
                                                    control={form.control}
                                                    name={`perfil_salud_familiar.discapacidad`}
                                                    render={({ field }) => {
                                                      const currentValues =
                                                        Array.isArray(
                                                          field.value,
                                                        )
                                                          ? field.value
                                                          : [];
                                                      if (isLoadingDisability) {
                                                        return <Loading />;
                                                      }
                                                      return (
                                                        <FormItem className="flex flex-row space-y-2">
                                                          <FormLabel className="order-2">
                                                            {
                                                              disabilityItem.discapacidad
                                                            }
                                                          </FormLabel>
                                                          <FormControl>
                                                            <Checkbox
                                                              className="order-1 border-black"
                                                              onCheckedChange={(
                                                                checked,
                                                              ) => {
                                                                const newValue =
                                                                  checked
                                                                    ? [
                                                                        ...currentValues,
                                                                        disabilityItem.id,
                                                                      ]
                                                                    : currentValues.filter(
                                                                        (id) =>
                                                                          id !==
                                                                          disabilityItem.id,
                                                                      );

                                                                field.onChange(
                                                                  newValue,
                                                                );
                                                              }}
                                                            />
                                                          </FormControl>
                                                        </FormItem>
                                                      );
                                                    }}
                                                  />
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                    <div>
                                      <h2 className="font-bold">
                                        {" "}
                                        Alergias (Opcional)
                                      </h2>
                                      {allergiesGroupList.map(
                                        (allergies, index) => (
                                          <div key={index}>
                                            <h2 className="p-2 text-sm font-bold">
                                              *{" "}
                                              {allergies.categoria.toUpperCase()}
                                            </h2>
                                            {allergies.datos.map(
                                              (disabilityItem, i) => (
                                                <div
                                                  className="flex flex-col justify-start gap-2 "
                                                  key={i}
                                                >
                                                  <FormField
                                                    control={form.control}
                                                    name={`perfil_salud_familiar.alergias`}
                                                    render={({ field }) => {
                                                      const currentValues =
                                                        Array.isArray(
                                                          field.value,
                                                        )
                                                          ? field.value
                                                          : [];
                                                      if (isLoadingDisability) {
                                                        return <Loading />;
                                                      }
                                                      return (
                                                        <FormItem className="flex flex-row space-y-2">
                                                          <FormLabel className="order-2">
                                                            {
                                                              disabilityItem.alergia
                                                            }
                                                          </FormLabel>
                                                          <FormControl>
                                                            <Checkbox
                                                              className="order-1 border-black"
                                                              onCheckedChange={(
                                                                checked,
                                                              ) => {
                                                                const newValue =
                                                                  checked
                                                                    ? [
                                                                        ...currentValues,
                                                                        disabilityItem.id,
                                                                      ]
                                                                    : currentValues.filter(
                                                                        (id) =>
                                                                          id !==
                                                                          disabilityItem.id,
                                                                      );

                                                                field.onChange(
                                                                  newValue,
                                                                );
                                                              }}
                                                            />
                                                          </FormControl>
                                                        </FormItem>
                                                      );
                                                    }}
                                                  />
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                </ScrollArea>
                              </fieldset>

                              <FormField
                                control={form.control}
                                name={`observaciones`}
                                render={({ field }) => (
                                  <FormItem className="col-span-2">
                                    <FormLabel
                                      htmlFor="observaciones"
                                      className="cursor-pointer"
                                    >
                                      Observaciones (Opcional)
                                    </FormLabel>
                                    <FormControl>
                                      <Textarea
                                        id="observaciones"
                                        placeholder="Describa las observaciones del familiar..."
                                        value={field.value}
                                        onChange={field.onChange}
                                        className="mt-1"
                                        rows={4}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <fieldset className="border grid grid-cols-1 gap-4 col-span-2 p-4 border-orange-600 rounded-sm">
                                <legend className="flex gap-2 text-orange-700 font-bold">
                                  Documentos Del Familiar
                                </legend>
                                <FormField
                                  control={form.control}
                                  name="file_cedula"
                                  render={({ field: { value, onChange } }) => (
                                    <FileUpload
                                      label="Foto o PDF de la Cédula"
                                      value={value}
                                      onChange={onChange}
                                    />
                                  )}
                                />
                                {form.watch("parentesco") ==
                                  parent?.data.find(
                                    (v) =>
                                      v.descripcion_parentesco === "HIJO (A)",
                                  )?.id && (
                                  <FormField
                                    control={form.control}
                                    name="file_partida_nacimiento"
                                    render={({
                                      field: { value, onChange },
                                    }) => (
                                      <FileUpload
                                        label="Partida de Nacimiento"
                                        value={value}
                                        onChange={onChange}
                                      />
                                    )}
                                  />
                                )}
                              </fieldset>
                            </div>
                          </div>
                        </div>
                      </fieldset>
                      <Button className="w-full cursor-pointer">
                        {" "}
                        Agregar Familiar
                      </Button>
                    </form>
                  </Form>
                )}
              </>
            )}
        </CardContent>
      </Card>
    </>
  );
}
