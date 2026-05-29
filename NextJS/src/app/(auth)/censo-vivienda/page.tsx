"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition, useEffect } from "react"
import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import {
  Search,
  User,
  Building,
  Calendar,
  Phone,
  MapPin,
  Briefcase,
  Clock,
} from "lucide-react"
import InputForm from "@/components/input-form"
import RadioGroupForm from "@/components/form-radio-group"
import CheckboxForm from "@/components/form-checkbox"
import {
  getEmployeeInfo,
  getEmployeeById,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac"
import { EmployeeInfo } from "@/app/types/types"
import { formatInTimeZone } from "date-fns-tz"
import {
  censoViviendaSchema,
  type CensoViviendaValues,
  ENCUESTA_GMVV_OPTIONS,
  SI_NO_OPTIONS,
  BENEFICIADO_PROGRAMA_OPTIONS,
  SITUACION_HABITACIONAL_OPTIONS,
  REHABILITACION_OPTIONS,
} from "@/schemas/censo-vivienda"
import { useEmployeeSearch } from "@/shared/hooks/useEmployeeSearch"
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner"

function calcular_anios_servicio(fecha_ingreso: string | null): string {
  if (!fecha_ingreso) return ""
  const inicio = new Date(fecha_ingreso + "T00:00:00")
  const hoy = new Date()
  const diffMs = hoy.getTime() - inicio.getTime()
  const anios = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
  const meses = Math.floor(
    (diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000)
  )
  if (anios > 0)
    return `${anios} año${anios !== 1 ? "s" : ""} y ${meses} mes${meses !== 1 ? "es" : ""}`
  return `${meses} mes${meses !== 1 ? "es" : ""}`
}

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | null | undefined
}) =>
  value ? (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-gray-500" />
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  ) : null

