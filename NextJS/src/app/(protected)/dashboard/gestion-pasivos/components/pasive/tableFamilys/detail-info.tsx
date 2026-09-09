"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import FileUpload from "@/app/(protected)/dashboard/gestion-trabajadores/components/employees/file-upload";
import { uploadFamilyDocument } from "@/app/(protected)/dashboard/gestion-trabajadores/components/employees/tableFamilys/actions/upload-document";
import UpdateFormAcademy from "@/app/(protected)/dashboard/gestion-trabajadores/components/employees/tableFamilys/updateInfo/form/form-academy-update";
import FormUpdateHealthFamily from "@/app/(protected)/dashboard/gestion-trabajadores/components/employees/tableFamilys/updateInfo/form/form-health_profile";
import UpdateFormPhysical from "@/app/(protected)/dashboard/gestion-trabajadores/components/employees/tableFamilys/updateInfo/form/form-physical-update";
import FormRelationship from "@/app/(protected)/dashboard/gestion-trabajadores/components/employees/tableFamilys/updateInfo/form/form-relationship";
import UpdateBasicInfoFamily from "@/app/(protected)/dashboard/gestion-trabajadores/components/employees/tableFamilys/updateInfo/form/form-update-info";
import { Family } from "@/app/types/types";
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
import { format } from "date-fns";
import {
  GraduationCap,
  Heart,
  PersonStanding,
  Shirt,
  FileDown,
  FileText,
} from "lucide-react";
import { useSWRConfig } from "swr";
import useSWR from "swr";
import { getFamilyDocuments } from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
interface FamilyDocument {
  id: number;
  document_type: string;
  file: string;
  uploaded_at: string;
}
interface Props {
  family: Family;
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
  const [file, setFile] = useState<File | undefined>();
  const [isPending, startTransition] = useTransition();

  const handleUpload = () => {
    if (!file) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("familiarId", String(familiarId));
      fd.append("document_type", documentType);
      fd.append("file", file);
      const result = await uploadFamilyDocument(fd);
      if (result.success) {
        toast.success(result.message || "Documento actualizado");
        setFile(undefined);
        onUploaded();
      } else {
        toast.error(result.message || "Error al subir el documento");
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
          className="cursor-pointer"
          disabled={isPending}
          onClick={handleUpload}
        >
          {isPending ? "Subiendo..." : "Guardar documento"}
        </Button>
      )}
    </div>
  );
}

