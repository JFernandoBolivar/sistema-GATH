"use client";
import { EmployeeData } from "@/app/types/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import {
  Ambulance,
  ClipboardCheck,
  ContactRound,
  GraduationCap,
  House,
  MoreHorizontal,
  Shirt,
} from "lucide-react";
import { DataTableColumnHeader } from "./data-table-column-header";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  SheetContentUI,
  SheetHeaderUI,
  SheetTitleUI,
  SheetTriggerUI,
  SheetUI,
} from "@/components/ui/SheetUI";
import Image from "next/image";
import { formatInTimeZone } from "date-fns-tz";
export const columsReport: ColumnDef<EmployeeData>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },

  {
    accessorKey: "cedulaidentidad",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cédula" />
    ),
  },
  {
    accessorKey: "nombres",
    header: "Nombres",
  },
  {
    accessorKey: "apellidos",
    header: "Apellidos",
  },
  {
    accessorKey: "sexo.sexo",
    header: "Sexo",
  },
  {
    accessorKey: "fecha_nacimiento",
    header: "Fecha de Nacimiento",
    cell: ({ getValue }) => {
      const fecha = getValue() as string;
      return (
        <span>
          {fecha ? formatInTimeZone(fecha, "UTC", "dd/MM/yyyy") : "N/A"}
        </span>
      );
    },
  },
  {
    accessorKey: "n_contrato",
    header: "Número De Ingreso",
    cell: ({ getValue }) => {
      const numero = getValue();
      return <span>{numero ? numero.toString() : "N/A"}</span>;
    },
  },
  {
    accessorKey: "fechaingresoorganismo",
    header: "F. Ingreso Al Organismo",
  },

  {
    accessorKey: "actions",
    header: "Acciones",
    cell: ({ row }) => {
      const employee = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                navigator.clipboard.writeText(employee.cedulaidentidad)
              }
            >
              Copiar Cédula De Identidad
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Extras</DropdownMenuLabel>

            <DropdownMenuItem asChild>
              <SheetUI>
                <SheetTriggerUI
                  className={` w-full bg-blue-900 p-2 rounded-sm text-white`}
                >
                  Ver Detalles
                </SheetTriggerUI>
                <SheetContentUI className="w-400">
                  <ScrollArea className="h-screen">
                    <SheetHeaderUI>
                      <SheetTitleUI>
                        Información Detallada Del Trabajador
                      </SheetTitleUI>
                    </SheetHeaderUI>
                    <div className="flex flex-col m-auto justify-between h-full w-full gap-2">
                      <div className="w-60 h-60 m-auto rounded-sm flex flex-col">
                        <Image
                          height={64}
                          width={64}
                          alt="profile"
                          src="/bg.png"
                          className="rounded-sm object-cover w-full h-full"
                        />
                        <h2 className="w-full m-auto font-bold text-center">
                          {employee.nombres} {employee.apellidos}
                        </h2>
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
                                  <div>
                                    {v.denominacioncargoespecifico.cargo}
                                  </div>
                                  <div>Tipo De Nomina:</div>
                                  <div>{v.tiponomina.nomina}</div>
                                  <div>D / O / G:</div>
                                  <div>
                                    {v.DireccionGeneral
                                      ? v.DireccionGeneral.direccion_general
                                      : "N/A"}
                                  </div>
                                  <div>Dirección De Linea:</div>
                                  <div>
                                    {v.DireccionLinea
                                      ? v.DireccionLinea?.direccion_linea
                                      : "N/A"}
                                  </div>
                                  <div>Coordinación</div>
                                  <div>
                                    {v.Coordinacion
                                      ? v.Coordinacion?.coordinacion
                                      : "N/A"}
                                  </div>
                                  <div>Grado</div>
                                  <div>{v.grado ? v.grado.grado : "N/A"}</div>
                                  <div>Organismo Adscrito</div>
                                  <div>
                                    {v.OrganismoAdscrito
                                      ? v.OrganismoAdscrito.Organismoadscrito
                                      : "N/A"}
                                  </div>
                                  <Separator
                                    className="w-full h-5 bg-slate-500 col-span-2"
                                    orientation="horizontal"
                                  />
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                      {employee.antecedentes.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex flex-row items-center gap-3">
                              Antecedentes <ClipboardCheck />
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableCaption>
                                Lista De Antecedentes En La APN.
                              </TableCaption>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[100px]">
                                    Fecha De ingreso
                                  </TableHead>
                                  <TableHead>Fecha De Egreso</TableHead>
                                  <TableHead className="text-left">
                                    Intitucion/Ente
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {employee.antecedentes.map((v, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-medium">
                                      {v.fecha_ingreso}
                                    </TableCell>
                                    <TableCell>{v.fecha_egreso}</TableCell>
                                    <TableCell>{v.organismo?.Organismoadscrito ?? "N/A"}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow>
                                  <TableCell
                                    colSpan={3}
                                    className="text-right font-bold"
                                  >
                                    Total años: {employee.anos_apn}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex flex-row items-center gap-3">
                            Datos De Vivienda <House />
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 place-content-center">
                            <div>Estado:</div>
                            <div>
                              {employee.datos_vivienda?.estado?.estado ?? "N/A"}
                            </div>
                            <div>Municipio:</div>
                            <div>
                              {employee.datos_vivienda?.municipio?.municipio ??
                                "N/A"}
                            </div>
                            <div>Parroquia:</div>
                            <div>
                              {employee.datos_vivienda?.parroquia?.parroquia ??
                                "N/A"}
                            </div>
                            <div>Condicion De Vivienda:</div>
                            <div>
                              {employee.datos_vivienda?.condicion?.condicion ??
                                "N/A"}
                            </div>
                            <div>Direccion De Habitación:</div>
                            <div>
                              {employee.datos_vivienda?.direccion_exacta ??
                                "N/A"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex flex-row items-center gap-3">
                            Formaciones Academicas <GraduationCap />
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
                              {employee.formacion_academica?.[0]?.carrera
                                ?.nombre_carrera ?? "N/A"}
                            </div>
                            <div>Mención:</div>
                            <div>
                              {employee.formacion_academica?.[0]?.mencion
                                ?.nombre_mencion ?? "N/A"}
                            </div>
                            <div>Institucion:</div>
                            <div>
                              {employee.formacion_academica?.[0]?.institucion?.nombre_institucion ??
                                "N/A"}
                            </div>

                            <div>Capacitación</div>
                            <div>
                              {employee.formacion_academica?.[0]?.capacitacion?.nombre_capacitacion ??
                                "N/A"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex flex-row items-center gap-3">
                            Información De Vestimenta <Shirt />
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 place-content-center">
                            <div>Talla De Camisa:</div>
                            <div>
                              {employee.perfil_fisico?.tallaCamisa?.valor ??
                                "N/A"}
                            </div>
                            <div>Talla de Pantalon:</div>
                            <div>
                              <div>
                                {employee.perfil_fisico?.tallaPantalon?.valor ??
                                  "N/A"}
                              </div>
                            </div>
                            <div>Talla De Calzado:</div>
                            <div>
                              <div>
                                {employee.perfil_fisico?.tallaZapatos?.valor ??
                                  "N/A"}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex flex-row items-center gap-3">
                            Información De Salud
                            <Ambulance />
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 place-content-center">
                            <div>Tipo De Sangre:</div>
                            <div>
                              {employee.perfil_salud?.grupoSanguineo
                                ?.GrupoSanguineo ?? "N/A"}
                            </div>
                            {employee.perfil_salud?.patologiasCronicas &&
                              employee.perfil_salud.patologiasCronicas.length >
                                0 && (
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
                                    {employee.perfil_salud.discapacidad.map(
                                      (v, i) => (
                                        <TableRow key={i}>
                                          <TableCell className="font-medium">
                                            {v.categoria.nombre_categoria}
                                          </TableCell>
                                          <TableCell>
                                            {v.discapacidad}
                                          </TableCell>
                                        </TableRow>
                                      ),
                                    )}
                                  </TableBody>
                                </Table>
                              )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </SheetContentUI>
              </SheetUI>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