export default function CensoViviendaPage() {
  const [search_cedula, setSearchCedula] = useState("")
  const [isPending, startTransition] = useTransition()

  const form = useForm<CensoViviendaValues>({
    resolver: zodResolver(censoViviendaSchema),
    defaultValues: {
      cedula_identidad: "",
      nombres: "",
      apellidos: "",
      gerencia: "",
      fecha_ingreso: "",
      tipo_nomina: "",
      anios_servicio_conatel: "",
      anios_servicio_apn: "",
      telefono: "",
      estado_civil: "",
      direccion: "",
      carnet_patria: "",
      encuesta_gmvv: "",
      servicios_previos: "",
      registrado_0800: "",
      vivienda_propia: "",
      beneficiado_programa: "",
      situacion_habitacional: "",
      valor_alquiler: "",
      numero_personas_hogar: "",
      beneficiado_rehabilitacion: "",
      declaracion_fidedigna: false,
      acepto: false,
    },
  })

  const { employee, isLoading, hasSearched, search } = useEmployeeSearch<EmployeeInfo>({
    searchFn: getEmployeeInfo,
    onFound: (emp) => {
      form.setValue("cedula_identidad", emp.cedulaidentidad)
      form.setValue("nombres", emp.nombres)
      form.setValue("apellidos", emp.apellidos)
      if (emp.estadoCivil?.estadoCivil) {
        form.setValue("estado_civil", emp.estadoCivil.estadoCivil)
      }
      if (emp.datos_vivienda?.direccion_exacta) {
        form.setValue("direccion", emp.datos_vivienda.direccion_exacta)
      }
    },
  })

  useEffect(() => {
    if (!employee) return
    let cancelled = false
    ;(async () => {
      if (employee.contrato && employee.contrato.length > 0) {
        const ultimo = employee.contrato[employee.contrato.length - 1]
        if (ultimo.fecha_ingreso) {
          form.setValue("fecha_ingreso", formatInTimeZone(new Date(ultimo.fecha_ingreso + "T00:00:00"), "UTC", "dd/MM/yyyy"))
        }
        if (ultimo.politica?.tipo_politica) {
          form.setValue("tipo_nomina", ultimo.politica.tipo_politica)
        }
        form.setValue("anios_servicio_conatel", calcular_anios_servicio(employee.contrato[0].fecha_ingreso))
      }
      const full = await getEmployeeById(employee.cedulaidentidad)
      if (cancelled) return
      if (full.data && !Array.isArray(full.data)) {
        form.setValue("anios_servicio_apn", full.data.anos_apn?.toString() || "")
        form.setValue("telefono", full.data.telefono_movil || full.data.telefono_habitacion || "")
        if (full.data.asignaciones?.[0]) {
          const dep =
            full.data.asignaciones[0].Dependencia?.dependencia ||
            full.data.asignaciones[0].DireccionGeneral?.direccion_general ||
            ""
          form.setValue("gerencia", dep)
        }
      }
    })()
    return () => { cancelled = true }
  }, [employee])

  const handle_search = () => {
    if (!search_cedula) return
    form.reset()
    search(search_cedula)
  }

  function onSubmit(values: CensoViviendaValues) {
    startTransition(async () => {
      try {
        console.log(values)
        toast.success(
          "Formulario enviado exitosamente. Gracias por completar el censo."
        )
        form.reset()
        setSearchCedula("")
      } catch {
        toast.error("Error al enviar el formulario. Intente nuevamente.")
      }
    })
  }

  return (
    <main className="min-h-screen w-full bg-no-repeat bg-[url('/bg.jpg')] bg-cover object-center py-8 px-4">
      <Toaster closeButton position="top-right" />

      <div className="mx-auto max-w-3xl">
        <Card className="p-6 md:p-10 bg-white border border-gray-200 shadow-lg rounded-lg">
          <div className="mb-8 text-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
              CENSO DE PERSONAL / VIVIENDA
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Oficina de Gestión Humana - CONATEL
            </p>
            <p className="text-xs text-gray-500 mt-1">
              * Indica que la pregunta es obligatoria
            </p>
          </div>

          <div className="flex gap-2 mb-6">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Buscar Trabajador por Cédula
              </label>
              <Input
                type="text"
                placeholder="Ingrese número de cédula sin puntos"
                value={search_cedula}
                onChange={(e) => setSearchCedula(e.target.value)}
                className="placeholder:text-gray-400"
                onKeyDown={(e) => e.key === "Enter" && handle_search()}
              />
            </div>
            <Button
              onClick={handle_search}
              disabled={isLoading || !search_cedula}
              className="self-end cursor-pointer"
              variant="secondary"
            >
              {isLoading ? (
                "Buscando..."
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1" />
                  Buscar
                </>
              )}
            </Button>
          </div>

          <EmployeeInfoBanner
            employee={employee}
            hasSearched={hasSearched}
            isLoading={isLoading}
          />

          {employee && (
            <div className="border-2 border-blue-200 bg-blue-50 rounded-md p-4 mb-6 space-y-2">
              <h3 className="font-bold text-sm text-blue-900 border-b border-blue-200 pb-1 mb-2">
                DATOS DEL TRABAJADOR
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoRow
                  icon={User}
                  label="Nombre"
                  value={`${employee.nombres} ${employee.apellidos}`}
                />
                <InfoRow
                  icon={User}
                  label="Cédula"
                  value={form.getValues("cedula_identidad")}
                />
                <InfoRow
                  icon={Building}
                  label="Gerencia"
                  value={form.getValues("gerencia")}
                />
                <InfoRow
                  icon={Calendar}
                  label="F. Ingreso"
                  value={form.getValues("fecha_ingreso")}
                />
                <InfoRow
                  icon={Briefcase}
                  label="Tipo Nómina"
                  value={form.getValues("tipo_nomina")}
                />
                <InfoRow
                  icon={Clock}
                  label="Años CONATEL"
                  value={form.getValues("anios_servicio_conatel")}
                />
                <InfoRow
                  icon={Clock}
                  label="Años APN"
                  value={form.getValues("anios_servicio_apn")}
                />
                <InfoRow
                  icon={Phone}
                  label="Teléfono"
                  value={form.getValues("telefono")}
                />
                <InfoRow
                  icon={User}
                  label="Edo. Civil"
                  value={form.getValues("estado_civil")}
                />
                <InfoRow
                  icon={MapPin}
                  label="Dirección"
                  value={form.getValues("direccion")}
                />
              </div>
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-6"
            >
              <InputForm
                form={form}
                label="N° CARNET DE LA PATRIA *"
                nameInput="carnet_patria"
                type="text"
                placeholder="N° Carnet de la Patria"
              />

              <RadioGroupForm
                form={form}
                label="¿RECIBIÓ USTED Y COMPLETÓ LA ENCUESTA 'GRAN MISIÓN VIVIENDA VENEZUELA' HABILITADA RECIENTEMENTE EN LA PLATAFORMA PATRIA? *"
                nameInput="encuesta_gmvv"
                options={[...ENCUESTA_GMVV_OPTIONS]}
              />

              <RadioGroupForm
                form={form}
                label="¿PRESTÓ SERVICIOS EN CONATEL PREVIAMENTE A SU VINCULACIÓN ACTUAL? *"
                nameInput="servicios_previos"
                options={[...SI_NO_OPTIONS]}
              />

              <RadioGroupForm
                form={form}
                label="¿ESTA REGISTRADO EN 0800MIHOGAR? *"
                nameInput="registrado_0800"
                options={[...SI_NO_OPTIONS]}
              />

              <RadioGroupForm
                form={form}
                label="¿POSEE USTED VIVIENDA PROPIA? *"
                nameInput="vivienda_propia"
                options={[...SI_NO_OPTIONS]}
              />

              <RadioGroupForm
                form={form}
                label="HA SIDO BENEFICIADO POR ALGÚN PROGRAMA HABITACIONAL DEL ESTADO VENEZOLANO (GMVV / INAVI / FONDUR / CONAVI): *"
                nameInput="beneficiado_programa"
                options={[...BENEFICIADO_PROGRAMA_OPTIONS]}
              />

              <RadioGroupForm
                form={form}
                label="¿CUÁL ES SU SITUACIÓN HABITACIONAL ACTUAL? *"
                nameInput="situacion_habitacional"
                options={[...SITUACION_HABITACIONAL_OPTIONS]}
              />

              <InputForm
                form={form}
                label="SI ALQUILA : VALOR MENSUAL APROXIMADO (BS/USD):"
                nameInput="valor_alquiler"
                type="text"
                placeholder="Valor mensual aproximado"
              />

              <InputForm
                form={form}
                label="NÚMERO DE PERSONAS QUE CONVIVEN EN EL HOGAR: *"
                nameInput="numero_personas_hogar"
                type="number"
                placeholder="N° de personas"
              />

              <RadioGroupForm
                form={form}
                label="HA SIDO BENEFICIADO POR ALGÚN PROGRAMA REHABILITACIÓN DE VIVIENDA POR PARTE DEL ESTADO VENEZOLANO: *"
                nameInput="beneficiado_rehabilitacion"
                options={[...REHABILITACION_OPTIONS]}
              />

              <div className="border-t border-gray-200 pt-6 mt-4">
                <p className="text-xs text-gray-600 mb-4 text-justify">
                  La información suministrada a través de este censo es
                  estrictamente confidencial y de uso exclusivo interno para los
                  fines institucionales de la Oficina de Gestión Humana. Los
                  datos recabados serán tratados con total reserva y protección,
                  garantizando el cumplimiento de los principios de privacidad y
                  transparencia en el manejo de la información de nuestro
                  personal.
                </p>

                <h3 className="font-semibold mb-3 text-sm text-gray-900">
                  DECLARACIÓN JURADA Y ENVÍO *
                </h3>

                <CheckboxForm
                  form={form}
                  label="POR MEDIO DE LA PRESENTE DECLARO QUE LOS DATOS SUMINISTRADOS SON VERIFICABLES Y FIDEDIGNOS."
                  nameInput="declaracion_fidedigna"
                />

                <CheckboxForm
                  form={form}
                  label="SÍ, ACEPTO Y DECLARO"
                  nameInput="acepto"
                />
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="w-full py-6 text-base font-semibold"
                size="lg"
              >
                {isPending ? "Enviando..." : "ENVIAR CENSO"}
              </Button>
            </form>
          </Form>
        </Card>
      </div>
    </main>
  )
}
