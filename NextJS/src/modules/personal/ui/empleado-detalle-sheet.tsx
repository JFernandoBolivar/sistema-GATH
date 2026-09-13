"use client";

/**
 * Vista de detalle (solo lectura) del expediente completo de un empleado:
 * datos personales, vivienda, salud, perfil físico, formación académica y
 * complementaria, contacto de emergencia, antecedentes de servicio y
 * contrato actual. Réplica de paridad funcional de
 * `dashboard/gestion-trabajadores/components/employees/tableEmployees/detail-info.tsx`
 * del legado, sin los diálogos de edición (esos ya los cubre el formulario
 * de `personal-page.tsx`). Opera exclusivamente con DTOs (R5) y no importa
 * de `infrastructure/` (R3).
 */
import { FileDown, Loader2 } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/components/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";

import type { DetalleExpedienteViewModel } from "./expediente-detalle-view-model";

interface EmpleadoDetalleSheetProps {
  detalle: DetalleExpedienteViewModel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportarPdf: () => void;
  exportandoPdf: boolean;
}

function FilaInfo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1 text-sm">
      <div className="text-muted-foreground">{etiqueta}</div>
      <div>{valor}</div>
    </div>
  );
}

export default function EmpleadoDetalleSheet({
  detalle,
  open,
  onOpenChange,
  onExportarPdf,
  exportandoPdf,
}: EmpleadoDetalleSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Expediente del trabajador</SheetTitle>
        </SheetHeader>
        {!detalle ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{detalle.nombreCompleto}</h2>
                <p className="text-sm text-muted-foreground">Cédula: {detalle.cedula}</p>
              </div>
              <Button size="sm" variant="outline" onClick={onExportarPdf} disabled={exportandoPdf}>
                {exportandoPdf ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
                PDF
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Datos personales</CardTitle></CardHeader>
              <CardContent>
                <FilaInfo etiqueta="Sexo" valor={detalle.sexo} />
                <FilaInfo etiqueta="Fecha de nacimiento" valor={detalle.fechaNacimiento} />
                <FilaInfo etiqueta="Estado civil" valor={detalle.estadoCivil} />
                <FilaInfo etiqueta="Carnet de la patria" valor={detalle.carnetPatria} />
                <FilaInfo etiqueta="Correo" valor={detalle.correo} />
                <FilaInfo etiqueta="Teléfono móvil" valor={detalle.telefonoMovil} />
                <FilaInfo etiqueta="Teléfono habitación" valor={detalle.telefonoHabitacion} />
                <FilaInfo etiqueta="Total años APN" valor={detalle.totalAnosApn} />
              </CardContent>
            </Card>

            {detalle.contratoActual && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Contrato actual</CardTitle></CardHeader>
                <CardContent>
                  <FilaInfo etiqueta="N° contrato" valor={detalle.contratoActual.nContrato} />
                  <FilaInfo etiqueta="Fecha de culminación" valor={detalle.contratoActual.fechaCulminacion} />
                  <FilaInfo etiqueta="Política" valor={detalle.contratoActual.politica} />
                  <FilaInfo etiqueta="Tipo" valor={detalle.contratoActual.esFijo} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Antecedentes de servicio</CardTitle></CardHeader>
              <CardContent>
                {detalle.antecedentes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin antecedentes registrados.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingreso</TableHead>
                        <TableHead>Egreso</TableHead>
                        <TableHead>Organismo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.antecedentes.map((a, i) => (
                        <TableRow key={i}>
                          <TableCell>{a.fechaIngreso}</TableCell>
                          <TableCell>{a.fechaEgreso}</TableCell>
                          <TableCell>{a.organismo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {detalle.vivienda && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Datos de vivienda</CardTitle></CardHeader>
                <CardContent>
                  <FilaInfo etiqueta="Estado" valor={detalle.vivienda.estado} />
                  <FilaInfo etiqueta="Municipio" valor={detalle.vivienda.municipio} />
                  <FilaInfo etiqueta="Parroquia" valor={detalle.vivienda.parroquia} />
                  <FilaInfo etiqueta="Dirección" valor={detalle.vivienda.direccionExacta} />
                  <FilaInfo etiqueta="Condición de vivienda" valor={detalle.vivienda.condicion} />
                  <FilaInfo etiqueta="Código postal" valor={detalle.vivienda.codigoPostal} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Formación académica</CardTitle></CardHeader>
              <CardContent>
                {detalle.formacionAcademica.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin formación académica registrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nivel</TableHead>
                        <TableHead>Carrera</TableHead>
                        <TableHead>Mención</TableHead>
                        <TableHead>Institución</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.formacionAcademica.map((fa, i) => (
                        <TableRow key={i}>
                          <TableCell>{fa.nivelAcademico}</TableCell>
                          <TableCell>{fa.carrera}</TableCell>
                          <TableCell>{fa.mencion}</TableCell>
                          <TableCell>{fa.institucion}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Formación complementaria</CardTitle></CardHeader>
              <CardContent>
                {detalle.formacionComplementaria.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin formación complementaria registrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Capacitación</TableHead>
                        <TableHead>Institución</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead>Fin</TableHead>
                        <TableHead>Horas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.formacionComplementaria.map((fc, i) => (
                        <TableRow key={i}>
                          <TableCell>{fc.capacitacion}</TableCell>
                          <TableCell>{fc.institucion}</TableCell>
                          <TableCell>{fc.fechaInicio}</TableCell>
                          <TableCell>{fc.fechaFin}</TableCell>
                          <TableCell>{fc.horasCompletadas}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Contacto de emergencia</CardTitle></CardHeader>
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
                          <TableCell>{c.nombreCompleto}</TableCell>
                          <TableCell>{c.telefono}</TableCell>
                          <TableCell>{c.relacion}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {detalle.fisico && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Perfil físico (tallas)</CardTitle></CardHeader>
                <CardContent>
                  <FilaInfo etiqueta="Talla camisa" valor={detalle.fisico.tallaCamisa} />
                  <FilaInfo etiqueta="Talla pantalón" valor={detalle.fisico.tallaPantalon} />
                  <FilaInfo etiqueta="Talla zapatos" valor={detalle.fisico.tallaZapatos} />
                  <FilaInfo etiqueta="Talla chaqueta" valor={detalle.fisico.tallaChaqueta} />
                </CardContent>
              </Card>
            )}

            {detalle.salud && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Salud</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <FilaInfo etiqueta="Grupo sanguíneo" valor={detalle.salud.grupoSanguineo} />
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">Alergias</div>
                    <div className="flex flex-wrap gap-1">
                      {detalle.salud.alergias.length === 0
                        ? <span className="text-sm">Ninguna</span>
                        : detalle.salud.alergias.map((a, i) => <Badge key={i} variant="secondary">{a}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">Patologías crónicas</div>
                    <div className="flex flex-wrap gap-1">
                      {detalle.salud.patologiasCronicas.length === 0
                        ? <span className="text-sm">Ninguna</span>
                        : detalle.salud.patologiasCronicas.map((p, i) => <Badge key={i} variant="secondary">{p}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">Discapacidades</div>
                    <div className="flex flex-wrap gap-1">
                      {detalle.salud.discapacidades.length === 0
                        ? <span className="text-sm">Ninguna</span>
                        : detalle.salud.discapacidades.map((d, i) => <Badge key={i} variant="secondary">{d}</Badge>)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
