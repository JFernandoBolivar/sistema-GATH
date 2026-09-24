"use client";

/**
 * Página "Agregar Familiar" (/familiares/registrar):
 * Réplica exacta de UI y efectos de crear-familiar.tsx del legado:
 * 1. Búsqueda previa de empleado (EmployeeSearchForm + EmployeeInfoBanner).
 * 2. Solo al encontrar al trabajador, despliega el formulario para agregar familiar.
 * 3. Secciones en fieldsets coloreados con leyendas e iconos:
 *    - Datos Personales (border-green-600, Database, switch menor de 9 años, Popover fecha)
 *    - Relación Y Parentesco (border-amber-700, Contact, orden de hijo condicional, switches mismo ente / heredero)
 *    - Información Académica (border-blue-700, BookAIcon, switch más detalles, inline altas)
 *    - Información de Vestimenta (border-purple-900, Shirt, tallas agrupadas por región)
 *    - Datos De Salud (border-red-700, HeartPulse, ScrollArea 3 columnas patologías/discapacidades/alergias)
 *    - Observaciones (Textarea)
 *    - Documentos Del Familiar (border-orange-600, FileUpload cédula y partida condicional)
 * 4. Botón "Agregar Familiar" a ancho completo, Loading animado mientras procesa y toast vía Sonner.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarIcon,
  Contact,
  Database,
} from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Calendar } from "@/shared/ui/components/calendar";
import { Card, CardContent } from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Loading } from "@/shared/ui/components/loading";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Switch } from "@/shared/ui/components/switch";
import { Textarea } from "@/shared/ui/components/textarea";
import { EmployeeSearchForm } from "@/shared/components/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { getEmpleadoPorCedulaAction } from "@/modules/personal/infrastructure/actions/personal-actions";

import {
  CATALOGOS_FAMILIAR_VACIOS,
  type CatalogosFamiliarDTO,
  type GuardarFamiliarInputDTO,
} from "../application/dtos/familiar-dto";
import {
  crearFamiliarAction,
  getCatalogosFamiliarAction,
  subirDocumentoFamiliarAction,
} from "../infrastructure/actions/familiares-actions";
import { familiarSchema, type FamiliarFormType } from "./schema/schema-familiar";
import { FamiliarFormacionAcademica } from "./familiar-formacion-academica";
import { FamiliarPerfilSalud } from "./familiar-perfil-salud";
import { FamiliarPerfilFisico } from "./familiar-perfil-fisico";
import { FamiliarDocumentos } from "./familiar-documentos";
import { ID_OTRA_FAMILIAR } from "./catalogo-otra-familiar";
import { resolverPendientesOtraFamiliar, type PendienteOtraFamiliar } from "./resolver-otra-familiar";

interface EmployeeSummary {
  nombres: string;
  apellidos?: string;
  cedulaidentidad: string;
}

const defaultValues: FamiliarFormType = {
  empleadoCedula: "",
  cedulaFamiliar: null,
  primerNombre: "",
  segundoNombre: null,
  primerApellido: "",
  segundoApellido: null,
  parentescoId: 0,
  ordenHijo: null,
  fechaNacimiento: "",
  sexoId: 0,
  mismoEnte: false,
  heredero: false,
  observaciones: null,
  formacionAcademica: undefined,
  perfilSalud: undefined,
  perfilFisico: undefined,
};

export default function FamiliarRegistrarPage() {
  const searchParams = useSearchParams();
  const cedulaQuery = searchParams.get("cedula");

  const [catalogos, setCatalogos] = useState<CatalogosFamiliarDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  // Búsqueda del empleado
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Switch menor de 9 años
  const [down, setDown] = useState(false);

  // Archivos
  const [archivoCedula, setArchivoCedula] = useState<File | null>(null);
  const [archivoPartida, setArchivoPartida] = useState<File | null>(null);

  useEffect(() => {
    getCatalogosFamiliarAction()
      .then(setCatalogos)
      .catch(() => setCatalogos(CATALOGOS_FAMILIAR_VACIOS));
  }, []);

  const form = useForm<FamiliarFormType>({
    resolver: zodResolver(familiarSchema),
    defaultValues,
  });

  const handleSearch = async (cedula: string) => {
    if (!cedula.trim()) return;
    setIsLoadingSearch(true);
    setHasSearched(true);
    try {
      const res = await getEmpleadoPorCedulaAction(cedula.trim());
      if (res && "cedula" in res) {
        setEmployee({
          nombres: res.nombres,
          apellidos: res.apellidos,
          cedulaidentidad: res.cedula,
        });
        form.setValue("empleadoCedula", res.cedula, { shouldValidate: true });
      } else {
        setEmployee(null);
      }
    } catch {
      setEmployee(null);
    } finally {
      setIsLoadingSearch(false);
    }
  };

  useEffect(() => {
    if (cedulaQuery && !hasSearched) {
      handleSearch(cedulaQuery);
    }
  }, [cedulaQuery, hasSearched]);

  // Parentesco seleccionado
  const parentescoId = form.watch("parentescoId");
  const parentescoSeleccionado = useMemo(() => {
    return catalogos?.parentescos.find((p) => p.id === Number(parentescoId));
  }, [catalogos, parentescoId]);

  const esHijo = useMemo(() => {
    const desc = (parentescoSeleccionado?.nombre ?? "").toUpperCase();
    return desc.includes("HIJO") || desc.includes("HIJA");
  }, [parentescoSeleccionado]);

  // Fecha actual para el popover
  const fechaNac = form.watch("fechaNacimiento");

  const onGuardar = (data: FamiliarFormType) => {
    startTransition(async () => {
      // 1. Resolver opciones "Otra" en Formación Académica
      const fa = data.formacionAcademica;
      const pendientes: PendienteOtraFamiliar[] = [];
      if (fa) {
        if (fa.carreraId === ID_OTRA_FAMILIAR) {
          pendientes.push({
            solicitud: { tipo: "carreras", nombre: fa.nuevaCarreraNombre ?? "", padreId: fa.nivelAcademicoId },
            faltaNombre: "Debe escribir el nombre de la nueva carrera",
            asignar: (id) => (fa.carreraId = id),
          });
        }
        if (fa.mencionId === ID_OTRA_FAMILIAR) {
          pendientes.push({
            solicitud: { tipo: "menciones", nombre: fa.nuevaMencionNombre ?? "", padreId: fa.carreraId ?? undefined },
            faltaNombre: "Debe escribir el nombre de la nueva mención",
            asignar: (id) => (fa.mencionId = id),
          });
        }
        if (fa.institucionId === ID_OTRA_FAMILIAR) {
          pendientes.push({
            solicitud: { tipo: "instituciones", nombre: fa.nuevaInstitucionNombre ?? "" },
            faltaNombre: "Debe escribir el nombre de la nueva institución",
            asignar: (id) => (fa.institucionId = id),
          });
        }
      }
      const errorOtra = await resolverPendientesOtraFamiliar(pendientes);
      if (errorOtra) {
        toast.error(errorOtra);
        return;
      }

      const ps = data.perfilSalud;
      const pf = data.perfilFisico;

      const payload: GuardarFamiliarInputDTO = {
        ...(data as GuardarFamiliarInputDTO),
        empleadoCedula: employee?.cedulaidentidad ?? data.empleadoCedula,
        cedulaFamiliar: down ? null : (data.cedulaFamiliar || null),
        formacionAcademica: fa?.nivelAcademicoId
          ? {
              nivelAcademicoId: fa.nivelAcademicoId,
              carreraId: fa.carreraId ?? null,
              mencionId: fa.mencionId ?? null,
              institucionId: fa.institucionId ?? null,
            }
          : null,
        perfilSalud: ps?.grupoSanguineoId
          ? {
              grupoSanguineoId: ps.grupoSanguineoId,
              alergias: ps.alergias ?? [],
              patologiasCronicas: ps.patologiasCronicas ?? [],
              discapacidades: ps.discapacidades ?? [],
            }
          : null,
        perfilFisico:
          pf?.tallaCamisaId && pf?.tallaPantalonId && pf?.tallaZapatosId
            ? {
                tallaCamisaId: pf.tallaCamisaId,
                tallaPantalonId: pf.tallaPantalonId,
                tallaZapatosId: pf.tallaZapatosId,
                tallaChaquetaId: pf.tallaChaquetaId ?? null,
              }
            : null,
      };

      const resultado = await crearFamiliarAction(payload);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
        return;
      }

      // Subida de documentos
      const familiarId = resultado.id;
      if (familiarId && (archivoCedula || archivoPartida)) {
        try {
          if (archivoCedula) {
            const r = await subirDocumentoFamiliarAction(familiarId, "cedula", archivoCedula);
            if (r && typeof r === "object" && "error" in r) {
              toast.error(`Error al subir cédula: ${r.error}`);
            }
          }
          if (archivoPartida && esHijo) {
            const r = await subirDocumentoFamiliarAction(familiarId, "partida_nacimiento", archivoPartida);
            if (r && typeof r === "object" && "error" in r) {
              toast.error(`Error al subir partida de nacimiento: ${r.error}`);
            }
          }
        } catch (e) {
          console.error("Error subiendo documentos:", e);
        }
      }

      toast.success("Familiar agregado exitosamente");

      // Resetear campos del formulario manteniendo el empleado actual
      form.reset({
        ...defaultValues,
        empleadoCedula: employee?.cedulaidentidad ?? "",
      });
      setDown(false);
      setArchivoCedula(null);
      setArchivoPartida(null);
    });
  };

  return (
    <PageLayout title="Agregar Familiar" description="Registre los familiares del empleado">
      <Card className="bg-white">
        <CardContent className="gap-5 bg-white p-6">
          <div className="flex flex-col gap-2">
            <EmployeeSearchForm
              onSearch={handleSearch}
              disabled={isLoadingSearch || isPending}
            />

            <EmployeeInfoBanner
              employee={employee}
              hasSearched={hasSearched}
              isLoading={isLoadingSearch}
            />
          </div>

          {employee && (
            <div className="mt-4">
              {isPending ? (
                <Loading promiseMessage="Agregando Familiar" />
              ) : (
                <form onSubmit={form.handleSubmit(onGuardar)} className="space-y-6" noValidate>
                  <div className="grid grid-cols-2 gap-4">
                    {/* FIELDSET 1: DATOS PERSONALES */}
                    <fieldset className="border grid grid-cols-2 gap-4 col-span-2 p-2 border-green-600 rounded-sm">
                      <legend className="flex gap-2 text-green-700 font-bold items-center">
                        Datos Personales <Database className="size-5" />
                      </legend>

                      {/* Cédula Familiar */}
                      <div className="col-span-2 flex flex-col gap-1.5">
                        <Label htmlFor="cedulaFamiliar" className="cursor-pointer">
                          Cédula Familiar
                        </Label>
                        <Input
                          id="cedulaFamiliar"
                          type="text"
                          disabled={down}
                          placeholder={
                            down
                              ? "Se tomara la cedula del trabajador como representante del menor de edad"
                              : ""
                          }
                          {...form.register("cedulaFamiliar")}
                        />
                        <div className="flex justify-end items-center gap-2 pt-1">
                          <Label htmlFor="switch-menor-9" className="text-xs text-muted-foreground cursor-pointer">
                            ¿El Familiar Es Menor De 9 años?
                          </Label>
                          <Switch
                            id="switch-menor-9"
                            checked={down}
                            onCheckedChange={(bool) => {
                              setDown(bool);
                              form.setValue("cedulaFamiliar", bool ? "" : "");
                            }}
                            className="cursor-pointer"
                          />
                        </div>
                        {form.formState.errors.cedulaFamiliar && (
                          <p role="alert" className="text-sm text-destructive">
                            {form.formState.errors.cedulaFamiliar.message}
                          </p>
                        )}
                      </div>

                      {/* Primer Nombre */}
                      <Field data-invalid={!!form.formState.errors.primerNombre}>
                        <Label htmlFor="primerNombre" className="cursor-pointer">
                          Primer Nombre *
                        </Label>
                        <Input
                          id="primerNombre"
                          type="text"
                          {...form.register("primerNombre")}
                          aria-invalid={!!form.formState.errors.primerNombre}
                        />
                        {form.formState.errors.primerNombre && (
                          <p role="alert" className="text-sm text-destructive">
                            {form.formState.errors.primerNombre.message}
                          </p>
                        )}
                      </Field>

                      {/* Segundo Nombre */}
                      <Field>
                        <Label htmlFor="segundoNombre" className="cursor-pointer">
                          Segundo Nombre
                        </Label>
                        <Input
                          id="segundoNombre"
                          type="text"
                          {...form.register("segundoNombre")}
                        />
                      </Field>

                      {/* Primer Apellido */}
                      <Field data-invalid={!!form.formState.errors.primerApellido}>
                        <Label htmlFor="primerApellido" className="cursor-pointer">
                          Primer Apellido *
                        </Label>
                        <Input
                          id="primerApellido"
                          type="text"
                          {...form.register("primerApellido")}
                          aria-invalid={!!form.formState.errors.primerApellido}
                        />
                        {form.formState.errors.primerApellido && (
                          <p role="alert" className="text-sm text-destructive">
                            {form.formState.errors.primerApellido.message}
                          </p>
                        )}
                      </Field>

                      {/* Segundo Apellido */}
                      <Field>
                        <Label htmlFor="segundoApellido" className="cursor-pointer">
                          Segundo Apellido
                        </Label>
                        <Input
                          id="segundoApellido"
                          type="text"
                          {...form.register("segundoApellido")}
                        />
                      </Field>

                      {/* Sexo */}
                      <Field data-invalid={!!form.formState.errors.sexoId}>
                        <Label className="cursor-pointer">Sexo *</Label>
                        <Select
                          value={form.watch("sexoId") ? String(form.watch("sexoId")) : ""}
                          onValueChange={(val) => form.setValue("sexoId", Number(val), { shouldValidate: true })}
                        >
                          <SelectTrigger className="w-full truncate">
                            <SelectValue placeholder="Seleccione un Genero" />
                          </SelectTrigger>
                          <SelectContent>
                            {(catalogos?.sexos ?? []).map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.sexoId && (
                          <p role="alert" className="text-sm text-destructive">
                            {form.formState.errors.sexoId.message}
                          </p>
                        )}
                      </Field>

                      {/* Fecha de Nacimiento */}
                      <Field data-invalid={!!form.formState.errors.fechaNacimiento} className="flex flex-col grow shrink basis-40">
                        <Label className="cursor-pointer">Fecha de Nacimiento *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="font-light w-full justify-between"
                            >
                              {fechaNac ? (
                                format(new Date(fechaNac + "T00:00:00"), "dd/MM/yyyy")
                              ) : (
                                <span>Selecciona una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto size-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              selected={fechaNac ? new Date(fechaNac + "T00:00:00") : undefined}
                              mode="single"
                              onSelect={(date) => {
                                if (date) {
                                  const yyyy = date.getFullYear();
                                  const mm = String(date.getMonth() + 1).padStart(2, "0");
                                  const dd = String(date.getDate()).padStart(2, "0");
                                  form.setValue("fechaNacimiento", `${yyyy}-${mm}-${dd}`, { shouldValidate: true });
                                }
                              }}
                              disabled={(date: Date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              captionLayout="dropdown"
                            />
                          </PopoverContent>
                        </Popover>
                        {form.formState.errors.fechaNacimiento && (
                          <p role="alert" className="text-sm text-destructive">
                            {form.formState.errors.fechaNacimiento.message}
                          </p>
                        )}
                      </Field>
                    </fieldset>

                    {/* FIELDSET 2: RELACIÓN Y PARENTESCO */}
                    <fieldset className="border grid grid-cols-2 gap-4 col-span-2 p-2 border-amber-700 rounded-sm">
                      <legend className="flex gap-2 text-amber-700 font-bold items-center">
                        Relación Y Parentesco <Contact className="size-5" />
                      </legend>

                      <Field data-invalid={!!form.formState.errors.parentescoId} className={esHijo ? "col-span-1" : "col-span-2"}>
                        <Label className="cursor-pointer">Parentesco *</Label>
                        <Select
                          value={form.watch("parentescoId") ? String(form.watch("parentescoId")) : ""}
                          onValueChange={(val) => form.setValue("parentescoId", Number(val), { shouldValidate: true })}
                        >
                          <SelectTrigger className="w-full truncate">
                            <SelectValue placeholder="Seleccione un Parentesco" />
                          </SelectTrigger>
                          <SelectContent>
                            {(catalogos?.parentescos ?? []).map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.parentescoId && (
                          <p role="alert" className="text-sm text-destructive">
                            {form.formState.errors.parentescoId.message}
                          </p>
                        )}
                      </Field>

                      {esHijo && (
                        <Field className="col-span-1">
                          <Label className="cursor-pointer">Orden de nacimiento</Label>
                          <Select
                            value={form.watch("ordenHijo") ? String(form.watch("ordenHijo")) : ""}
                            onValueChange={(val) => form.setValue("ordenHijo", Number(val))}
                          >
                            <SelectTrigger className="w-full truncate">
                              <SelectValue placeholder="Seleccione Un Orden De Nacimiento" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 27 }, (_, i) => i + 1).map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}

                      <div className="flex flex-row items-center justify-center gap-3 m-auto col-span-1">
                        <Label htmlFor="work" className="cursor-pointer text-sm">
                          ¿El Familiar Trabaja En Este Ente?
                        </Label>
                        <Switch
                          id="work"
                          checked={form.watch("mismoEnte")}
                          onCheckedChange={(val) => form.setValue("mismoEnte", val)}
                          className="scale-100 cursor-pointer"
                        />
                      </div>

                      <div className="flex flex-row items-center justify-center gap-3 m-auto col-span-1">
                        <Label htmlFor="soon" className="cursor-pointer text-sm">
                          ¿El Familiar Es Heredero?
                        </Label>
                        <Switch
                          id="soon"
                          checked={form.watch("heredero")}
                          onCheckedChange={(val) => form.setValue("heredero", val)}
                          className="scale-100 cursor-pointer"
                        />
                      </div>
                    </fieldset>

                    {/* FIELDSET 3: INFORMACIÓN ACADÉMICA */}
                    <FamiliarFormacionAcademica form={form} catalogos={catalogos} />

                    {/* FIELDSET 4: INFORMACIÓN DE VESTIMENTA */}
                    <FamiliarPerfilFisico form={form} catalogos={catalogos} />

                    {/* FIELDSET 5: DATOS DE SALUD */}
                    <FamiliarPerfilSalud form={form} catalogos={catalogos} />

                    {/* OBSERVACIONES */}
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="observaciones" className="cursor-pointer">
                        Observaciones (Opcional)
                      </Label>
                      <Textarea
                        id="observaciones"
                        placeholder="Describa las observaciones del familiar..."
                        rows={4}
                        className="mt-1"
                        {...form.register("observaciones")}
                      />
                    </div>

                    {/* FIELDSET 6: DOCUMENTOS */}
                    <FamiliarDocumentos
                      archivoCedula={archivoCedula}
                      onCedulaChange={setArchivoCedula}
                      archivoPartida={archivoPartida}
                      onPartidaChange={setArchivoPartida}
                      esHijo={esHijo}
                    />
                  </div>

                  <Button type="submit" className="w-full cursor-pointer mt-4">
                    Agregar Familiar
                  </Button>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