export function DetailInfoFamily({ family }: Props) {
  // El rol RECEPCIONISTA sólo consulta: se ocultan los accesos a edición.
  const { data: session } = useSession();
  const soloLectura = session?.user?.role?.nombre_rol === "RECEPCIONISTA";
  const { mutate } = useSWRConfig();
  const { data: docsData } = useSWR(
    `family-docs-${family.id}`,
    async () => getFamilyDocuments(family.id),
  );
  const DJANGO_BASE =
    process.env.NEXT_PUBLIC_DJANGO_API_URL?.replace(/\/api\/?$/, "") || "";
  return (
    <SheetUI>
      <SheetTriggerUI asChild>
        <Button className="w-full">Ver Detalles</Button>
      </SheetTriggerUI>
      <SheetContentUI>
        <SheetHeaderUI>
          <SheetTitleUI>Información Detallada Del Familiar</SheetTitleUI>
        </SheetHeaderUI>
        <ScrollArea className="gap-5 h-[90%]">
          <div className="gap-5">
            <Card>
              <CardHeader className="flex justify-between">
                <div className="flex flex-row justify-between gap-2">
                  Información Basica
                  <PersonStanding />
                </div>
                <Dialog>
                  {!soloLectura && (
                  <DialogTrigger asChild>
                    <Button variant={"default"} size={"sm"}>
                      Editar
                    </Button>
                  </DialogTrigger>
                  )}
                  <DialogContent>
                    <UpdateBasicInfoFamily mutate={mutate} id={family.id} />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2">
                  <span>Cedula</span>
                  <span>{family.cedulaFamiliar}</span>
                  <span>Primer Nombre</span>
                  <span>{family.primer_nombre}</span>
                  <span>Segundo Nombre</span>
                  <span>{family.segundo_nombre ?? "N/A"}</span>
                  <span>Primer Apellido</span>
                  <span>{family.primer_apellido}</span>
                  <span>Segundo Apellido</span>
                  <span>{family.segundo_apellido ?? "N/A"}</span>
                  <span>F. Nacimiento</span>
                  <span>
                    {format(
                      new Date(family.fechanacimiento).toISOString(),
                      "dd/MM/yyyy",
                    )}
                  </span>
                  <span>Sexo</span>
                  <span>{family.sexo.sexo}</span>
                  <span>Estado Civil</span>
                  <span>{family.estadoCivil?.estadoCivil}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row justify-between">
                <div className="flex flex-row gap-2 items-center">
                  Relacion/Parentesco
                  <PersonStanding />
                </div>
                <Dialog>
                  {!soloLectura && (
                  <DialogTrigger asChild>
                    <Button variant={"default"} size={"sm"}>
                      Editar
                    </Button>
                  </DialogTrigger>
                  )}
                  <DialogContent>
                    <FormRelationship mutate={mutate} id={family.id} />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2">
                  <span>Parentesco</span>
                  <span>
                    {family.parentesco?.descripcion_parentesco ?? "N/A"}
                  </span>
                  <span>Labora en la Institución </span>
                  <span>
                    <Badge
                      variant={family.mismo_ente ? "default" : "destructive"}
                    >
                      {family.mismo_ente
                        ? "Trabaja en la Institucion"
                        : "No Trabaja en la Institucion"}
                    </Badge>
                  </span>
                  <span>Heredero </span>
                  <span>
                    <Badge
                      variant={family.heredero ? "default" : "destructive"}
                    >
                      {family.heredero ? "Heredero" : "No es heredero"}
                    </Badge>
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center gap-3 justify-between">
                  <div className="flex items-center gap-2">
                    Formaciones Academicas <GraduationCap />
                  </div>
                  <Dialog>
                    {!soloLectura && (
                    <DialogTrigger asChild>
                      <Button variant={"default"} size={"sm"}>
                        Editar
                      </Button>
                    </DialogTrigger>
                    )}
                    <DialogContent>
                      <UpdateFormAcademy mutate={mutate} id={family.id} />
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 place-content-center">
                  <div>Nivel Academico:</div>
                  <div>
                    {family.formacion_academica_familiar?.nivelAcademico
                      ?.nivelacademico ?? "N/A"}
                  </div>
                  <div>Carrera:</div>
                  <div>
                    {family.formacion_academica_familiar?.carrera
                      ?.nombre_carrera ?? "N/A"}
                  </div>
                  <div>Mención:</div>
                  <div>
                    {family.formacion_academica_familiar?.mencion
                      ?.nombre_mencion ?? "N/A"}
                  </div>
                  <div>Institución:</div>
                  <div>
                    {family.formacion_academica_familiar?.institucion
                      ?.nombre_institucion ?? "N/A"}
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
                    {!soloLectura && (
                    <DialogTrigger asChild>
                      <Button variant={"default"} size={"sm"}>
                        Editar
                      </Button>
                    </DialogTrigger>
                    )}
                    <DialogContent>
                      <UpdateFormPhysical mutate={mutate} id={family.id} />
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 place-content-center">
                  <div>Talla De Camisa:</div>
                  <div>
                    {family.perfil_fisico_familiar?.tallaCamisa?.valor ?? "N/A"}
                  </div>
                  <div>Talla de Pantalon:</div>
                  <div>
                    <div>
                      {family.perfil_fisico_familiar?.tallaPantalon?.valor ??
                        "N/A"}
                    </div>
                  </div>
                  <div>Talla De Calzado:</div>
                  <div>
                    <div>
                      {family.perfil_fisico_familiar?.tallaZapatos?.valor ??
                        "N/A"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <CardHeader className="flex flex-row justify-between">
              <div className=" flex flex-row items-center gap-2 ">
                Información De Salud <Heart />
              </div>
              <Dialog>
                {!soloLectura && (
                <DialogTrigger asChild>
                  <Button variant={"default"} size={"sm"}>
                    Editar
                  </Button>
                </DialogTrigger>
                )}
                <DialogContent>
                  <FormUpdateHealthFamily mutate={mutate} id={family.id} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 place-content-center">
                <div>Tipo De Sangre:</div>
                <div>
                  {family.perfil_salud_familiar?.grupoSanguineo != null
                    ? family.perfil_salud_familiar.grupoSanguineo.GrupoSanguineo
                    : "N/A"}
                </div>
                {family.perfil_salud_familiar?.patologiasCronicas &&
                  family.perfil_salud_familiar.patologiasCronicas.length >
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
                        {family.perfil_salud_familiar.patologiasCronicas.map(
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
                {family.perfil_salud_familiar?.discapacidad &&
                  family.perfil_salud_familiar.discapacidad.length > 0 && (
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
                        {family.perfil_salud_familiar.discapacidad.map(
                          (v, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">
                                {v.categoria.nombre_categoria}
                              </TableCell>
                              <TableCell>{v.discapacidad}</TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  )}
                {family.perfil_salud_familiar?.alergias &&
                  family.perfil_salud_familiar.alergias.length > 0 && (
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
                          {family.perfil_salud_familiar.alergias.map((v, i) => (
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
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-row items-center gap-2">
                  <FileText />
                  Documentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {docsData?.data?.map((doc) => (
                    <a
                      key={doc.id}
                      href={`${DJANGO_BASE}${doc.file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileDown className="size-4" />
                      </span>
                      <span className="flex flex-col min-w-0">
                        <span className="truncate text-sm font-medium group-hover:underline">
                          {doc.document_type === "cedula"
                            ? "Cédula del Familiar"
                            : "Partida de Nacimiento"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Ver documento
                        </span>
                      </span>
                    </a>
                  ))}
                  {(!docsData?.data || docsData.data.length === 0) && (
                    <span className="text-gray-400 text-sm">
                      No hay documentos subidos
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-3 pt-4 mt-2 border-t">
                  <span className="text-xs font-medium text-muted-foreground">
                    Subir o reemplazar documento
                  </span>
                  <FamilyDocumentUploader
                    familiarId={family.id}
                    documentType="cedula"
                    label="Foto o PDF de la Cédula"
                    onUploaded={() => mutate(`family-docs-${family.id}`)}
                  />
                  {family.parentesco?.descripcion_parentesco ===
                    "HIJO (A)" && (
                    <FamilyDocumentUploader
                      familiarId={family.id}
                      documentType="partida_nacimiento"
                      label="Partida de Nacimiento"
                      onUploaded={() => mutate(`family-docs-${family.id}`)}
                    />
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
