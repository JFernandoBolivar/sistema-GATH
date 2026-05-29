"use client"

import {
  getAcademyLevel,
  getAllergies,
  getBloodGroup,
  getCarrera,
  getDisability,
  getMaritalstatus,
  getMencion,
  getParent,
  getPatologys,
  getSex,
  getTallas,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac"
import { allergies, DisabilitysType, PatologysType } from "@/app/types/types"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { formatDate } from "date-fns"
import {
  BookAIcon,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Contact,
  Database,
  HeartPulse,
  Loader2Icon,
  Plus,
  Shirt,
  Trash,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import useSWR from "swr"
import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading"
import {
  FamilyEmployeeType,
  schemaFamilyFormity,
} from "@/shared/schemas/employees/register/schema-family_employee"

type Props = {
  onSubmit: (values: FamilyEmployeeType) => void
  defaultValues: FamilyEmployeeType
  submitLabel?: string
}

export function FormFamilyEmployee({
  onSubmit,
  defaultValues,
  submitLabel = "Registrar Trabajador",
}: Props) {
  const [expandedIndex, setExpandedIndex] = useState(0)
  const [down, setDown] = useState(false)
  const [mencionId, setMencionId] = useState<string>()
  const [index, setIndex] = useState<number>(0)
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [reload, setReload] = useState(false)

  const { data: academyLevel, isLoading: isLoadingAcademyLevel } = useSWR(
    "academyLevel",
    async () => await getAcademyLevel(),
  )
  const { data: carrera, isLoading: isLoadingCarrera } = useSWR(
    "carrera",
    async () => await getCarrera(),
  )
  const { data: mencion, isLoading: isLoadingMencion } = useSWR(
    mencionId ? ["mencion", mencionId] : null,
    async () => await getMencion(mencionId!),
  )
  const { data: maritalStatus, isLoading: isLoadingMaritalStatus } = useSWR(
    "maritalStatus",
    async () => await getMaritalstatus(),
  )
  const form = useForm({
    defaultValues,
    resolver: zodResolver(schemaFamilyFormity),
    mode: "onSubmit",
  })
  const { data: tallas, isLoading: isLoadingTallas } = useSWR(
    "tallas",
    async () => await getTallas(),
  )

  const camisas = useMemo(
    () => tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Camisa") ?? [],
    [tallas],
  )
  const pantalones = useMemo(
    () => tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Pantalón") ?? [],
    [tallas],
  )
  const zapatos = useMemo(
    () => tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Zapato") ?? [],
    [tallas],
  )
  const chaquetas = useMemo(
    () => tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Chaqueta") ?? [],
    [tallas],
  )

  const { data: patology, isLoading: isLoadingPatology } = useSWR(
    "patology",
    async () => await getPatologys(),
  )
  const { data: bloodGroup, isLoading: isLoadingBloodGroup } = useSWR(
    "blood",
    async () => await getBloodGroup(),
  )
  const { data: disability, isLoading: isLoadingDisability } = useSWR(
    "disability",
    async () => await getDisability(),
  )
  const { data: parent, isLoading: isLoadingParen } = useSWR(
    "parent",
    async () => getParent(),
  )
  const { data: sex, isLoading: isLoadingSex } = useSWR(
    "sex",
    async () => await getSex(),
  )
  const { data: allergies, isLoading: isLoadingAllergies } = useSWR(
    "allergies",
    async () => await getAllergies(),
  )

  const allergiesGroupList = useMemo(() => {
    const data = allergies?.data
    if (!data) return []
    return allergies.data.reduce(
      (acc, item) => {
        const categoriaNombre = item.categoria.nombre_categoria
        let grupo = acc.find((g) => g.categoria === categoriaNombre)
        if (!grupo) {
          grupo = { categoria: categoriaNombre, datos: [] }
          acc.push(grupo)
        }
        grupo.datos.push(item)
        return acc
      },
      [] as { categoria: string; datos: allergies[] }[],
    )
  }, [allergies])

  const disabilityGroupList = useMemo(() => {
    if (!disability?.data) return []

    return disability.data.reduce(
      (acc, item) => {
        const categoriaNombre = item.categoria.nombre_categoria
        let grupo = acc.find((g) => g.categoria === categoriaNombre)
        if (!grupo) {
          grupo = { categoria: categoriaNombre, datos: [] }
          acc.push(grupo)
        }
        grupo.datos.push(item)
        return acc
      },
      [] as { categoria: string; datos: DisabilitysType[] }[],
    )
  }, [disability?.data])

  const patologyGroupList = useMemo(() => {
    if (!patology?.data) return []
    return patology.data.reduce(
      (acc, item) => {
        const categoriaNombre = item.categoria.nombre_categoria
        let grupo = acc.find((g) => g.categoria === categoriaNombre)
        if (!grupo) {
          grupo = { categoria: categoriaNombre, datos: [] }
          acc.push(grupo)
        }
        grupo.datos.push(item)
        return acc
      },
      [] as { categoria: string; datos: PatologysType[] }[],
    )
  }, [patology?.data])

  const onSubmitFormity = (data: FamilyEmployeeType) => {
    onSubmit(data)
  }

  const { append, remove, fields } = useFieldArray({
    name: "familys",
    control: form.control,
  })

  const academyLevelId = useWatch({
    control: form.control,
    name: `familys.${index}.formacion_academica_familiar.nivel_Academico_id`,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información De Familiares (Opcional si no posee)</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitFormity)}>
            <fieldset className="p-3 " dir="rtl">
              <legend className="text-lg font-semibold">
                <div className="flex justify-end gap-2 mb-4">
                  <div>
                    <Button
                      variant={"outline"}
                      className="cursor-pointer bg-red-500 hover:bg-red-700 hover:border-2 hover:border-red-600 text-white"
                      type="button"
                      onClick={() => {
                        if (fields.length > 0) {
                          remove(fields.map((field, index) => index))
                        }
                      }}
                    >
                      Limpiar
                      <Trash />
                    </Button>
                  </div>
                  <div>
                    <Button
                      variant={"outline"}
                      className="cursor-pointer bg-blue-500 hover:bg-blue-700 hover:border-2 hover:border-blue-600 text-white"
                      type="button"
                      onClick={() => setReload(true)}
                    >
                      Recargar Datos
                      {!reload ? <Loader2Icon /> : <Spinner />}
                    </Button>
                  </div>
                  <div>
                    <Button
                      variant={"outline"}
                      className="cursor-pointer bg-green-500 hover:bg-green-700 hover:border-2 hover:border-green-600 text-white"
                      type="button"
                      onClick={() => {
                        append({
                          cedulaFamiliar: "",
                          estadoCivil: 0,
                          fechanacimiento: new Date(),
                          heredero: false,
                          mismo_ente: false,
                          observaciones: "",
                          parentesco: 0,
                          perfil_fisico_familiar: {
                            tallaCamisa: 0,
                            tallaPantalon: 0,
                            tallaZapatos: 0,
                            tallaChaqueta: 0,
                          },
                          perfil_salud_familiar: {
                            grupoSanguineo: 0,
                            discapacidad: [],
                            patologiaCronica: [],
                          },
                          primer_apellido: "",
                          primer_nombre: "",
                          segundo_apellido: "",
                          segundo_nombre: "",
                          sexo: 0,
                          formacion_academica_familiar: {
                            capacitacion: "",
                            carrera_id: 0,
                            institucion: "",
                            mencion_id: 0,
                            nivel_Academico_id: 0,
                          },
                        })
                        setExpandedIndex(fields.length)
                      }}
                    >
                      Agregar Familiar
                      <Plus />
                    </Button>
                  </div>
                </div>
              </legend>
              <div dir="ltr">
                {fields.map((field, index) => {
                  const isExpanded = index === expandedIndex
                  const values = form.getValues(`familys.${index}`)
                  return (
                    <div key={field.id}>
                      <div
                        className={`p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 ${!isExpanded ? "bg-white" : "bg-slate-100 border-b"}`}
                        onClick={() =>
                          setExpandedIndex(isExpanded ? -1 : index)
                        }
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-slate-500">
                            #{index + 1}
                          </span>
                          {!isExpanded ? (
                            <div className="flex gap-2 text-sm text-gray-600">
                              <p>
                                <strong>Nombre:</strong>{" "}
                                {values?.primer_nombre || "---"}{" "}
                                {values?.primer_apellido || ""}
                              </p>
                              <p>
                                <strong>Parentesco:</strong>{" "}
                                {values?.parentesco || "Sin asignar"}
                              </p>
                            </div>
                          ) : (
                            <span className="font-semibold text-blue-600">
                              Editando Familiar
                            </span>
                          )}
                        </div>
                        <Button type="button" variant="ghost" size="sm">
                          {isExpanded ? <ChevronUp /> : <ChevronDown />}
                        </Button>
                      </div>

                      <div
                        className={`p-4 ${isExpanded ? "block" : "hidden"}`}
                      >
                        <div className="grid grid-cols-2 gap-2 space-y-4">
                          <div className="col-span-2 flex gap-2 justify-end mb-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setExpandedIndex(-1)}
                            >
                              Cerrar edición
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => remove(index)}
                            >
                              Eliminar Familiar
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div
                        className={`grid grid-cols-2 gap-2 space-y-4 ${isExpanded ? "" : "hidden"}`}
                        key={field.id}
                      >
                        <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2">
                          <legend className="flex gap-2">
                            Datos Personales <Database />
                          </legend>
                          <FormField
                            control={form.control}
                            name={`familys.${index}.cedulaFamiliar`}
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
                                        setDown(bool)
                                        field.onChange(down ? "" : undefined)
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
                            name={`familys.${index}.primer_nombre`}
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
                            name={`familys.${index}.segundo_nombre`}
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
                            name={`familys.${index}.primer_apellido`}
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
                            name={`familys.${index}.segundo_apellido`}
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
                            name={`familys.${index}.sexo`}
                            render={({ field }) => (
                              <FormItem className=" cursor-pointer">
                                <FormLabel className="cursor-pointer">
                                  Sexo *
                                </FormLabel>
                                <Select
                                  onValueChange={(values) => {
                                    field.onChange(Number.parseInt(values))
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
                                      <SelectItem value={`${v.id}`} key={i}>
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
                            name={`familys.${index}.fechanacimiento`}
                            render={({ field }) => (
                              <FormItem className="flex flex-col  grow shrink basis-40 cursor-pointer">
                                <FormLabel className="cursor-pointer">
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
                                          formatDate(field.value, "dd/MM/yyyy")
                                        ) : (
                                          <span>Selecciona una fecha</span>
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
                                      onSelect={(date) => field.onChange(date)}
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
                            name={`familys.${index}.estadoCivil`}
                            render={({ field }) => (
                              <FormItem className="cursor-pointer col-span-2 w-full">
                                <FormLabel className="cursor-pointer ">
                                  Estado Civil{" "}
                                </FormLabel>
                                <Select
                                  onValueChange={(values) => {
                                    field.onChange(Number.parseInt(values))
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
                                    {maritalStatus?.data.map((status, i) => (
                                      <SelectItem
                                        key={i}
                                        value={`${status.id}`}
                                      >
                                        {status.estadoCivil}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </fieldset>
                        <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2">
                          <legend className="flex gap-2">
                            Relacion Y Parentesco <Contact />{" "}
                          </legend>
                          <FormField
                            control={form.control}
                            name={`familys.${index}.parentesco`}
                            render={({ field }) => (
                              <FormItem className="cursor-pointer">
                                <FormLabel className="cursor-pointer">
                                  Parentesco *
                                </FormLabel>
                                <Select
                                  onValueChange={(values) => {
                                    field.onChange(Number.parseInt(values))
                                  }}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full truncate">
                                      <SelectValue
                                        placeholder={"Seleccione un Parentesco"}
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

                          {form.watch(`familys.${index}.parentesco`) ==
                            parent?.data.find(
                              (v) => v.descripcion_parentesco === "HIJO (A)",
                            )?.id && (
                            <>
                              <FormField
                                control={form.control}
                                name={`familys.${index}.orden_hijo`}
                                render={({ field }) => (
                                  <FormItem className="cursor-pointer">
                                    <FormLabel className="cursor-pointer">
                                      Orden de nacimiento
                                    </FormLabel>
                                    <Select
                                      onValueChange={(values) => {
                                        field.onChange(Number.parseInt(values))
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
                                        {Array.from({ length: 27 }, (_, i) => (
                                          <SelectItem key={i + 1} value={`${i + 1}`}>
                                            {i + 1}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            </>
                          )}

                          <FormField
                            name={`familys.${index}.mismo_ente`}
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
                            name={`familys.${index}.heredero`}
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
                        <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2">
                          <legend className="flex gap-2">
                            Información Academica <BookAIcon />
                          </legend>
                          <FormField
                            control={form.control}
                            name={`familys.${index}.formacion_academica_familiar.nivel_Academico_id`}
                            render={({ field }) => (
                              <FormItem className="col-span-2 cursor-pointer">
                                <FormLabel className="cursor-pointer"></FormLabel>
                                <Select
                                  onValueChange={(values) => {
                                    field.onChange(Number.parseInt(values))
                                    setIndex(index)
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
                                    {academyLevel?.data.map((nivel, i) => (
                                      <SelectItem key={i} value={`${nivel.id}`}>
                                        {nivel.nivelacademico}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {!(
                                  academyLevelId == 1 || academyLevelId == 2
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
                              <FormField
                                name={`familys.${index}.formacion_academica_familiar.institucion`}
                                control={form.control}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="cursor-pointer">
                                      Institucion (Opcional)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        type="text"
                                        placeholder="Universidad Nacional..."
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                name={`familys.${index}.formacion_academica_familiar.capacitacion`}
                                control={form.control}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="cursor-pointer">
                                      Capacitacion (Opcional)
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
                              <FormField
                                control={form.control}
                                name={`familys.${index}.formacion_academica_familiar.carrera_id`}
                                render={({ field }) => (
                                  <FormItem className="cursor-pointer ">
                                    <FormLabel className="cursor-pointer">
                                      Carrera (Opcional)
                                    </FormLabel>
                                    <Select
                                      onValueChange={(values) => {
                                        field.onChange(Number.parseInt(values))
                                        setMencionId(values)
                                      }}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="w-full truncate">
                                          <SelectValue
                                            placeholder={`${isLoadingCarrera ? "Cargando Carreras" : "Seleccione una carrera"}`}
                                          />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {carrera?.data.map((carrera, i) => (
                                          <SelectItem
                                            key={i}
                                            value={`${carrera.id}`}
                                          >
                                            {carrera.nombre_carrera}
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
                                name={`familys.${index}.formacion_academica_familiar.mencion_id`}
                                render={({ field }) => (
                                  <FormItem className=" cursor-pointer">
                                    <FormLabel className="cursor-pointer">
                                      Mención (Opcional)
                                    </FormLabel>
                                    <Select
                                      onValueChange={(values) => {
                                        field.onChange(Number.parseInt(values))
                                      }}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="w-full truncate">
                                          <SelectValue
                                            placeholder={`${isLoadingMencion ? "Cargando Mencion Academica" : "Seleccione una mencion academica"}`}
                                          />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {mencion?.data.map((mencion, i) => (
                                          <SelectItem
                                            key={i}
                                            value={`${mencion.id}`}
                                          >
                                            {mencion.nombre_mencion}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </>
                          )}
                        </fieldset>
                        <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2">
                          <legend className="flex flex-row gap-2">
                            Información de Vestimenta <Shirt />
                          </legend>

                          <FormField
                            control={form.control}
                            name={`familys.${index}.perfil_fisico_familiar.tallaCamisa`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Talla De Camisa</FormLabel>
                                <Select
                                  onValueChange={(v) => field.onChange(Number(v))}
                                  value={field.value ? field.value.toString() : ""}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full truncate">
                                      <SelectValue
                                        placeholder={isLoadingTallas ? "Cargando..." : "Seleccione una talla"}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {camisas.map((item) => (
                                      <SelectItem key={item.id} value={item.id.toString()}>
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
                            name={`familys.${index}.perfil_fisico_familiar.tallaPantalon`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Talla De Pantalón</FormLabel>
                                <Select
                                  onValueChange={(v) => field.onChange(Number(v))}
                                  value={field.value ? field.value.toString() : ""}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full truncate">
                                      <SelectValue
                                        placeholder={isLoadingTallas ? "Cargando..." : "Seleccione una talla"}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {pantalones.map((item) => (
                                      <SelectItem key={item.id} value={item.id.toString()}>
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
                            name={`familys.${index}.perfil_fisico_familiar.tallaZapatos`}
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Talla De Zapatos</FormLabel>
                                <Select
                                  onValueChange={(v) => field.onChange(Number(v))}
                                  value={field.value ? field.value.toString() : ""}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full truncate">
                                      <SelectValue
                                        placeholder={isLoadingTallas ? "Cargando..." : "Seleccione una talla"}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {zapatos.map((item) => (
                                      <SelectItem key={item.id} value={item.id.toString()}>
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
                            name={`familys.${index}.perfil_fisico_familiar.tallaChaqueta`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Talla De Chaqueta</FormLabel>
                                <Select
                                  onValueChange={(v) => field.onChange(Number(v))}
                                  value={field.value ? field.value.toString() : ""}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full truncate">
                                      <SelectValue placeholder={isLoadingTallas ? "Cargando..." : "Seleccione una talla"} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {chaquetas.map((item) => (
                                      <SelectItem key={item.id} value={item.id.toString()}>{item.valor}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </fieldset>
                        <fieldset className="border grid grid-cols-2 gap-2 space-y-4 col-span-2 p-2">
                          <legend className="flex gap-2">
                            Datos De Salud <HeartPulse />
                          </legend>
                          <FormField
                            control={form.control}
                            name={`familys.${index}.perfil_salud_familiar.grupoSanguineo`}
                            render={({ field }) => (
                              <FormItem className="col-span-2 cursor-pointer">
                                <FormLabel className="cursor-pointer">
                                  Grupo Sanguineo{" "}
                                </FormLabel>
                                <Select
                                  onValueChange={(values) => {
                                    field.onChange(Number.parseInt(values))
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
                                    {bloodGroup?.data.map((bloodGroup, i) => (
                                      <SelectItem
                                        key={i}
                                        value={`${bloodGroup.id}`}
                                      >
                                        {bloodGroup.GrupoSanguineo}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <ScrollArea className="h-80">
                            <div className="flex gap-4">
                              <div>
                                <h2 className="font-bold">
                                  Patologias (Opcional)
                                </h2>
                                {patologyGroupList.map((patologys, index) => (
                                  <div key={index}>
                                    <h2 className="p-2 text-sm font-bold">
                                      * {patologys.categoria.toUpperCase()}
                                    </h2>
                                    {patologys.datos.map((patologyItem, i) => (
                                      <div
                                        className="flex flex-col justify-start gap-2  "
                                        key={i}
                                      >
                                        <FormField
                                          control={form.control}
                                          name={`familys.${index}.perfil_salud_familiar.patologiaCronica`}
                                          render={({ field }) => {
                                            const currentValues = Array.isArray(
                                              field.value,
                                            )
                                              ? field.value
                                              : []
                                            if (isLoadingPatology) {
                                              return <Loading />
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
                                                      const newValue = checked
                                                        ? [
                                                            ...currentValues,
                                                            patologyItem.id,
                                                          ]
                                                        : currentValues.filter(
                                                            (id) =>
                                                              id !==
                                                              patologyItem.id,
                                                          )
                                                      field.onChange(newValue)
                                                    }}
                                                  />
                                                </FormControl>
                                                <FormLabel
                                                  key={index}
                                                  className="cursor-pointer"
                                                >
                                                  {patologyItem.patologia}
                                                </FormLabel>
                                              </FormItem>
                                            )
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ))}
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
                                        * {disability.categoria.toUpperCase()}
                                      </h2>
                                      {disability.datos.map(
                                        (disabilityItem, i) => (
                                          <div
                                            className="flex flex-col justify-start gap-2 "
                                            key={i}
                                          >
                                            <FormField
                                              control={form.control}
                                              name={`familys.${index}.perfil_salud_familiar.alergias`}
                                              render={({ field }) => {
                                                const currentValues =
                                                  Array.isArray(field.value)
                                                    ? field.value
                                                    : []
                                                if (isLoadingDisability) {
                                                  return <Loading />
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
                                                                )
                                                          field.onChange(
                                                            newValue,
                                                          )
                                                        }}
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )
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
                                {allergiesGroupList.map((allergies, index) => (
                                  <div key={index}>
                                    <h2 className="p-2 text-sm font-bold">
                                      * {allergies.categoria.toUpperCase()}
                                    </h2>
                                    {allergies.datos.map(
                                      (disabilityItem, i) => (
                                        <div
                                          className="flex flex-col justify-start gap-2 "
                                          key={i}
                                        >
                                          <FormField
                                            control={form.control}
                                            name={`familys.${index}.perfil_salud_familiar.alergias`}
                                            render={({ field }) => {
                                              const currentValues =
                                                Array.isArray(field.value)
                                                  ? field.value
                                                  : []
                                              if (isLoadingDisability) {
                                                return <Loading />
                                              }
                                              return (
                                                <FormItem className="flex flex-row space-y-2">
                                                  <FormLabel className="order-2">
                                                    {disabilityItem.alergia}
                                                  </FormLabel>
                                                  <FormControl>
                                                    <Checkbox
                                                      className="order-1 border-black"
                                                      onCheckedChange={(
                                                        checked,
                                                      ) => {
                                                        const newValue = checked
                                                          ? [
                                                              ...currentValues,
                                                              disabilityItem.id,
                                                            ]
                                                          : currentValues.filter(
                                                              (id) =>
                                                                id !==
                                                                disabilityItem.id,
                                                            )
                                                        field.onChange(
                                                          newValue,
                                                        )
                                                      }}
                                                    />
                                                  </FormControl>
                                                </FormItem>
                                              )
                                            }}
                                          />
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </ScrollArea>
                        </fieldset>
                        <FormField
                          control={form.control}
                          name={`familys.${index}.observaciones`}
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
                      </div>
                    </div>
                  )
                })}
              </div>
            </fieldset>
            <Button className="w-full cursor-pointer">{submitLabel}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
