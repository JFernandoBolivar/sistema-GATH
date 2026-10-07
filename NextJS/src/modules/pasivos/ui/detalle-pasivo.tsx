"use client";

/**
 * Vista de detalle de un pasivo (solo lectura): expediente completo
 * (vivienda, salud, físico, formación académica, antecedentes, historial de
 * cargos al momento del egreso) más exportación a PDF. Reemplaza a
 * `dashboard/gestion-pasivos/components/pasive/tablePasive/detail-info.tsx`
 * del legado — a diferencia de aquel, es de solo lectura (modules/pasivos no
 * tiene casos de uso de edición de expediente, solo `procesarEgreso`).
 * Controlado externamente (`open`/`onOpenChange`), mismo patrón que
 * `DetalleFamiliar`/`EmpleadoDetalleSheet`, para que el menú de acciones de
 * `pasivos-columns.tsx` lo abra.
 *
 * No incluye foto de perfil: ningún módulo migrado expone todavía una
 * acción de *lectura* de foto (solo `subirFotoEmpleadoAction` en
 * modules/personal), a diferencia del legado que la obtenía de
 * `gestion-trabajadores/api/getInfoRac.ts`. Queda fuera de alcance de esta
 * tarea (gap de plataforma, no específico de pasivos).
 *
 * Tampoco incluye "Formación complementaria": el backend ya la agregó a
 * `Pasivo`/`PasivoDTO` (fix de PLAN_RECONSTRUCCION_UI_2026-09-15.md §2.1,
 * que desbloqueó perfil físico y esta sección), pero el dominio/DTO
 * *frontend* de este módulo (`domain/entities/pasivo.ts`,
 * `application/dtos/pasivos-dto.ts`) nunca llegó a modelarla, y sus
 * catálogos de resolución (capacitaciones, procedencia, grupo) tampoco
 * existen en `CatalogosExpedientePasivo` — a diferencia de perfil físico,
 * que sí estaba completamente cableado en el frontend y solo esperaba el
 * fix del backend. Añadirla exigiría además ampliar el endpoint de
 * catálogos de `apps.pasivos` (backend), fuera del alcance "ui/" de esta
 * tarea y en paralelo a otro worker editando ese mismo módulo. Se
 * documenta como brecha, no se fabrica con catálogos a medias.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Ambulance, Briefcase, ClipboardCheck, FileDown, GraduationCap, House, Loader2, Shirt, UserRound } from "lucide-react";

import { nombrePorId } from "@/shared/lib/catalogos";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { formatearFecha } from "@/shared/lib/formato-fecha";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { InfoRow } from "@/shared/ui/components/info-row";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
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

import type { CatalogosExpedientePasivoDTO, PasivoDTO } from "../application/dtos/pasivos-dto";
import {
  descargarPasivoPdfAction,
  getCatalogosExpedientePasivoAction,
  getPasivoPorCedulaAction,
} from "../infrastructure/actions/pasivos-actions";

interface DetallePasivoProps {
  cedula: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetallePasivo({ cedula, open, onOpenChange }: DetallePasivoProps) {
  const { data: session } = useSession();
  // CC-APP-2026-08-001: RECEPCIONISTA puede ver el detalle pero no exportarlo.
  const puedeExportarPdf = tienePermiso(session?.user?.permisos, "pasivos.exportar_pdf");
  const [pasivo, setPasivo] = useState<PasivoDTO | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosExpedientePasivoDTO | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const descargarPdf = async () => {
    if (!pasivo) return;
    setExportandoPdf(true);
    try {
      const resultado = await descargarPasivoPdfAction(pasivo.cedula);
      if (!(resultado instanceof Blob)) {
        setError((resultado as { error: string }).error ?? "No fue posible descargar el PDF.");
        return;
      }
      const url = window.URL.createObjectURL(resultado);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expediente-pasivo-${pasivo.cedula}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("No fue posible descargar el PDF.");
    } finally {
      setExportandoPdf(false);
    }
  };

  useEffect(() => {
    if (!open || !cedula || pasivo?.cedula === cedula) return;
    setPasivo(null);
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
    <Sheet open={open} onOpenChange={onOpenChange}>
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
              {catalogos && puedeExportarPdf && (
                <Button type="button" variant="outline" size="sm" disabled={exportandoPdf} onClick={descargarPdf}>
                  {exportandoPdf ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
                  PDF
                </Button>
              )}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Datos del pasivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 py-1 text-sm">
                  <div className="text-muted-foreground">Tipo</div>
                  <div><Badge variant="secondary">{pasivo.tipoPasivo}</Badge></div>
                </div>
                <InfoRow label="Fecha de egreso" value={formatearFecha(pasivo.fechaEgreso)} />
                <InfoRow label="Resolución" value={pasivo.resolucion} />
                <InfoRow label="Observaciones" value={pasivo.observaciones} />
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
                      <div key={`${c.codigo}-${i}`} className="rounded-lg border p-3 text-sm">
                        <div className="font-medium">{c.codigo}</div>
                        <InfoRow label="Cargo" value={c.denominacionCargoNombre} />
                        <InfoRow label="Cargo específico" value={c.denominacionCargoEspecificoNombre} />
                        <InfoRow label="Grado" value={c.gradoNombre} />
                        <InfoRow label="Tipo de nómina" value={c.tipoNominaNombre} />
                        <InfoRow
                          label="Dependencia"
                          value={c.coordinacionNombre ?? c.direccionLineaNombre ?? c.direccionGeneralNombre ?? c.dependenciaNombre}
                        />
                        <InfoRow label="Organismo adscrito" value={c.organismoAdscritoNombre} />
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
                          <TableCell>{formatearFecha(a.fechaIngreso)}</TableCell>
                          <TableCell>{a.fechaEgreso ? formatearFecha(a.fechaEgreso) : "Presente"}</TableCell>
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
              <CardContent>
                {cargando || !catalogos ? (
                  <p className="text-muted-foreground">Cargando catálogos…</p>
                ) : (
                  <>
                    <InfoRow label="Estado" value={nombrePorId(catalogos.estados, pasivo.datosVivienda?.estadoId)} />
                    <InfoRow label="Municipio" value={nombrePorId(catalogos.municipios, pasivo.datosVivienda?.municipioId)} />
                    <InfoRow label="Parroquia" value={nombrePorId(catalogos.parroquias, pasivo.datosVivienda?.parroquiaId)} />
                    <InfoRow label="Condición de vivienda" value={nombrePorId(catalogos.condicionesVivienda, pasivo.datosVivienda?.condicionViviendaId)} />
                    <InfoRow label="Dirección exacta" value={pasivo.datosVivienda?.direccionExacta} />
                    <InfoRow label="Código postal" value={nombrePorId(catalogos.codigosPostales, pasivo.datosVivienda?.codigoPostalId)} />
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
                          <TableCell>{nombrePorId(catalogos.nivelesAcademicos, fa.nivelAcademicoId)}</TableCell>
                          <TableCell>{nombrePorId(catalogos.carreras, fa.carreraId)}</TableCell>
                          <TableCell>{nombrePorId(catalogos.menciones, fa.mencionId)}</TableCell>
                          <TableCell>{nombrePorId(catalogos.instituciones, fa.institucionId)}</TableCell>
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
              <CardContent>
                {cargando || !catalogos ? (
                  <p className="text-muted-foreground">Cargando catálogos…</p>
                ) : (
                  <>
                    <InfoRow label="Talla de camisa" value={nombrePorId(catalogos.tallas, pasivo.perfilFisico?.tallaCamisaId)} />
                    <InfoRow label="Talla de pantalón" value={nombrePorId(catalogos.tallas, pasivo.perfilFisico?.tallaPantalonId)} />
                    <InfoRow label="Talla de calzado" value={nombrePorId(catalogos.tallas, pasivo.perfilFisico?.tallaZapatosId)} />
                    <InfoRow label="Talla de chaqueta" value={nombrePorId(catalogos.tallas, pasivo.perfilFisico?.tallaChaquetaId)} />
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
                    <InfoRow label="Grupo sanguíneo" value={nombrePorId(catalogos.gruposSanguineos, pasivo.perfilSalud?.grupoSanguineoId)} />
                    <div>
                      <span className="text-muted-foreground">Alergias: </span>
                      {pasivo.perfilSalud?.alergias?.length
                        ? pasivo.perfilSalud.alergias.map((id) => nombrePorId(catalogos.alergias, id)).join(", ")
                        : "Ninguna"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Patologías crónicas: </span>
                      {pasivo.perfilSalud?.patologiasCronicas?.length
                        ? pasivo.perfilSalud.patologiasCronicas.map((id) => nombrePorId(catalogos.patologias, id)).join(", ")
                        : "Ninguna"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Discapacidades: </span>
                      {pasivo.perfilSalud?.discapacidades?.length
                        ? pasivo.perfilSalud.discapacidades.map((id) => nombrePorId(catalogos.discapacidades, id)).join(", ")
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
