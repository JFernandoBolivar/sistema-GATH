"use client"

import {
  getConditionDwelling,
  getMunicipalitys,
  getParish,
  getStates,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac"
import { Button } from "@/components/ui/button"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import useSWR from "swr"
import { DwellingType, schemaDwelling } from "@/shared/schemas/employees/register/schema-dwelling"

export type Props = {
  onSubmit: (values: DwellingType) => void
  defaultValues: DwellingType
  submitLabel?: string
  showCodigoPostal?: boolean
}

export default function FormDwelling({
  onSubmit,
  defaultValues,
  submitLabel = "Siguiente",
  showCodigoPostal = true,
}: Props) {
  const [stateId, setStateId] = useState<string>()
  const [municipalityId, setMunicipalityId] = useState<string>()
  const { data: states, isLoading: isLoadingStatesStates } = useSWR(
    "states",
    async () => await getStates(),
  )
  const { data: municipalitys, isLoading: isLoadingStatesSMunicipalitys } =
    useSWR(
      stateId ? ["municipalitys", stateId] : null,
      async () => await getMunicipalitys(stateId!),
    )
  const { data: parish, isLoading: isLoadingStatesParish } = useSWR(
    municipalityId ? ["parish", municipalityId] : null,
    async () => await getParish(municipalityId!),
  )
  const {
    data: conditionDwelling,
    isLoading: isLoadingStatesConditionDwelling,
  } = useSWR("conditionDwelling", async () => await getConditionDwelling())
  const form = useForm({
    resolver: zodResolver(schemaDwelling),
    defaultValues,
  })
  const onSubmitFormity = (values: DwellingType) => {
    onSubmit(values)
  }
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Datos Socio-economicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CardAction className="text-gray-500">
            Paso 6: Datos De Vivienda
          </CardAction>
          <div>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmitFormity)}
                className="grid grid-cols-2 gap-3 space-y-3"
              >
                <FormField
                  control={form.control}
                  name="datos_vivienda.estado_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(Number.parseInt(value))
                          setStateId(value)
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={`${isLoadingStatesStates ? "Cargando Estados" : "Seleccione un Estado"}`}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {states?.data.map((state, i) => (
                            <SelectItem key={i} value={`${state.id}`}>
                              {state.estado}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Esta Información Sera Publica
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="datos_vivienda.municipio_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Municipio *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(Number.parseInt(value))
                          setMunicipalityId(value)
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={`${isLoadingStatesSMunicipalitys ? "Cargando Municipios" : "Seleccione un Municpio"}`}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {municipalitys?.data.map((municipality, i) => (
                            <SelectItem key={i} value={`${municipality.id}`}>
                              {municipality.municipio}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Esta Información Sera Publica
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="datos_vivienda.parroquia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parroquia *</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values))
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={`${isLoadingStatesParish ? "Cargando Parroquias" : "Seleccione una Parroquia"}`}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parish?.data.map((parish, i) => (
                            <SelectItem key={i} value={`${parish.id}`}>
                              {parish.parroquia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Esta Información Sera Publica
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="datos_vivienda.condicion_vivienda_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condicion De Vivienda *</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values))
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={`${isLoadingStatesConditionDwelling ? "Cargando Condiciones De Vivienda" : "Seleccione una Condicion De Vivienda"}`}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {conditionDwelling?.data.map(
                            (conditionDwelling, i) => (
                              <SelectItem
                                key={i}
                                value={`${conditionDwelling.id}`}
                              >
                                {conditionDwelling.condicion}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Esta Información Sera Publica
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="datos_vivienda.direccion_exacta"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Direccion Exacta *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Calle, Casa, Apartamento, Sector"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {showCodigoPostal && (
                  <FormField
                    control={form.control}
                    name="datos_vivienda.codigo_postal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Postal</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="1010"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <Button className="w-full col-span-2">{submitLabel}</Button>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
