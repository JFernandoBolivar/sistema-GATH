"use client";

/**
 * Vista de detalle del expediente completo de un empleado con fidelidad exacta
 * a `dashboard/gestion-trabajadores/components/employees/tableEmployees/detail-info.tsx`
 * del legado.
 *
 * Contiene:
 * 1. Foto de perfil + nombre completo + botón modular `Actualizar Información Basica`.
 * 2. Detalles del Cargo (13 campos: Código, Cargo, Cargo Específico, Tipo Nómina, Nivel,
 *    Dirección General, División/Coordinación, Coordinación, Grado, Estatus, Organismo Adscrito,
 *    Tipo Procedencia, Cargo Cubierto por Encargaduría).
 * 3. Antecedentes (tabla APN + total en años/meses/días + botón de actualización/creación).
 * 4. Contratos (tabla con historial completo + botón de actualización/creación).
 * 5. Datos de Vivienda (House + botón Actualizar).
 * 6. Formaciones Académicas (GraduationCap + botón Actualizar).
 * 7. Formación Complementaria (tabla con horas, fechas, institución + botón Actualizar).
 * 8. Contacto de Emergencia (mejora documentada en el Sheet).
 * 9. Información de Vestimenta (Shirt + botón Actualizar).
 * 10. Información de Salud (Ambulance + Tipo de sangre + tablas categorizadas de patologías, discapacidades, alergias).
 */
import Image from "next/image";
import {
  Ambulance,
  ContactRound,
  FileDown,
  GraduationCap,
  House,
  Loader2,
  Shirt,
} from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
import { Separator } from "@/shared/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/components/sheet";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../application/dtos/empleado-dto";
import FormAcademicTrainingUpdateDialog from "./dialogs/form-academic-training-update-dialog";
import FormBackgroundUpdateDialog from "./dialogs/form-background-update-dialog";
import FormBasicUpdateDialog from "./dialogs/form-basic-update-dialog";
import FormContratoUpdateDialog from "./dialogs/form-contrato-update-dialog";
import FormDwellingUpdateDialog from "./dialogs/form-dwelling-update-dialog";
import FormHealthProfileUpdateDialog from "./dialogs/form-health-profile-update-dialog";
import FormPhysicalProfileUpdateDialog from "./dialogs/form-physical-profile-update-dialog";
import FormSupplementaryTrainingUpdateDialog from "./dialogs/form-supplementary-training-update-dialog";
import type { DetalleExpedienteViewModel } from "./expediente-detalle-view-model";

interface EmpleadoDetalleSheetProps {
  detalle: DetalleExpedienteViewModel | null;
  empleado: EmpleadoDTO | null;
  catalogos: CatalogosExpedienteDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportarPdf: () => void;
  onGuardado: () => void;
  exportandoPdf: boolean;
  /** RECEPCIONISTA sólo consulta: se ocultan los accesos a edición y exportación */
  puedeExportarPdf: boolean;
  puedeEditar: boolean;
}

