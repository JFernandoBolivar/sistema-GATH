"use client";

/**
 * Vista de detalle (con edición vía diálogo embebido) de una carga
 * familiar: datos personales, parentesco, observaciones y documentos
 * adjuntos. Controlado externamente (`open`/`onOpenChange`) para que el
 * menú de acciones de `familiares-columns.tsx` lo abra igual que
 * `EmpleadoDetalleSheet` en `modules/personal`. Réplica de paridad
 * funcional de `dashboard/{gestion-trabajadores,gestion-pasivos}/.../
 * tableFamilys/detail-info.tsx` del legado — con una diferencia deliberada:
 * NO incluye estado civil, formación académica, perfil físico ni salud del
 * familiar. Esos campos nunca llegaron a tener un endpoint funcional en
 * este backend (el legado los pedía a `Employeefamily/...`, una ruta que no
 * existe en `GATH/urls.py` ni en `apps/familiares/presentation/urls.py`) ni
 * existen en el dominio nuevo de `apps.familiares` — reproducirlos aquí
 * sería fabricar una funcionalidad que jamás funcionó de punta a punta, no
 * preservar paridad real. Ver REPORTE_FINAL_MIGRACION_2026-09-12.md.
 *
 * Tampoco incluye enlaces de descarga de documentos: el servidor de media
 * autenticado (`core/presentation/views/media_views.py`) deniega
 * explícitamente el prefijo `familiares/` y no existe ningún endpoint de
 * descarga dedicado en `apps.familiares` — solo se muestra el metadato
 * (tipo + fecha) que el endpoint de listado sí devuelve.
 *
 * Opera exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useState } from "react";
import { FileText, Loader2, UserRound } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/components/sheet";

import type { DocumentoFamiliarDTO, FamiliarDTO } from "../application/dtos/familiar-dto";
import { getDocumentosFamiliarAction } from "../infrastructure/actions/familiares-actions";
import { etiquetaDocumento, fechaLegible } from "./detalle-familiar-view-model";
import { FamiliarFormDialog } from "./familiar-form-dialog";

const SIN_DATO = "N/A";

interface DetalleFamiliarProps {
  familiar: FamiliarDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puedeEditar: boolean;
  onGuardado: (familiar: FamiliarDTO) => void;
}

export function DetalleFamiliar({ familiar, open, onOpenChange, puedeEditar, onGuardado }: DetalleFamiliarProps) {
  const [documentos, setDocumentos] = useState<DocumentoFamiliarDTO[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarDocumentos = () => {
    if (documentos !== null) return;
    setCargando(true);
    setError(null);
    getDocumentosFamiliarAction(familiar.id)
      .then((resultado) => {
        if (resultado && typeof resultado === "object" && "error" in resultado) {
          setError((resultado as { error: string }).error);
          return;
        }
        setDocumentos(resultado as DocumentoFamiliarDTO[]);
      })
      .catch(() => setError("No fue posible cargar los documentos."))
      .finally(() => setCargando(false));
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(siguiente) => {
        onOpenChange(siguiente);
        if (siguiente) cargarDocumentos();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Expediente del familiar</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-8">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserRound className="size-5 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  {familiar.primerNombre} {familiar.segundoNombre ?? ""} {familiar.primerApellido} {familiar.segundoApellido ?? ""}
                </p>
                <p className="text-sm text-muted-foreground">Cédula: {familiar.cedulaFamiliar ?? SIN_DATO}</p>
              </div>
            </div>
            {puedeEditar && <FamiliarFormDialog familiar={familiar} onGuardado={onGuardado} />}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Datos personales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Sexo</div>
              <div>{familiar.sexoNombre}</div>
              <div className="text-muted-foreground">Fecha de nacimiento</div>
              <div>{fechaLegible(familiar.fechaNacimiento)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Parentesco</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Parentesco</div>
              <div>{familiar.parentescoNombre}</div>
              <div className="text-muted-foreground">Labora en la institución</div>
              <div>
                <Badge variant={familiar.mismoEnte ? "default" : "destructive"}>
                  {familiar.mismoEnte ? "Sí" : "No"}
                </Badge>
              </div>
              <div className="text-muted-foreground">Heredero</div>
              <div>
                <Badge variant={familiar.heredero ? "default" : "destructive"}>
                  {familiar.heredero ? "Heredero" : "No heredero"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {familiar.observaciones && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Observaciones</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{familiar.observaciones}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="size-4" aria-hidden="true" />
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cargando ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
                </div>
              ) : error ? (
                <p role="alert" className="text-sm text-destructive">{error}</p>
              ) : !documentos?.length ? (
                <p className="text-sm text-muted-foreground">No hay documentos registrados.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {documentos.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span>{etiquetaDocumento(d.tipoDocumento)}</span>
                      <span className="text-muted-foreground">{fechaLegible(d.fechaSubida)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
