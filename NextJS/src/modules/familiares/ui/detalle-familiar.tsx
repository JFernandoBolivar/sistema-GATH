"use client";

/**
 * Vista de detalle (Sheet) de una carga familiar:
 * Réplica exacta de UI y efectos de detail-info.tsx del legado:
 * - Título: "Información Detallada Del Familiar"
 * - ScrollArea con cards temáticas e iconos Lucide:
 *   1. Información Básica (PersonStanding) + Botón Editar
 *   2. Relación/Parentesco (PersonStanding) + Botón Editar
 *   3. Formaciones Académicas (GraduationCap) + Botón Editar
 *   4. Información De Vestimenta (Shirt) + Botón Editar
 *   5. Información De Salud (Heart) + Botón Editar
 *   6. Documentos Del Familiar (FileText) con visor/descarga y subidor de documentos.
 */
import { useEffect, useState, useTransition } from "react";
import {
  FileDown,
  FileText,
  GraduationCap,
  Heart,
  Loader2,
  PersonStanding,
  Shirt,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { formatearFecha } from "@/shared/lib/formato-fecha";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/components/sheet";
import { FileUpload } from "@/shared/ui/components/file-upload";

import {
  CATALOGOS_FAMILIAR_VACIOS,
  type CatalogosFamiliarDTO,
  type DocumentoFamiliarDTO,
  type FamiliarDTO,
} from "../application/dtos/familiar-dto";
import {
  getCatalogosFamiliarAction,
  getDocumentosFamiliarAction,
  subirDocumentoFamiliarAction,
} from "../infrastructure/actions/familiares-actions";
import { etiquetaDocumento } from "./detalle-familiar-view-model";
import { FamiliarFormDialog } from "./familiar-form-dialog";

const SIN_DATO = "N/A";

interface DetalleFamiliarProps {
  familiar: FamiliarDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puedeEditar: boolean;
  onGuardado: (familiar: FamiliarDTO) => void;
}

function FamilyDocumentUploader({
  familiarId,
  documentType,
  label,
  onUploaded,
}: {
  familiarId: number;
  documentType: "cedula" | "partida_nacimiento";
  label: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUpload = () => {
    if (!file) return;
    startTransition(async () => {
      const result = await subirDocumentoFamiliarAction(familiarId, documentType, file);
      if (result && typeof result === "object" && "error" in result) {
        toast.error((result as { error: string }).error || "Error al subir el documento");
      } else {
        toast.success("Documento actualizado exitosamente");
        setFile(null);
        onUploaded();
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <FileUpload label={label} value={file} onChange={setFile} />
      {file && (
        <Button
          type="button"
          size="sm"
          className="cursor-pointer self-start"
          disabled={isPending}
          onClick={handleUpload}
        >
          {isPending ? "Subiendo..." : "Guardar documento"}
        </Button>
      )}
    </div>
  );
}

export function DetalleFamiliar({
  familiar,
  open,
  onOpenChange,
  puedeEditar,
  onGuardado,
}: DetalleFamiliarProps) {
  const [documentos, setDocumentos] = useState<DocumentoFamiliarDTO[] | null>(null);
  const [cargandoDocs, setCargandoDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosFamiliarDTO | null>(null);

  useEffect(() => {
    if (!open) return;
    getCatalogosFamiliarAction()
      .then(setCatalogos)
      .catch(() => setCatalogos(CATALOGOS_FAMILIAR_VACIOS));
  }, [open]);

  const cargarDocumentos = () => {
    setCargandoDocs(true);
    setErrorDocs(null);
    getDocumentosFamiliarAction(familiar.id)
      .then((resultado) => {
        if (resultado && typeof resultado === "object" && "error" in resultado) {
          setErrorDocs((resultado as { error: string }).error);
          return;
        }
        setDocumentos((resultado as DocumentoFamiliarDTO[]) ?? []);
      })
      .catch(() => setErrorDocs("No fue posible cargar los documentos."))
      .finally(() => setCargandoDocs(false));
  };

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al abrir el diálogo
      cargarDocumentos();
    } else {
      setDocumentos(null);
    }
  }, [open, familiar.id]);

  const fa = familiar.formacionAcademica;
  const nivelNombre =
    catalogos?.nivelesAcademicos.find((n) => n.id === fa?.nivelAcademicoId)?.nombre ?? SIN_DATO;
  const carreraNombre = catalogos?.carreras.find((c) => c.id === fa?.carreraId)?.nombre ?? SIN_DATO;
  const mencionNombre =
    catalogos?.menciones.find((m) => m.id === fa?.mencionId)?.nombre ?? SIN_DATO;
  const instNombre =
    catalogos?.instituciones.find((i) => i.id === fa?.institucionId)?.nombre ?? SIN_DATO;

  const pf = familiar.perfilFisico;
  const camisaNombre =
    catalogos?.tallas.find((t) => t.id === pf?.tallaCamisaId)?.nombre ?? SIN_DATO;
  const pantalonNombre =
    catalogos?.tallas.find((t) => t.id === pf?.tallaPantalonId)?.nombre ?? SIN_DATO;
  const zapatosNombre =
    catalogos?.tallas.find((t) => t.id === pf?.tallaZapatosId)?.nombre ?? SIN_DATO;
  const chaquetaNombre =
    catalogos?.tallas.find((t) => t.id === pf?.tallaChaquetaId)?.nombre ?? SIN_DATO;

  const ps = familiar.perfilSalud;
  const sangreNombre =
    catalogos?.gruposSanguineos.find((g) => g.id === ps?.grupoSanguineoId)?.nombre ?? SIN_DATO;
  const patologiasNombres = (ps?.patologiasCronicas ?? [])
    .map((id) => catalogos?.patologias.find((p) => p.id === id)?.nombre)
    .filter(Boolean);
  const discapacidadesNombres = (ps?.discapacidades ?? [])
    .map((id) => catalogos?.discapacidades.find((d) => d.id === id)?.nombre)
    .filter(Boolean);
  const alergiasNombres = (ps?.alergias ?? [])
    .map((id) => catalogos?.alergias.find((a) => a.id === id)?.nombre)
    .filter(Boolean);

  const esHijo =
    familiar.parentescoNombre?.toUpperCase().includes("HIJO") ||
    familiar.parentescoNombre?.toUpperCase().includes("HIJA");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Información Detallada Del Familiar</SheetTitle>
        </SheetHeader>

        <ScrollArea className="gap-5 h-[90%] pr-2">
          <div className="flex flex-col gap-4 py-4">
            {/* Header del familiar con botón Editar */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30">
              <div className="flex items-center gap-2">
                <UserRound className="size-6 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-base">
                    {familiar.primerNombre} {familiar.segundoNombre ?? ""} {familiar.primerApellido}{" "}
                    {familiar.segundoApellido ?? ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cédula: {familiar.cedulaFamiliar ?? SIN_DATO}
                  </p>
                </div>
              </div>
              {puedeEditar && <FamiliarFormDialog familiar={familiar} onGuardado={onGuardado} />}
            </div>

            {/* 1. INFORMACIÓN BÁSICA */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex flex-row items-center gap-2 font-bold text-sm">
                  Información Basica <PersonStanding className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Cedula</span>
                  <span className="font-medium">{familiar.cedulaFamiliar ?? SIN_DATO}</span>

                  <span className="text-muted-foreground">Primer Nombre</span>
                  <span className="font-medium">{familiar.primerNombre}</span>

                  <span className="text-muted-foreground">Segundo Nombre</span>
                  <span className="font-medium">{familiar.segundoNombre ?? SIN_DATO}</span>

                  <span className="text-muted-foreground">Primer Apellido</span>
                  <span className="font-medium">{familiar.primerApellido}</span>

                  <span className="text-muted-foreground">Segundo Apellido</span>
                  <span className="font-medium">{familiar.segundoApellido ?? SIN_DATO}</span>

                  <span className="text-muted-foreground">F. Nacimiento</span>
                  <span className="font-medium">{formatearFecha(familiar.fechaNacimiento)}</span>

                  <span className="text-muted-foreground">Sexo</span>
                  <span className="font-medium">{familiar.sexoNombre}</span>
                </div>
              </CardContent>
            </Card>

            {/* 2. RELACIÓN Y PARENTESCO */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex flex-row items-center gap-2 font-bold text-sm">
                  Relacion/Parentesco <PersonStanding className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Parentesco</span>
                  <span className="font-medium">{familiar.parentescoNombre ?? SIN_DATO}</span>

                  <span className="text-muted-foreground">Labora en la Institución</span>
                  <div>
                    <Badge variant={familiar.mismoEnte ? "default" : "destructive"}>
                      {familiar.mismoEnte
                        ? "Trabaja en la Institucion"
                        : "No Trabaja en la Institucion"}
                    </Badge>
                  </div>

                  <span className="text-muted-foreground">Heredero</span>
                  <div>
                    <Badge variant={familiar.heredero ? "default" : "destructive"}>
                      {familiar.heredero ? "Heredero" : "No es heredero"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. FORMACIONES ACADÉMICAS */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex flex-row items-center gap-2 font-bold text-sm">
                  Formaciones Academicas <GraduationCap className="size-4" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Nivel Academico:</span>
                  <span className="font-medium">{nivelNombre}</span>

                  <span className="text-muted-foreground">Carrera:</span>
                  <span className="font-medium">{carreraNombre}</span>

                  <span className="text-muted-foreground">Mención:</span>
                  <span className="font-medium">{mencionNombre}</span>

                  <span className="text-muted-foreground">Institución:</span>
                  <span className="font-medium">{instNombre}</span>
                </div>
              </CardContent>
            </Card>

            {/* 4. INFORMACIÓN DE VESTIMENTA */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex flex-row items-center gap-2 font-bold text-sm">
                  Información De Vestimenta <Shirt className="size-4" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Talla De Camisa:</span>
                  <span className="font-medium">{camisaNombre}</span>

                  <span className="text-muted-foreground">Talla de Pantalon:</span>
                  <span className="font-medium">{pantalonNombre}</span>

                  <span className="text-muted-foreground">Talla De Calzado:</span>
                  <span className="font-medium">{zapatosNombre}</span>

                  {chaquetaNombre !== SIN_DATO && (
                    <>
                      <span className="text-muted-foreground">Talla De Chaqueta:</span>
                      <span className="font-medium">{chaquetaNombre}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 5. INFORMACIÓN DE SALUD */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex flex-row items-center gap-2 font-bold text-sm">
                  Información De Salud <Heart className="size-4" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Tipo De Sangre:</span>
                  <span className="font-medium">{sangreNombre}</span>

                  <span className="text-muted-foreground">Patologías:</span>
                  <span className="font-medium">
                    {patologiasNombres.length > 0 ? patologiasNombres.join(", ") : SIN_DATO}
                  </span>

                  <span className="text-muted-foreground">Discapacidades:</span>
                  <span className="font-medium">
                    {discapacidadesNombres.length > 0 ? discapacidadesNombres.join(", ") : SIN_DATO}
                  </span>

                  <span className="text-muted-foreground">Alergias:</span>
                  <span className="font-medium">
                    {alergiasNombres.length > 0 ? alergiasNombres.join(", ") : SIN_DATO}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* OBSERVACIONES */}
            {familiar.observaciones && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold">Observaciones</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {familiar.observaciones}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 6. DOCUMENTOS DEL FAMILIAR */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <FileText className="size-4" /> Documentos Del Familiar
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {cargandoDocs ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : errorDocs ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errorDocs}
                  </p>
                ) : !documentos?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No hay documentos registrados para este familiar.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {documentos.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-2 rounded-md border bg-muted/20 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-primary" />
                          <span className="font-medium">{etiquetaDocumento(d.tipoDocumento)}</span>
                          <span className="text-xs text-muted-foreground">
                            ({formatearFecha(d.fechaSubida)})
                          </span>
                        </div>
                        {d.rutaArchivo && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={d.rutaArchivo} target="_blank" rel="noopener noreferrer">
                              <FileDown className="size-4 mr-1" /> Ver / Descargar
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {puedeEditar && (
                  <div className="border-t pt-3 flex flex-col gap-3">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                      Subir nuevo documento
                    </h4>
                    <FamilyDocumentUploader
                      familiarId={familiar.id}
                      documentType="cedula"
                      label="Foto o PDF de la Cédula"
                      onUploaded={cargarDocumentos}
                    />
                    {esHijo && (
                      <FamilyDocumentUploader
                        familiarId={familiar.id}
                        documentType="partida_nacimiento"
                        label="Partida de Nacimiento"
                        onUploaded={cargarDocumentos}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