export default function EmpleadoDetalleSheet({
  detalle,
  empleado,
  catalogos,
  open,
  onOpenChange,
  onExportarPdf,
  onGuardado,
  exportandoPdf,
  puedeExportarPdf,
  puedeEditar,
}: EmpleadoDetalleSheetProps) {
  if (!detalle || !empleado) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Información Detallada Del Trabajador</SheetTitle>
          </SheetHeader>
          <div className="flex justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const contratosList = empleado.contratos && empleado.contratos.length > 0
    ? empleado.contratos
    : (empleado.contratoActual ? [empleado.contratoActual] : []);

  const antecedentesList = detalle.antecedentes;
  const asignacionesList = empleado.asignaciones ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden p-0">
        <ScrollArea className="h-full p-6">
          <SheetHeader className="mb-4 pr-8 p-0">
            <div className="flex items-center justify-between">
              <SheetTitle>Información Detallada Del Trabajador</SheetTitle>
              {puedeExportarPdf && (
                <Button size="sm" variant="outline" onClick={onExportarPdf} disabled={exportandoPdf}>
                  {exportandoPdf ? <Loader2 className="size-4 animate-spin mr-1" /> : <FileDown className="size-4 mr-1" />}
                  Exportar PDF
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex flex-col gap-4">
            {/* 1. Header con Foto de Perfil, Nombre y Diálogo Básico */}
            <div className="mx-auto flex w-60 flex-col items-center gap-2">
              <div className="h-60 w-60 overflow-hidden rounded-md border bg-slate-100 shadow-sm">
                <Image
                  src="/bg.png"
                  alt={`Foto de ${empleado.nombres} ${empleado.apellidos}`}
                  width={240}
                  height={240}
                  className="h-full w-full object-cover"
                />
              </div>
              <h2 className="w-full text-center text-lg font-bold">
                {empleado.nombres} {empleado.apellidos}
              </h2>
              {puedeEditar && (
                <FormBasicUpdateDialog
                  empleado={empleado}
                  catalogos={catalogos}
                  onGuardado={onGuardado}
                  triggerLabel="Actualizar Información Basica"
                  triggerClassName="w-full cursor-pointer bg-blue-700 hover:bg-blue-900 text-white"
                />
              )}
            </div>

            {/* 2. Detalles del Cargo (13 campos del legado) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center gap-3">
                  {asignacionesList.length > 1
                    ? "Detalles De Cargos Asignados"
                    : "Detalles Del Cargo"}{" "}
                  <ContactRound className="size-5" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 pr-2">
                  {asignacionesList.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Sin cargos asignados registrados
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {asignacionesList.map((asig, i) => (
                        <div key={asig.id || i} className="grid grid-cols-2 gap-y-1.5 text-sm">
                          <div className="font-medium text-muted-foreground">Código:</div>
                          <div className="font-semibold">{asig.codigo || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Cargo:</div>
                          <div>{asig.denominacionCargo || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Cargo Específico:</div>
                          <div>{asig.denominacionCargoEspecifico || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Tipo De Nomina:</div>
                          <div>{asig.tipoNomina || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Nivel:</div>
                          <div>{asig.dependencia || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Dirección / Gerencia / Oficina:</div>
                          <div>{asig.direccionGeneral || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">División / Coordinación:</div>
                          <div>{asig.direccionLinea || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Coordinación:</div>
                          <div>{asig.coordinacion || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Grado:</div>
                          <div>{asig.grado || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Estatus:</div>
                          <div>
                            <Badge variant={asig.estatus === "ACTIVO" ? "default" : "destructive"}>
                              {asig.estatus || "N/A"}
                            </Badge>
                          </div>

                          <div className="font-medium text-muted-foreground">Organismo Adscrito:</div>
                          <div>{asig.organismoAdscrito || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Tipo Procedencia:</div>
                          <div>{asig.tipoProcedencia || "N/A"}</div>

                          <div className="font-medium text-muted-foreground">Cargo Cubierto por una Encargaduría:</div>
                          <div>
                            <Badge variant={asig.cargoCubiertoEncargaduria ? "default" : "destructive"}>
                              {asig.cargoCubiertoEncargaduria ? "SÍ" : "NO"}
                            </Badge>
                          </div>

                          <Separator className="col-span-2 my-2" />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Encargadurías */}
            <Card>
              <CardHeader>
                <CardTitle>Encargadurías</CardTitle>
              </CardHeader>
              <CardContent>
                {detalle.encargadurias.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin encargadurías registradas</p>
                ) : (
                  <Table className="w-full">
                    <TableCaption>Lista De Encargadurías Del Trabajador</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Cargo Encargado</TableHead>
                        <TableHead>Titular</TableHead>
                        <TableHead>Fecha Inicio</TableHead>
                        <TableHead>Fecha Fin</TableHead>
                        <TableHead>Estatus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.encargadurias.map((enc, idx) => (
                        <TableRow key={enc.id || idx}>
                          <TableCell className="font-medium">{idx + 1}</TableCell>
                          <TableCell>{enc.cargoEncargado}</TableCell>
                          <TableCell>{enc.titular}</TableCell>
                          <TableCell>{enc.fechaInicio}</TableCell>
                          <TableCell>{enc.fechaFin}</TableCell>
                          <TableCell>
                            <Badge variant={enc.estatus === "ACTIVO" ? "default" : "destructive"}>
                              {enc.estatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* 3. Antecedentes */}
            {antecedentesList.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-row items-center justify-between gap-3">
                    <div>Antecedentes</div>
                    {puedeEditar && (
                      <FormBackgroundUpdateDialog
                        empleado={empleado}
                        catalogos={catalogos}
                        onGuardado={onGuardado}
                        triggerLabel="Agregar Antecedentes"
                        triggerClassName="cursor-pointer bg-blue-700 hover:bg-blue-900 text-white"
                      />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table className="w-full table-fixed">
                    <TableCaption>Lista De Antecedentes En La APN.</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Fecha De ingreso</TableHead>
                        <TableHead className="w-[120px]">Fecha De Egreso</TableHead>
                        <TableHead>Institución/Ente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {antecedentesList.map((ant, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{ant.fechaIngreso || "N/A"}</TableCell>
                          <TableCell>{ant.fechaEgreso || "Presente"}</TableCell>
                          <TableCell className="truncate max-w-[200px]">{ant.organismo || "N/A"}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold">
                          {`Total: ${detalle.totalAnosApn}`}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              puedeEditar && (
                <FormBackgroundUpdateDialog
                  empleado={empleado}
                  catalogos={catalogos}
                  onGuardado={onGuardado}
                  triggerLabel="Agregar Antecedentes Y Ingreso Al Organismo (Opcion Solo Valida Para Este Caso)"
                  triggerClassName="w-full cursor-pointer bg-red-700 hover:bg-red-900 text-white"
                />
              )
            )}

            {/* 4. Contratos */}
            {contratosList.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-row items-center justify-between gap-3">
                    <div>Contratos</div>
                    {puedeEditar && (
                      <FormContratoUpdateDialog
                        empleado={empleado}
                        catalogos={catalogos}
                        onGuardado={onGuardado}
                        triggerLabel="Agregar Contratos"
                        triggerClassName="cursor-pointer bg-blue-700 hover:bg-blue-900 text-white"
                      />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table className="w-full table-fixed">
                    <TableCaption>Lista De Contratos.</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px] truncate">N° Contrato</TableHead>
                        <TableHead className="w-[100px] truncate">Fecha Ingreso</TableHead>
                        <TableHead className="w-[120px] truncate">Fecha Culminación</TableHead>
                        <TableHead className="truncate">Política</TableHead>
                        <TableHead className="w-[100px] truncate">Estatus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contratosList.map((c, i) => {
                        const estatus = c.estatusNombre || (c.esFijo ? "FIJO" : "ACTIVO");
                        const politica = c.politicaNombre ?? catalogos?.politicas.find((p) => p.id === c.politicaId)?.nombre ?? "N/A";
                        return (
                          <TableRow key={c.id || i}>
                            <TableCell className="font-medium">{c.nContrato || "N/A"}</TableCell>
                            <TableCell>{c.fechaIngreso || "N/A"}</TableCell>
                            <TableCell>{c.fechaCulminacion || "—"}</TableCell>
                            <TableCell className="truncate max-w-[150px]">{politica}</TableCell>
                            <TableCell>
                              <Badge variant={estatus === "VENCIDO" ? "destructive" : "default"}>
                                {estatus}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              puedeEditar && (
                <FormContratoUpdateDialog
                  empleado={empleado}
                  catalogos={catalogos}
                  onGuardado={onGuardado}
                  triggerLabel="Agregar Contratos"
                  triggerClassName="w-full cursor-pointer bg-red-700 hover:bg-red-900 text-white"
                />
              )
            )}

            {/* 5. Datos de Vivienda */}
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center justify-between gap-3">
                  <div className="flex flex-row items-center gap-2">
                    Datos De Vivienda <House className="size-5" />
                  </div>
                  {puedeEditar && (
                    <FormDwellingUpdateDialog
                      empleado={empleado}
                      catalogos={catalogos}
                      onGuardado={onGuardado}
                      triggerLabel="Actualizar"
                      triggerClassName="cursor-pointer bg-blue-700 hover:bg-blue-900 text-white"
                    />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 place-content-center gap-y-1.5 text-sm">
                  <div className="font-medium text-muted-foreground">Estado:</div>
                  <div>{detalle.vivienda?.estado ?? "N/A"}</div>
                  <div className="font-medium text-muted-foreground">Municipio:</div>
                  <div>{detalle.vivienda?.municipio ?? "N/A"}</div>
                  <div className="font-medium text-muted-foreground">Parroquia:</div>
                  <div>{detalle.vivienda?.parroquia ?? "N/A"}</div>
                  <div className="font-medium text-muted-foreground">Condicion De Vivienda:</div>
                  <div>{detalle.vivienda?.condicion ?? "N/A"}</div>
                  <div className="font-medium text-muted-foreground">Direccion De Habitación:</div>
                  <div>{detalle.vivienda?.direccionExacta ?? "N/A"}</div>
                  <div className="font-medium text-muted-foreground">Código Postal:</div>
                  <div>{detalle.vivienda?.codigoPostal ?? "N/A"}</div>
                </div>
              </CardContent>
            </Card>

            {/* 6. Formaciones Académicas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center justify-between gap-3">
                  <div className="flex flex-row items-center gap-2">
                    Formaciones Academicas <GraduationCap className="size-5" />
                  </div>
                  {puedeEditar && (
                    <FormAcademicTrainingUpdateDialog
                      empleado={empleado}
                      catalogos={catalogos}
                      onGuardado={onGuardado}
                      triggerLabel="Actualizar"
                      triggerClassName="cursor-pointer bg-blue-700 hover:bg-blue-900 text-white"
                    />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detalle.formacionAcademica.length > 0 ? (
                  <Table className="w-full table-fixed">
                    <TableCaption>Lista De Formaciones Academicas.</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nivel Academico</TableHead>
                        <TableHead>Carrera</TableHead>
                        <TableHead>Mención</TableHead>
                        <TableHead>Institución</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.formacionAcademica.map((fa, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{fa.nivelAcademico}</TableCell>
                          <TableCell className="truncate max-w-[150px]">{fa.carrera}</TableCell>
                          <TableCell>{fa.mencion}</TableCell>
                          <TableCell className="truncate max-w-[200px]">{fa.institucion}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    Sin formación académica registrada
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 7. Formación Complementaria */}
            {detalle.formacionComplementaria.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-row items-center justify-between gap-3">
                    <div>Formación Complementaria</div>
                    {puedeEditar && (
                      <FormSupplementaryTrainingUpdateDialog
                        empleado={empleado}
                        catalogos={catalogos}
                        onGuardado={onGuardado}
                        triggerLabel="Actualizar"
                        triggerClassName="cursor-pointer bg-blue-700 hover:bg-blue-900 text-white"
                      />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table className="w-full table-fixed">
                    <TableCaption>Lista De Formación Complementaria.</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="truncate">Capacitación</TableHead>
                        <TableHead className="w-[120px]">Fecha De Inicio</TableHead>
                        <TableHead className="w-[120px]">Fecha De Fin</TableHead>
                        <TableHead>Institución</TableHead>
                        <TableHead>Procedencia</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Horas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.formacionComplementaria.map((fc, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium truncate max-w-[180px]">{fc.capacitacion}</TableCell>
                          <TableCell>{fc.fechaInicio}</TableCell>
                          <TableCell>{fc.fechaFin}</TableCell>
                          <TableCell className="truncate max-w-[150px]">{fc.institucion}</TableCell>
                          <TableCell>{fc.procedencia}</TableCell>
                          <TableCell>{fc.grupo}</TableCell>
                          <TableCell>{fc.horasCompletadas}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              puedeEditar && (
                <FormSupplementaryTrainingUpdateDialog
                  empleado={empleado}
                  catalogos={catalogos}
                  onGuardado={onGuardado}
                  triggerLabel="Agregar Formación Complementaria (Opción Solo Válida Para Este Caso)"
                  triggerClassName="w-full cursor-pointer bg-red-700 hover:bg-red-900 text-white"
                />
              )
            )}

            {/* 8. Contacto de Emergencia (Mejora funcional preservada) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Contacto de emergencia</CardTitle>
              </CardHeader>
              <CardContent>
                {detalle.contactoEmergencia.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin contactos de emergencia registrados.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Relación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.contactoEmergencia.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.nombreCompleto}</TableCell>
                          <TableCell>{c.telefono}</TableCell>
                          <TableCell>{c.relacion}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* 9. Información de Vestimenta */}
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center justify-between gap-3">
                  <div className="flex flex-row items-center gap-2">
                    Información De Vestimenta <Shirt className="size-5" />
                  </div>
                  {puedeEditar && (
                    <FormPhysicalProfileUpdateDialog
                      empleado={empleado}
                      catalogos={catalogos}
                      onGuardado={onGuardado}
                      triggerLabel="Actualizar"
                      triggerClassName="cursor-pointer bg-blue-700 hover:bg-blue-900 text-white"
                    />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 place-content-center gap-y-1.5 text-sm">
                  <div className="font-medium text-muted-foreground">Talla De Camisa:</div>
                  <div>{detalle.fisico?.tallaCamisa ?? "N/A"}</div>
                  <div className="font-medium text-muted-foreground">Talla de Pantalon:</div>
                  <div>{detalle.fisico?.tallaPantalon ?? "N/A"}</div>
                  <div className="font-medium text-muted-foreground">Talla De Calzado:</div>
                  <div>{detalle.fisico?.tallaZapatos ?? "N/A"}</div>
                  <div className="font-medium text-muted-foreground">Talla De Chaqueta:</div>
                  <div>{detalle.fisico?.tallaChaqueta ?? "N/A"}</div>
                </div>
              </CardContent>
            </Card>

            {/* 10. Información de Salud */}
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center justify-between gap-3">
                  <div className="flex flex-row items-center gap-2">
                    Información De Salud <Ambulance className="size-5" />
                  </div>
                  {puedeEditar && (
                    <FormHealthProfileUpdateDialog
                      empleado={empleado}
                      catalogos={catalogos}
                      onGuardado={onGuardado}
                      triggerLabel="Actualizar"
                      triggerClassName="cursor-pointer bg-blue-700 hover:bg-blue-900 text-white"
                    />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 place-content-center gap-y-3 text-sm">
                  <div className="font-medium text-muted-foreground">Tipo De Sangre:</div>
                  <div className="font-semibold">{detalle.salud?.grupoSanguineo ?? "N/A"}</div>

                  {detalle.salud?.patologiasCronicas && detalle.salud.patologiasCronicas.length > 0 && (
                    <Table className="col-span-2">
                      <TableCaption>Lista De Patologias Del Trabajador</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Patología</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalle.salud.patologiasCronicas.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{p.categoria}</TableCell>
                            <TableCell>{p.nombre}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {detalle.salud?.discapacidades && detalle.salud.discapacidades.length > 0 && (
                    <Table className="col-span-2">
                      <TableCaption>Lista De Discapacidades Del Trabajador</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Discapacidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalle.salud.discapacidades.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{d.categoria}</TableCell>
                            <TableCell>{d.nombre}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {detalle.salud?.alergias && detalle.salud.alergias.length > 0 && (
                    <div className="col-span-2">
                      <Table>
                        <TableCaption>Lista De Alergias Del Trabajador</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Alergia</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalle.salud.alergias.map((a, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{a.categoria}</TableCell>
                              <TableCell>{a.nombre}</TableCell>
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
      </SheetContent>
    </Sheet>
  );
}
