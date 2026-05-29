"use client"

import {
  ArrowBigDownDash,
  ArrowBigUpDash,
  ChevronDownIcon,
  Cross,
  Trash,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { formatInTimeZone } from "date-fns-tz"
import { useFieldArray, useForm } from "react-hook-form"
import useSWR from "swr"
import { z } from "zod"
import { getOrganismosAds } from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac"
import {
  BackgroundType,
  schemaBackground,
} from "@/shared/schemas/employees/register/schema-background"
import { Badge } from "@/components/ui/badge"

type Props = {
  onSubmit: (values: BackgroundType) => void
  defaultValues: BackgroundType
}

export default function FormBackground({ onSubmit, defaultValues }: Props) {
  const form = useForm({
    resolver: zodResolver(schemaBackground),
    values: defaultValues,
  })
  const { data: organismos } = useSWR(
    "organismos",
    async () => await getOrganismosAds(),
  )
  const { fields, append, remove } = useFieldArray({
    name: "antecedentes",
    control: form.control,
  })
  const onSubmitFormity = (data: z.infer<typeof schemaBackground>) => {
    onSubmit(data)
  }
  const isError = Object.keys(form.formState.errors).length === 0
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Antecedentes En La Administracion Publica</CardTitle>
      </CardHeader>

      <CardContent>
        <CardAction className="text-gray-600">
          Paso 3: Datos Laborales
        </CardAction>
      </CardContent>

      <CardContent className="">
        <Form {...form}>
          <form
            className="flex flex-row flex-wrap gap-2"
            onSubmit={form.handleSubmit(onSubmitFormity)}
          >
            <div className="flex justify-end  gap-2  mr-4 items-center ">
              <div className="flex flex-col items-center justify-center">
                <Label htmlFor="clean">Limpiar</Label>
                <Button
                  id="clean"
                  variant={"destructive"}
                  type="button"
                  className=" cursor-pointer"
                  onClick={() => {
                    remove(
                      fields
                        .filter((field, index) => index !== 0)
                        .map((field, index) => index + 1),
                    )
                    form.reset({
                      antecedentes: [
                        {
                          fecha_ingreso: undefined,
                          fecha_egreso: undefined,
                          organismo_id: undefined,
                          nuevo_organismo_nombre: undefined,
                        },
                      ],
                    } as BackgroundType)
                  }}
                >
                  <Trash />
                </Button>
              </div>
              {isError && (
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="add">Agregar</Label>
                  <Button
                    id="add"
                    variant={"default"}
                    type="button"
                    className="cursor-pointer"
                    onClick={() => {
                      append({
                        fecha_ingreso: undefined,
                        fecha_egreso: undefined,
                        organismo_id: undefined,
                        nuevo_organismo_nombre: undefined,
                      })
                    }}
                  >
                    <Cross />
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="h-60   rounded-md w-full border p-2">
              <h1 className="text-gray-600">
                Opcional si no posee antecedentes
              </h1>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-row gap-5 space-y-5 items-center justify-around w-full"
                >
                  <FormField
                    control={form.control}
                    name={`antecedentes.${index}.fecha_ingreso`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {" "}
                          {index + 1}. Fecha Inicio <ArrowBigDownDash />
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                id="date-start"
                                className="w-48 justify-between font-normal"
                              >
                                {field.value ? (
                                  formatInTimeZone(
                                    field.value,
                                    "UTC",
                                    "dd/MM/yyy",
                                  )
                                ) : (
                                  <span>Selecciona una fecha</span>
                                )}
                                <ChevronDownIcon />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto overflow-hidden p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={field.value}
                              captionLayout="dropdown"
                              disabled={(date) =>
                                date > new Date() ||
                                date < new Date("1930-01-01")
                              }
                              onSelect={(date) => {
                                field.onChange(date)
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`antecedentes.${index}.fecha_egreso`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {index + 1}. Fecha Culminacion <ArrowBigUpDash />
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                id="date-start"
                                className="w-48 justify-between font-normal"
                              >
                                {field.value ? (
                                  formatInTimeZone(
                                    field.value,
                                    "UTC",
                                    "dd/MM/yyy",
                                  )
                                ) : (
                                  <span>Selecciona una fecha</span>
                                )}
                                <ChevronDownIcon />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto overflow-hidden p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={field.value}
                              captionLayout="dropdown"
                              disabled={(date) =>
                                date > new Date() ||
                                date < new Date("1930-01-01")
                              }
                              onSelect={(date) => {
                                field.onChange(date)
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`antecedentes.${index}.organismo_id`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organismo</FormLabel>
                          <Select
                            onValueChange={(v) => {
                              if (v === "-1") {
                                field.onChange(-1)
                              } else {
                                const numV = Number(v)
                                field.onChange(numV)
                                form.setValue(
                                  `antecedentes.${index}.nuevo_organismo_nombre` as never,
                                  "" as never,
                                )
                              }
                            }}
                            value={
                              field.value === -1
                                ? "-1"
                                : field.value?.toString() ?? ""
                            }
                          >
                            <FormControl>
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Seleccione un Organismo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {organismos?.data?.map((i) => (
                                <SelectItem key={i.id} value={i.id.toString()}>
                                  {i.Organismoadscrito}
                                </SelectItem>
                              ))}
                              <SelectItem value="-1">Otra</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div
                      className={
                        form.watch(
                          `antecedentes.${index}.organismo_id`,
                        ) === -1
                          ? ""
                          : "hidden"
                      }
                    >
                      <FormField
                        control={form.control}
                        name={`antecedentes.${index}.nuevo_organismo_nombre`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>&nbsp;</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Nuevo organismo..."
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
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm font-medium leading-none invisible">X</span>
                    <Button
                      type="button"
                      variant={"destructive"}
                      size="icon"
                      className={`${index === 0 ? "invisible" : ""} cursor-pointer`}
                      onClick={() => remove(index)}
                    >
                      <X />
                    </Button>
                  </div>
                </div>
              ))}
            </ScrollArea>
            {!isError && (
              <Badge
                className="animate-pulse text-lg font-bold text-white w-full flex justify-center items-center text-center h-auto py-2 whitespace-normal"
                variant={"destructive"}
              >
                Por favor, corrija los campos marcados o complete la información
                pendiente antes de agregar un nuevo antecedente.
              </Badge>
            )}
            <Button className="mt-4 w-full cursor-pointer">Siguiente</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
