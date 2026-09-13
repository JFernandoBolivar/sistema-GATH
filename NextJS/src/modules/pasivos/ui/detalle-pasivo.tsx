"use client";

/**
 * Vista de detalle de un pasivo (solo lectura): expediente completo
 * (vivienda, salud, físico, formación académica, antecedentes, historial de
 * cargos al momento del egreso) más exportación a PDF. Reemplaza a
 * `dashboard/gestion-pasivos/components/pasive/tablePasive/detail-info.tsx`
 * del legado — a diferencia de aquel, es de solo lectura (modules/pasivos no
 * tiene casos de uso de edición de expediente, solo `procesarEgreso`).
 *
 * No incluye foto de perfil: ningún módulo migrado expone todavía una
 * acción de *lectura* de foto (solo `subirFotoEmpleadoAction` en
 * modules/personal), a diferencia del legado que la obtenía de
 * `gestion-trabajadores/api/getInfoRac.ts`. Queda fuera de alcance de esta
 * tarea (gap de plataforma, no específico de pasivos).
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Ambulance, Briefcase, ClipboardCheck, FileDown, GraduationCap, House, Loader2, Shirt, UserRound } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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

import type { CatalogosExpedientePasivoDTO, PasivoDTO } from "../application/dtos/pasivos-dto";
import {
  getCatalogosExpedientePasivoAction,
  getPasivoPorCedulaAction,
} from "../infrastructure/actions/pasivos-actions";

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => <Loader2 className="size-4 animate-spin" aria-hidden="true" /> },
);
const ReportePasivoPDF = dynamic(
  () => import("./pdf/reporte-pasivo-pdf").then((m) => m.ReportePasivoPDF),
  { ssr: false },
);

function nombreCatalogo(lista: { id: number; nombre: string }[], id?: number | null): string {
  if (id === null || id === undefined) return "N/A";
  return lista.find((c) => c.id === id)?.nombre ?? "N/A";
}

function fechaLegible(fecha?: string | null): string {
  if (!fecha) return "N/A";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function DetallePasivo({ cedula }: { cedula: string }) {
  const [open, setOpen] = useState(false);
  const [pasivo, setPasivo] = useState<PasivoDTO | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosExpedientePasivoDTO | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || pasivo) return;
    setCargando(true);
    setError(null);
    Promise.all([getPasivoPorCedulaAction(cedula), getCatalogosExpedientePasivoAction()])
      .then(([detalle, cats]) => {
        if (detalle && typeof detalle === "object" && "error" in detalle) {
          setError((detalle as { error: string }).error);
          return;
        }
        setPasivo(detalle as PasivoDTO);
        setCatalogos(cats);
      })
      .catch(() => setError("No fue posible cargar el expediente."))
      .finally(() => setCargando(false));
  }, [open, pasivo, cedula]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Ver detalle
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <ScrollArea className="h-full">
          <SheetHeader>
            <SheetTitle>Expediente {pasivo ? `de ${pasivo.nombreCompleto}` : ""}</SheetTitle>
          </SheetHeader>

          {cargando && !pasivo && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          {error && <p role="alert" className="px-4 text-sm text-destructive">{error}</p>}

          {pasivo && (
          <div className="flex flex-col gap-4 px-4 pb-8">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserRound className="size-5 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{pasivo.nombreCompleto}</p>
                  <p className="text-sm text-muted-foreground">Cédula: {pasivo.cedula}</p>
                </div>
              </div>
              {catalogos && (
                <PDFDownloadLink
                  document={<ReportePasivoPDF pasivo={pasivo} catalogos={catalogos} />}
                  fileName={`expediente-pasivo-${pasivo.cedula}.pdf`}
                >
                  {({ loading }) => (
                    <Button type="button" variant="outline" size="sm" disabled={loading}>
                      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
                      PDF
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Datos del pasivo</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Tipo</div>
                <div><Badge variant="secondary">{pasivo.tipoPasivo}</Badge></div>
                <div className="text-muted-foreground">Fecha de egreso</div>
                <div>{fechaLegible(pasivo.fechaEgreso)}</div>
                <div className="text-muted-foreground">Resolución</div>
                <div>{pasivo.resolucion ?? "N/A"}</div>
                <div className="text-muted-foreground">Observaciones</div>
                <div>{pasivo.observaciones ?? "N/A"}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Briefcase className="size-4" aria-hidden="true" />
                  Historial de cargos al momento del egreso
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pasivo.cargosHistorial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin cargos registrados.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {pasivo.cargosHistorial.map((c, i) => (
                      <div key={`${c.codigo}-${i}`} className="grid grid-cols-2 gap-1 rounded-lg border p-3 text-sm">
                        <div className="col-span-2 font-medium">{c.codigo}</div>
                        <div className="text-muted-foreground">Cargo</div>
                        <div>{c.denominacionCargoNombre}</div>
                        <div className="text-muted-foreground">Cargo específico</div>
                        <div>{c.denominacionCargoEspecificoNombre}</div>
                        <div className="text-muted-foreground">Grado</div>
                        <div>{c.gradoNombre ?? "N/A"}</div>
                        <div className="text-muted-foreground">Tipo de nómina</div>
                        <div>{c.tipoNominaNombre}</div>
                        <div className="text-muted-foreground">Dependencia</div>
                        <div>
                          {c.coordinacionNombre ?? c.direccionLineaNombre ?? c.direccionGeneralNombre ?? c.dependenciaNombre}
                        </div>
                        <div className="text-muted-foreground">Organismo adscrito</div>
                        <div>{c.organismoAdscritoNombre ?? "N/A"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {pasivo.antecedentes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                    Antecedentes de servicio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableCaption>Lista de antecedentes en la APN.</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha de ingreso</TableHead>
                        <TableHead>Fecha de egreso</TableHead>
                        <TableHead>Organismo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pasivo.antecedentes.map((a, i) => (
                        <TableRow key={a.id ?? i}>
                          <TableCell>{fechaLegible(a.fechaIngreso)}</TableCell>
                          <TableCell>{a.fechaEgreso ? fechaLegible(a.fechaEgreso) : "Presente"}</TableCell>
                          <TableCell>{a.organismoId ?? "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <House className="size-4" aria-hidden="true" />
                  Datos de vivienda
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                {cargando || !catalogos ? (
                  <p className="col-span-2 text-muted-foreground">Cargando catálogos…</p>
                ) : (
                  <>
                    <div className="text-muted-foreground">Estado</div>
                    <div>{nombreCatalogo(catalogos.estados, pasivo.datosVivienda?.estadoId)}</div>
                    <div className="text-muted-foreground">Municipio</div>
                    <div>{nombreCatalogo(catalogos.municipios, pasivo.datosVivienda?.municipioId)}</div>
                    <div className="text-muted-foreground">Parroquia</div>
                    <div>{nombreCatalogo(catalogos.parroquias, pasivo.datosVivienda?.parroquiaId)}</div>
                    <div className="text-muted-foreground">Condición de vivienda</div>
                    <div>{nombreCatalogo(catalogos.condicionesVivienda, pasivo.datosVivienda?.condicionViviendaId)}</div>
                    <div className="text-muted-foreground">Dirección exacta</div>
                    <div>{pasivo.datosVivienda?.direccionExacta ?? "N/A"}</div>
                    <div className="text-muted-foreground">Código postal</div>
                    <div>{nombreCatalogo(catalogos.codigosPostales, pasivo.datosVivienda?.codigoPostalId)}</div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <GraduationCap className="size-4" aria-hidden="true" />
                  Formación académica
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pasivo.formacionAcademica.length === 0 || !catalogos ? (
                  <p className="text-sm text-muted-foreground">
                    {cargando ? "Cargando catálogos…" : "Sin formación académica registrada."}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nivel académico</TableHead>
                        <TableHead>Carrera</TableHead>
                        <TableHead>Mención</TableHead>
                        <TableHead>Institución</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pasivo.formacionAcademica.map((fa, i) => (
                        <TableRow key={fa.id ?? i}>
                          <TableCell>{nombreCatalogo(catalogos.nivelesAcademicos, fa.nivelAcademicoId)}</TableCell>
                          <TableCell>{nombreCatalogo(catalogos.carreras, fa.carreraId)}</TableCell>
                          <TableCell>{nombreCatalogo(catalogos.menciones, fa.mencionId)}</TableCell>
                          <TableCell>{nombreCatalogo(catalogos.instituciones, fa.institucionId)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shirt className="size-4" aria-hidden="true" />
                  Perfil físico
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                {cargando || !catalogos ? (
                  <p className="col-span-2 text-muted-foreground">Cargando catálogos…</p>
                ) : (
                  <>
                    <div className="text-muted-foreground">Talla de camisa</div>
                    <div>{nombreCatalogo(catalogos.tallas, pasivo.perfilFisico?.tallaCamisaId)}</div>
                    <div className="text-muted-foreground">Talla de pantalón</div>
                    <div>{nombreCatalogo(catalogos.tallas, pasivo.perfilFisico?.tallaPantalonId)}</div>
                    <div className="text-muted-foreground">Talla de calzado</div>
                    <div>{nombreCatalogo(catalogos.tallas, pasivo.perfilFisico?.tallaZapatosId)}</div>
                    <div className="text-muted-foreground">Talla de chaqueta</div>
                    <div>{nombreCatalogo(catalogos.tallas, pasivo.perfilFisico?.tallaChaquetaId)}</div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Ambulance className="size-4" aria-hidden="true" />
                  Información de salud
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {cargando || !catalogos ? (
                  <p className="text-muted-foreground">Cargando catálogos…</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-muted-foreground">Grupo sanguíneo</div>
                      <div>{nombreCatalogo(catalogos.gruposSanguineos, pasivo.perfilSalud?.grupoSanguineoId)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Alergias: </span>
                      {pasivo.perfilSalud?.alergias?.length
                        ? pasivo.perfilSalud.alergias.map((id) => nombreCatalogo(catalogos.alergias, id)).join(", ")
                        : "Ninguna"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Patologías crónicas: </span>
                      {pasivo.perfilSalud?.patologiasCronicas?.length
                        ? pasivo.perfilSalud.patologiasCronicas.map((id) => nombreCatalogo(catalogos.patologias, id)).join(", ")
                        : "Ninguna"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Discapacidades: </span>
                      {pasivo.perfilSalud?.discapacidades?.length
                        ? pasivo.perfilSalud.discapacidades.map((id) => nombreCatalogo(catalogos.discapacidades, id)).join(", ")
                        : "Ninguna"}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
