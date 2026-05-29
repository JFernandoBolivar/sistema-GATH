"use client";
import { imageProfileFn } from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { EmployeeData } from "@/app/types/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SheetContentUI,
  SheetHeaderUI,
  SheetTitleUI,
  SheetTriggerUI,
  SheetUI,
} from "@/components/ui/SheetUI";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInTimeZone } from "date-fns-tz";
import {
  Ambulance,
  ClipboardCheck,
  ContactRound,
  GraduationCap,
  House,
  Shirt,
} from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import FormUpdateAcademyLevel from "@/shared/forms/employees/update/form-academic_training";
import FormUpdateBackground from "@/shared/forms/employees/update/form-background";
import { FormBasicUpdateInfo } from "@/shared/forms/employees/update/form-basic-info";
import FormUpdateDwelling from "@/shared/forms/employees/update/form-dwelling";
import FormUpdateHealth from "@/shared/forms/employees/update/form-health_profile";
import FormUpdatePhysical from "@/shared/forms/employees/update/form-physical_profile";
import updateInfoEmployee from "./updateInfo/actions/update-info";
interface Props {
  employee: EmployeeData;
}
export default function DetailInfoEmployee({ employee }: Props) {
  const { mutate } = useSWRConfig();
  const { data: profileBlob } = useSWR(
    employee.cedulaidentidad ? ["profile", employee.cedulaidentidad] : null,
    () => imageProfileFn(employee.cedulaidentidad),
  );
  const imageUrl = useMemo(() => {
    if (!profileBlob) return "/bg.png";
    return URL.createObjectURL(profileBlob);
  }, [profileBlob]);

  return (
    <SheetUI>
      <SheetTriggerUI
        className={` w-full bg-blue-900 p-2 rounded-sm text-white`}
      >
        Ver Detalles
      </SheetTriggerUI>
      <SheetContentUI className="w-400">
        <ScrollArea className="h-screen">
          <SheetHeaderUI>
            <SheetTitleUI>Información Detallada Del Trabajador</SheetTitleUI>
          </SheetHeaderUI>
          <div className="flex flex-col m-auto justify-between h-full w-full gap-2 ">
            <div className="w-60 h-fit m-auto rounded-sm flex flex-col">
              <Image
                height={700}
                width={700}
                alt="profile"
                src={imageUrl}
                className="rounded-sm object-cover w-full h-full"
              />
              <h2 className="w-full m-auto font-bold text-center">
                {employee.nombres} {employee.apellidos}
              </h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    className="cursor-pointer bg-blue-700 hover:bg-blue-900"
                  >
                    Actualizar Información Basica
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <FormBasicUpdateInfo
                    mutate={mutate} updateInfoEmployee={updateInfoEmployee} mutateKey="api/pasivos"
                    idEmployee={employee.id.toString()}
                    cedulaidentidad={employee.cedulaidentidad}
                    defaultValues={{
                      apellidos: employee.apellidos,
                      estadoCivil: employee.estadoCivil.id,
                      fecha_nacimiento: new Date(employee.fecha_nacimiento),
                      nombres: employee.nombres,
                      sexoid: employee.sexo.id,
                      file: undefined,
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center gap-3">
                  {employee.asignaciones.length > 1
                    ? "Detalles De Cargos Asignados"
                    : "Detalles Del Cargo"}{" "}
                  <ContactRound />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="flex flex-col gap-2">
                    {employee.asignaciones.map((v, i) => (
                      <div
                        className="grid grid-cols-2 place-content-center"
                        key={i}
                      >
                        <div>Código:</div>
                        <div>{v.codigo}</div>
                        <div>Cargo:</div>
                        <div>{v.denominacioncargo.cargo}</div>
                        <div>Cargo Específico:</div>
                        <div>{v.denominacioncargoespecifico.cargo}</div>
                        <div>Tipo De Nomina:</div>
                        <div>{v.tiponomina.nomina}</div>
                        <div>Dirección / Gerencia / Oficina:</div>
                        <div>
                          {v.DireccionGeneral
                            ? v.DireccionGeneral.direccion_general
                            : "N/A"}
                        </div>

                        <div>Estatus</div>
                        <div>
                          <Badge
                            variant={
                              v.estatusid.estatus === "ACTIVO"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {v.estatusid.estatus}
                          </Badge>
                        </div>
                        <div>Organismo Adscrito</div>
                        <div>
                          {v.OrganismoAdscrito
                            ? v.OrganismoAdscrito.Organismoadscrito
                            : "N/A"}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            {employee.antecedentes.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-row items-center gap-3">
                    Antecedentes <ClipboardCheck />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table className="table-fixed w-full">
                    <TableCaption>
                      Lista De Antecedentes En La APN.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">
                          Fecha De ingreso
                        </TableHead>
                        <TableHead className="w-[120px]">
                          Fecha De Egreso
                        </TableHead>
                        {/* 2. No necesitamos truncate aquí, solo en el cuerpo si queremos */}
                        <TableHead>Institución/Ente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.antecedentes.length > 0 &&
                        employee.antecedentes.map((v, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {v.fecha_ingreso
                                ? formatInTimeZone(
                                    new Date(v.fecha_ingreso),
                                    "UTC",
                                    "dd/MM/yyyy",
                                  )
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              {v.fecha_egreso
                                ? formatInTimeZone(
                                    new Date(v.fecha_egreso),
                                    "UTC",
                                    "dd/MM/yyyy",
                                  )
                                : "Presente"}
                            </TableCell>

                            <TableCell className="truncate max-w-[200px]">
                              {v.organismo?.Organismoadscrito ?? "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold">
                          Total años: {employee.anos_apn}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    className="cursor-pointer bg-red-700 hover:bg-red-900"
                  >
                    Agregar Antecedentes Y Ingreso Al Organismo (Opcion Solo
                    Valida Para Este Caso)
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <FormUpdateBackground
                    mutate={mutate} updateInfoEmployee={updateInfoEmployee} mutateKey="api/pasivos"
                    idEmployee={employee.id.toString()}
                    defaultValues={{
                      antecedentes: employee.antecedentes?.length
                        ? employee.antecedentes.map((ant) => ({
                          organismo_id: ant.organismo?.id ?? undefined,
                          fecha_ingreso: ant.fecha_ingreso
                            ? new Date(ant.fecha_ingreso)
                            : undefined,
                          fecha_egreso: ant.fecha_egreso
                            ? new Date(ant.fecha_egreso)
                            : undefined,
                        }))
                        : [],
                    }}
                  />
                </DialogContent>
              </Dialog>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center gap-3 justify-between">
                  <div className="flex flex-row gap-2 items-center">
                    Datos De Vivienda <House />
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        className="cursor-pointer bg-blue-700 hover:bg-blue-900"
                      >
                        Actualizar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <FormUpdateDwelling
                        mutate={mutate} updateInfoEmployee={updateInfoEmployee} mutateKey="api/pasivos"
                        idEmployee={employee.id.toString()}
                      />
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 place-content-center">
                  <div>Estado:</div>
                  <div>{employee.datos_vivienda?.estado?.estado ?? "N/A"}</div>
                  <div>Municipio:</div>
                  <div>
                    {employee.datos_vivienda?.municipio?.municipio ?? "N/A"}
                  </div>
                  <div>Parroquia:</div>
                  <div>
                    {employee.datos_vivienda?.parroquia?.parroquia ?? "N/A"}
                  </div>
                  <div>Condicion De Vivienda:</div>
                  <div>
                    {employee.datos_vivienda?.condicion?.condicion ?? "N/A"}
                  </div>
                  <div>Direccion De Habitación:</div>
                  <div>
                    {employee.datos_vivienda?.direccion_exacta ?? "N/A"}
                  </div>
                  <div>Código Postal:</div>
                  <div>
                    {employee.datos_vivienda?.codigo_postal ?? "N/A"}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center gap-3 justify-between">
                  <div className="flex flex-row gap-2  items-center">
                    Formaciones Academicas <GraduationCap />{" "}
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        className="cursor-pointer bg-blue-700 hover:bg-blue-900"
                      >
                        Actualizar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <FormUpdateAcademyLevel
                        mutate={mutate} updateInfoEmployee={updateInfoEmployee} mutateKey="api/pasivos"
                        idEmployee={employee.id.toString()}
                        defaultValues={{
                          formacion_academica:
                            employee.formacion_academica?.length
                              ? employee.formacion_academica.map((fa) => ({
                                  nivel_Academico_id:
                                    fa.nivelAcademico?.id ?? 0,
                                  carrera_id: fa.carrera?.id ?? 0,
                                  mencion_id: fa.mencion?.id ?? 0,
                                  institucion_id: fa.institucion?.id ?? 0,
                                }))
                              : [],
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 place-content-center">
                  <div>Nivel Academico:</div>
                  <div>
                    {employee.formacion_academica?.[0]?.nivelAcademico
                      ?.nivelacademico ?? "N/A"}
                  </div>
                  <div>Carrera:</div>
                  <div>
                    {employee.formacion_academica?.[0]?.carrera?.nombre_carrera ??
                      "N/A"}
                  </div>
                  <div>Mención:</div>
                  <div>
                    {employee.formacion_academica?.[0]?.mencion?.nombre_mencion ??
                      "N/A"}
                  </div>
                  <div>Institución:</div>
                  <div>
                    {employee.formacion_academica?.[0]?.institucion?.nombre_institucion ?? "N/A"}
                  </div>

                  <div>Capacitación</div>
                  <div>
                    {employee.formacion_academica?.[0]?.capacitacion?.nombre_capacitacion ?? "N/A"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center gap-3 justify-between">
                  <div className="flex flex-row items-center gap-2">
                    Información De Vestimenta <Shirt />
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        className="cursor-pointer bg-blue-700 hover:bg-blue-900"
                      >
                        Actualizar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <FormUpdatePhysical
                        mutate={mutate} updateInfoEmployee={updateInfoEmployee} mutateKey="api/pasivos"
                        idEmployee={employee.id.toString()}
                        defaultValues={{
                          perfil_fisico: {
                            tallaCamisa:
                              Number(employee.perfil_fisico?.tallaCamisa) ?? 0,
                            tallaPantalon:
                              Number(employee.perfil_fisico?.tallaPantalon) ??
                              0,
                            tallaZapatos:
                              Number(employee.perfil_fisico?.tallaZapatos) ?? 0,
                          },
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 place-content-center">
                  <div>Talla De Camisa:</div>
                  <div>
                    {employee.perfil_fisico?.tallaCamisa?.valor ?? "N/A"}
                  </div>
                  <div>Talla de Pantalon:</div>
                  <div>
                    <div>
                      {employee.perfil_fisico?.tallaPantalon?.valor ?? "N/A"}
                    </div>
                  </div>
                  <div>Talla De Calzado:</div>
                  <div>
                    <div>
                      {employee.perfil_fisico?.tallaZapatos?.valor ?? "N/A"}
                    </div>
                  </div>
                  <div>Talla De Chaqueta:</div>
                  <div>
                    {employee.perfil_fisico?.tallaChaqueta?.valor ?? "N/A"}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center gap-3 justify-between">
                  <div className="flex flex-row items-center gap-2">
                    Información De Salud
                    <Ambulance />
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        className="cursor-pointer bg-blue-700 hover:bg-blue-900"
                      >
                        Actualizar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <FormUpdateHealth
                        mutate={mutate} updateInfoEmployee={updateInfoEmployee} mutateKey="api/pasivos"
                        idEmployee={employee.id.toString()}
                        defaultValues={{
                          perfil_salud: {
                            grupoSanguineo: Number(
                              employee.perfil_salud?.grupoSanguineo?.id ??
                                employee.perfil_salud?.grupoSanguineo,
                            ),
                            patologiaCronica:
                              employee.perfil_salud?.patologiasCronicas?.map(
                                (p) => p.id,
                              ) ?? [],
                            discapacidad:
                              employee.perfil_salud?.discapacidad?.map(
                                (d) => d.id,
                              ) ?? [],
                            alergias:
                              employee.perfil_salud?.alergias?.map(
                                (d) => d.id,
                              ) ?? [],
                          },
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 place-content-center">
                  <div>Tipo De Sangre:</div>
                  <div>
                    {employee.perfil_salud?.grupoSanguineo != null
                      ? employee.perfil_salud.grupoSanguineo.GrupoSanguineo
                      : "N/A"}
                  </div>
                  {employee.perfil_salud?.patologiasCronicas &&
                    employee.perfil_salud.patologiasCronicas.length > 0 && (
                      <Table className="col-span-2">
                        <TableCaption>
                          Lista De Patologias Del Trabajador
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Patologia</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employee.perfil_salud.patologiasCronicas.map(
                            (v, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">
                                  {v.categoria.nombre_categoria}
                                </TableCell>
                                <TableCell>{v.patologia}</TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    )}
                  {employee.perfil_salud?.discapacidad &&
                    employee.perfil_salud.discapacidad.length > 0 && (
                      <Table className="col-span-2">
                        <TableCaption>
                          Lista De Discapcidades Del Trabajador
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Discapacidad</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employee.perfil_salud.discapacidad.map((v, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">
                                {v.categoria.nombre_categoria}
                              </TableCell>
                              <TableCell>{v.discapacidad}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  {employee.perfil_salud?.alergias &&
                    employee.perfil_salud.alergias.length > 0 && (
                      <div className="col-span-2">
                        <Table>
                          <TableCaption>
                            Lista De Patologias Del Trabajador
                          </TableCaption>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Alergias</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employee.perfil_salud.alergias.map((v, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">
                                  {v.categoria.nombre_categoria}
                                </TableCell>
                                <TableCell>{v.alergia}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContentUI>
    </SheetUI>
  );
}
