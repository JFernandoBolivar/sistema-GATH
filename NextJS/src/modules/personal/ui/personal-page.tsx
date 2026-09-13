"use client";

/**
 * Página de personal: registro/edición del expediente completo (básico +
 * vivienda, salud, físico, formación académica/complementaria, contacto de
 * emergencia, antecedentes y contrato), listado con búsqueda y subida de
 * foto. Cliente + react-hook-form + zodResolver; las acciones van envueltas
 * en useTransition (R8) y se delegan a las Server Actions del módulo (R7).
 * Opera exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import {
  Camera,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";

import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";

import type {
  CatalogosExpedienteDTO,
  CatalogoEmpleadoDTO,
  EmpleadoDTO,
  GuardarEmpleadoInputDTO,
} from "../application/dtos/empleado-dto";
import {
  actualizarEmpleadoAction,
  getCatalogosExpedienteAction,
  getEmpleadoPorCedulaAction,
  getEmpleadosAction,
  registrarEmpleadoAction,
  subirFotoEmpleadoAction,
} from "../infrastructure/actions/personal-actions";
import EmpleadoDetalleSheet from "./empleado-detalle-sheet";
import { EmpleadoDetallePdf } from "./empleado-detalle-pdf";
import { construirDetalleExpediente } from "./expediente-detalle-view-model";
import {
  empleadoCedulaSchema,
  empleadoSchema,
  type EmpleadoFormType,
  listadoEmpleadosSchema,
  type ListadoEmpleadosFormType,
} from "./schema/schema-empleado";

function CatalogSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string | undefined;
  onChange: (v: number) => void;
  options: CatalogoEmpleadoDTO[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ? Number(v) : 0)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiCatalogCheckbox({
  value,
  onChange,
  options,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  options: CatalogoEmpleadoDTO[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const activo = value.includes(o.id);
        return (
          <label
            key={o.id}
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
          >
            <input
              type="checkbox"
              className="size-3.5"
              checked={activo}
              onChange={() => onChange(activo ? value.filter((x) => x !== o.id) : [...value, o.id])}
            />
            {o.nombre}
          </label>
        );
      })}
    </div>
  );
}

const defaultExpediente: Partial<EmpleadoFormType> = {
  cedula: "",
  nombres: "",
  apellidos: "",
  fechaNacimiento: "",
  correo: "",
  telefonoMovil: "",
  telefonoHabitacion: "",
  carnetPatria: "",
  datosVivienda: {
    estadoId: undefined,
    municipioId: undefined,
    parroquiaId: undefined,
    direccionExacta: "",
    condicionViviendaId: undefined,
    codigoPostalId: undefined,
  },
  perfilSalud: { grupoSanguineoId: undefined, alergias: [], patologiasCronicas: [], discapacidades: [] },
  perfilFisico: { tallaCamisaId: undefined, tallaPantalonId: undefined, tallaZapatosId: undefined, tallaChaquetaId: undefined },
  formacionAcademica: [],
  formacionComplementaria: [],
  contactoEmergencia: [],
  antecedentes: [],
  contrato: [],
};

export default function PersonalPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeCrear = tienePermiso(permisos, "personal.crear");
  const puedeEditar = tienePermiso(permisos, "personal.editar_personales");
  const puedeVerDetalle = tienePermiso(permisos, "personal.ver_detalle");

  const [empleados, setEmpleados] = useState<EmpleadoDTO[]>([]);
  const [editando, setEditando] = useState<EmpleadoDTO | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosExpedienteDTO | null>(null);
  const [viendoDetalle, setViendoDetalle] = useState<EmpleadoDTO | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busquedaForm = useForm<ListadoEmpleadosFormType>({ resolver: zodResolver(listadoEmpleadosSchema), defaultValues: {} });
  const form = useForm<EmpleadoFormType>({ resolver: zodResolver(empleadoSchema), defaultValues: defaultExpediente as EmpleadoFormType });
  const { fields: camposAcad, append: appendAcad, remove: removeAcad } = useFieldArray({ control: form.control, name: "formacionAcademica" });
  const { fields: camposComp, append: appendComp, remove: removeComp } = useFieldArray({ control: form.control, name: "formacionComplementaria" });
  const { fields: camposContacto, append: appendContacto, remove: removeContacto } = useFieldArray({ control: form.control, name: "contactoEmergencia" });
  const { fields: camposAnte, append: appendAnte, remove: removeAnte } = useFieldArray({ control: form.control, name: "antecedentes" });
  const { fields: camposContrato, append: appendContrato, remove: removeContrato } = useFieldArray({ control: form.control, name: "contrato" });

  const cargar = (busqueda?: string) => {
    startTransition(async () => {
      setError(null);
      try {
        setEmpleados(await getEmpleadosAction({ busqueda }));
      } catch {
        setError("No fue posible cargar el personal.");
      }
    });
  };

  useEffect(() => {
    cargar();
    startTransition(async () => {
      setError(null);
      try {
        setCatalogos(await getCatalogosExpedienteAction());
      } catch {
        setError("No fue posible cargar los catálogos del expediente.");
      }
    });
  }, []);

  const onBuscar = (data: ListadoEmpleadosFormType) => cargar(data.busqueda ?? undefined);

  const resetForm = () => {
    setEditando(null);
    form.reset(defaultExpediente as EmpleadoFormType);
  };

  const onGuardar = (data: EmpleadoFormType) => {
    startTransition(async () => {
      setError(null);
      const input = data as unknown as GuardarEmpleadoInputDTO;
      const resultado = editando
        ? await actualizarEmpleadoAction(editando.cedula, input as Partial<GuardarEmpleadoInputDTO>)
        : await registrarEmpleadoAction(input);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      resetForm();
      cargar();
    });
  };

  const onBuscarParaEditar = (cedula: string) => {
    startTransition(async () => {
      setError(null);
      const resultado = await getEmpleadoPorCedulaAction(cedula);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      const emp = resultado as EmpleadoDTO;
      setEditando(emp);
      form.reset({
        cedula: emp.cedula,
        nombres: emp.nombres,
        apellidos: emp.apellidos,
        sexoId: emp.sexoId,
        fechaNacimiento: emp.fechaNacimiento ?? undefined,
        correo: emp.correo,
        telefonoMovil: emp.telefonoMovil,
        telefonoHabitacion: emp.telefonoHabitacion,
        estadoCivilId: emp.estadoCivilId ?? undefined,
        carnetPatria: emp.carnetPatria,
        datosVivienda: emp.datosVivienda ?? {
          estadoId: undefined,
          municipioId: undefined,
          parroquiaId: undefined,
          direccionExacta: "",
          condicionViviendaId: undefined,
          codigoPostalId: undefined,
        },
        perfilSalud: emp.perfilSalud ?? { grupoSanguineoId: undefined, alergias: [], patologiasCronicas: [], discapacidades: [] },
        perfilFisico: emp.perfilFisico ?? { tallaCamisaId: undefined, tallaPantalonId: undefined, tallaZapatosId: undefined, tallaChaquetaId: undefined },
        formacionAcademica: emp.formacionAcademica ?? [],
        formacionComplementaria: emp.formacionComplementaria ?? [],
        contactoEmergencia: emp.contactoEmergencia ?? [],
        antecedentes: emp.antecedentes ?? [],
        contrato: [],
      });
    });
  };

  const onSubirFoto = (cedula: string) => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      setError(null);
      try {
        await subirFotoEmpleadoAction(cedula, formData);
        cargar();
      } catch {
        setError("No fue posible subir la foto.");
      }
    });
  };

  const municipios = (estadoId?: number) => catalogos?.municipios.filter((m) => !estadoId || m.nombre) ?? [];
  const parroquias = (municipioId?: number) => catalogos?.parroquias.filter((p) => !municipioId || p.nombre) ?? [];

  const onVerDetalle = (cedula: string) => {
    setDetalleAbierto(true);
    setViendoDetalle(null);
    startTransition(async () => {
      setError(null);
      const resultado = await getEmpleadoPorCedulaAction(cedula);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        setDetalleAbierto(false);
        return;
      }
      setViendoDetalle(resultado as EmpleadoDTO);
    });
  };

  const onExportarPdf = () => {
    if (!viendoDetalle || !catalogos) return;
    setExportandoPdf(true);
    startTransition(async () => {
      try {
        const detalleVM = construirDetalleExpediente(viendoDetalle, catalogos);
        const { pdf } = await import("@react-pdf/renderer");
        const blob = await pdf(
          <EmpleadoDetallePdf
            detalle={detalleVM}
            generadoPor={session?.user?.name ?? undefined}
            generadoEn={new Date().toLocaleString("es-VE")}
          />,
        ).toBlob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `expediente-${viendoDetalle.cedula}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch {
        setError("No fue posible generar el PDF del expediente.");
      } finally {
        setExportandoPdf(false);
      }
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Users className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Personal</h1>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {!puedeCrear && !puedeEditar && (
        <p className="text-sm text-muted-foreground">
          Su perfil solo tiene acceso de consulta al personal.
        </p>
      )}

      {(editando ? puedeEditar : puedeCrear) && (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{editando ? "Editar empleado" : "Registrar empleado"}</CardTitle>
          {editando && <CardDescription>Editando a {editando.nombreCompleto}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onGuardar)} className="flex flex-col gap-6" noValidate>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Datos básicos</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field data-invalid={!!form.formState.errors.cedula}>
                  <Label htmlFor="cedula">Cédula</Label>
                  <Input id="cedula" {...form.register("cedula")} aria-invalid={!!form.formState.errors.cedula} />
                </Field>
                <Field data-invalid={!!form.formState.errors.nombres}>
                  <Label htmlFor="nombres">Nombres</Label>
                  <Input id="nombres" {...form.register("nombres")} aria-invalid={!!form.formState.errors.nombres} />
                </Field>
                <Field data-invalid={!!form.formState.errors.apellidos}>
                  <Label htmlFor="apellidos">Apellidos</Label>
                  <Input id="apellidos" {...form.register("apellidos")} aria-invalid={!!form.formState.errors.apellidos} />
                </Field>
                <Field data-invalid={!!form.formState.errors.sexoId}>
                  <Label htmlFor="sexoId">Sexo (id)</Label>
                  <Input type="number" id="sexoId" {...form.register("sexoId", { valueAsNumber: true })} aria-invalid={!!form.formState.errors.sexoId} />
                </Field>
                <Field data-invalid={!!form.formState.errors.fechaNacimiento}>
                  <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
                  <Input type="date" id="fechaNacimiento" {...form.register("fechaNacimiento")} aria-invalid={!!form.formState.errors.fechaNacimiento} />
                </Field>
                <Field>
                  <Label htmlFor="correo">Correo</Label>
                  <Input id="correo" {...form.register("correo")} />
                </Field>
                <Field>
                  <Label htmlFor="telefonoMovil">Teléfono móvil</Label>
                  <Input id="telefonoMovil" {...form.register("telefonoMovil")} />
                </Field>
                <Field>
                  <Label htmlFor="telefonoHabitacion">Teléfono habitación</Label>
                  <Input id="telefonoHabitacion" {...form.register("telefonoHabitacion")} />
                </Field>
                <Field>
                  <Label htmlFor="estadoCivilId">Estado civil (id)</Label>
                  <Input type="number" id="estadoCivilId" {...form.register("estadoCivilId", { valueAsNumber: true })} />
                </Field>
                <Field>
                  <Label htmlFor="carnetPatria">Carnet de la patria</Label>
                  <Input id="carnetPatria" {...form.register("carnetPatria")} />
                </Field>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Vivienda</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field>
                  <Label htmlFor="vivEstado">Estado</Label>
                  <CatalogSelect id="vivEstado" value={form.watch("datosVivienda.estadoId") ? String(form.watch("datosVivienda.estadoId")) : undefined} onChange={(v) => form.setValue("datosVivienda.estadoId", v)} options={catalogos?.estados ?? []} placeholder="Seleccione estado" />
                </Field>
                <Field>
                  <Label htmlFor="vivMunicipio">Municipio</Label>
                  <CatalogSelect id="vivMunicipio" value={form.watch("datosVivienda.municipioId") ? String(form.watch("datosVivienda.municipioId")) : undefined} onChange={(v) => form.setValue("datosVivienda.municipioId", v)} options={municipios(undefined)} placeholder="Seleccione municipio" />
                </Field>
                <Field>
                  <Label htmlFor="vivParroquia">Parroquia</Label>
                  <CatalogSelect id="vivParroquia" value={form.watch("datosVivienda.parroquiaId") ? String(form.watch("datosVivienda.parroquiaId")) : undefined} onChange={(v) => form.setValue("datosVivienda.parroquiaId", v)} options={parroquias(undefined)} placeholder="Seleccione parroquia" />
                </Field>
                <Field>
                  <Label htmlFor="vivDireccion">Dirección exacta</Label>
                  <Input id="vivDireccion" {...form.register("datosVivienda.direccionExacta")} />
                </Field>
                <Field>
                  <Label htmlFor="vivCondicion">Condición de vivienda</Label>
                  <CatalogSelect id="vivCondicion" value={form.watch("datosVivienda.condicionViviendaId") ? String(form.watch("datosVivienda.condicionViviendaId")) : undefined} onChange={(v) => form.setValue("datosVivienda.condicionViviendaId", v)} options={catalogos?.condicionesVivienda ?? []} placeholder="Seleccione condición" />
                </Field>
                <Field>
                  <Label htmlFor="vivCodigoPostal">Código postal</Label>
                  <CatalogSelect id="vivCodigoPostal" value={form.watch("datosVivienda.codigoPostalId") ? String(form.watch("datosVivienda.codigoPostalId")) : undefined} onChange={(v) => form.setValue("datosVivienda.codigoPostalId", v)} options={catalogos?.codigosPostales ?? []} placeholder="Seleccione código postal" />
                </Field>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Perfil de salud</h3>
              <div className="flex flex-col gap-4">
                <Field>
                  <Label htmlFor="saludGrupo">Grupo sanguíneo</Label>
                  <CatalogSelect id="saludGrupo" value={form.watch("perfilSalud.grupoSanguineoId") ? String(form.watch("perfilSalud.grupoSanguineoId")) : undefined} onChange={(v) => form.setValue("perfilSalud.grupoSanguineoId", v)} options={catalogos?.gruposSanguineos ?? []} placeholder="Seleccione grupo" />
                </Field>
                <Field>
                  <Label>Alergias</Label>
                  <MultiCatalogCheckbox value={form.watch("perfilSalud.alergias") ?? []} onChange={(ids) => form.setValue("perfilSalud.alergias", ids)} options={catalogos?.alergias ?? []} />
                </Field>
                <Field>
                  <Label>Patologías crónicas</Label>
                  <MultiCatalogCheckbox value={form.watch("perfilSalud.patologiasCronicas") ?? []} onChange={(ids) => form.setValue("perfilSalud.patologiasCronicas", ids)} options={catalogos?.patologias ?? []} />
                </Field>
                <Field>
                  <Label>Discapacidades</Label>
                  <MultiCatalogCheckbox value={form.watch("perfilSalud.discapacidades") ?? []} onChange={(ids) => form.setValue("perfilSalud.discapacidades", ids)} options={catalogos?.discapacidades ?? []} />
                </Field>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Perfil físico (tallas)</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Field><Label htmlFor="fisCamisa">Talla camisa</Label><CatalogSelect id="fisCamisa" value={form.watch("perfilFisico.tallaCamisaId") ? String(form.watch("perfilFisico.tallaCamisaId")) : undefined} onChange={(v) => form.setValue("perfilFisico.tallaCamisaId", v)} options={catalogos?.tallas ?? []} placeholder="Seleccione talla" /></Field>
                <Field><Label htmlFor="fisPantalon">Talla pantalón</Label><CatalogSelect id="fisPantalon" value={form.watch("perfilFisico.tallaPantalonId") ? String(form.watch("perfilFisico.tallaPantalonId")) : undefined} onChange={(v) => form.setValue("perfilFisico.tallaPantalonId", v)} options={catalogos?.tallas ?? []} placeholder="Seleccione talla" /></Field>
                <Field><Label htmlFor="fisZapatos">Talla zapatos</Label><CatalogSelect id="fisZapatos" value={form.watch("perfilFisico.tallaZapatosId") ? String(form.watch("perfilFisico.tallaZapatosId")) : undefined} onChange={(v) => form.setValue("perfilFisico.tallaZapatosId", v)} options={catalogos?.tallas ?? []} placeholder="Seleccione talla" /></Field>
                <Field><Label htmlFor="fisChaqueta">Talla chaqueta</Label><CatalogSelect id="fisChaqueta" value={form.watch("perfilFisico.tallaChaquetaId") ? String(form.watch("perfilFisico.tallaChaquetaId")) : undefined} onChange={(v) => form.setValue("perfilFisico.tallaChaquetaId", v)} options={catalogos?.tallas ?? []} placeholder="Seleccione talla" /></Field>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Formación académica</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => appendAcad({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
              </div>
              <div className="flex flex-col gap-3">
                {camposAcad.map((item, i) => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-5">
                    <Field><Label>Nivel académico</Label><CatalogSelect id={`acadNivel${i}`} value={form.watch(`formacionAcademica.${i}.nivelAcademicoId`) ? String(form.watch(`formacionAcademica.${i}.nivelAcademicoId`)) : undefined} onChange={(v) => form.setValue(`formacionAcademica.${i}.nivelAcademicoId`, v)} options={catalogos?.nivelesAcademicos ?? []} placeholder="Seleccione nivel" /></Field>
                    <Field><Label>Carrera</Label><CatalogSelect id={`acadCarrera${i}`} value={form.watch(`formacionAcademica.${i}.carreraId`) ? String(form.watch(`formacionAcademica.${i}.carreraId`)) : undefined} onChange={(v) => form.setValue(`formacionAcademica.${i}.carreraId`, v)} options={catalogos?.carreras ?? []} placeholder="Seleccione carrera" /></Field>
                    <Field><Label>Mención</Label><CatalogSelect id={`acadMencion${i}`} value={form.watch(`formacionAcademica.${i}.mencionId`) ? String(form.watch(`formacionAcademica.${i}.mencionId`)) : undefined} onChange={(v) => form.setValue(`formacionAcademica.${i}.mencionId`, v)} options={catalogos?.menciones ?? []} placeholder="Seleccione mención" /></Field>
                    <Field><Label>Institución</Label><CatalogSelect id={`acadInst${i}`} value={form.watch(`formacionAcademica.${i}.institucionId`) ? String(form.watch(`formacionAcademica.${i}.institucionId`)) : undefined} onChange={(v) => form.setValue(`formacionAcademica.${i}.institucionId`, v)} options={catalogos?.instituciones ?? []} placeholder="Seleccione institución" /></Field>
                    <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeAcad(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
                  </div>
                ))}
                {camposAcad.length === 0 && <p className="text-xs text-muted-foreground">Sin formación académica registrada.</p>}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Formación complementaria</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => appendComp({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
              </div>
              <div className="flex flex-col gap-3">
                {camposComp.map((item, i) => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-4">
                    <Field><Label>Capacitación</Label><CatalogSelect id={`compCap${i}`} value={form.watch(`formacionComplementaria.${i}.capacitacionId`) ? String(form.watch(`formacionComplementaria.${i}.capacitacionId`)) : undefined} onChange={(v) => form.setValue(`formacionComplementaria.${i}.capacitacionId`, v)} options={catalogos?.capacitaciones ?? []} placeholder="Seleccione" /></Field>
                    <Field><Label>Institución</Label><CatalogSelect id={`compInst${i}`} value={form.watch(`formacionComplementaria.${i}.institucionId`) ? String(form.watch(`formacionComplementaria.${i}.institucionId`)) : undefined} onChange={(v) => form.setValue(`formacionComplementaria.${i}.institucionId`, v)} options={catalogos?.instituciones ?? []} placeholder="Seleccione" /></Field>
                    <Field><Label>Fecha inicio</Label><Input type="date" {...form.register(`formacionComplementaria.${i}.fechaInicio`)} /></Field>
                    <Field><Label>Fecha fin</Label><Input type="date" {...form.register(`formacionComplementaria.${i}.fechaFin`)} /></Field>
                    <Field><Label>Días completados</Label><Input {...form.register(`formacionComplementaria.${i}.diasCompletados`)} /></Field>
                    <Field><Label>Horas completadas</Label><Input {...form.register(`formacionComplementaria.${i}.horasCompletadas`)} /></Field>
                    <Field><Label>Procedencia</Label><CatalogSelect id={`compProc${i}`} value={form.watch(`formacionComplementaria.${i}.procedenciaId`) ? String(form.watch(`formacionComplementaria.${i}.procedenciaId`)) : undefined} onChange={(v) => form.setValue(`formacionComplementaria.${i}.procedenciaId`, v)} options={catalogos?.tiposProcedencia ?? []} placeholder="Seleccione" /></Field>
                    <Field><Label>Grupo</Label><CatalogSelect id={`compGrupo${i}`} value={form.watch(`formacionComplementaria.${i}.grupoId`) ? String(form.watch(`formacionComplementaria.${i}.grupoId`)) : undefined} onChange={(v) => form.setValue(`formacionComplementaria.${i}.grupoId`, v)} options={catalogos?.gruposCapacitacion ?? []} placeholder="Seleccione" /></Field>
                    <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeComp(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
                  </div>
                ))}
                {camposComp.length === 0 && <p className="text-xs text-muted-foreground">Sin formación complementaria registrada.</p>}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Contacto de emergencia</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => appendContacto({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
              </div>
              <div className="flex flex-col gap-3">
                {camposContacto.map((item, i) => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-5">
                    <Field><Label>Nombres</Label><Input {...form.register(`contactoEmergencia.${i}.nombres`)} /></Field>
                    <Field><Label>Apellidos</Label><Input {...form.register(`contactoEmergencia.${i}.apellidos`)} /></Field>
                    <Field><Label>Teléfono</Label><Input {...form.register(`contactoEmergencia.${i}.telefono`)} /></Field>
                    <Field><Label>Relación (id)</Label><Input type="number" {...form.register(`contactoEmergencia.${i}.relacionId`, { valueAsNumber: true })} /></Field>
                    <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeContacto(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
                  </div>
                ))}
                {camposContacto.length === 0 && <p className="text-xs text-muted-foreground">Sin contactos de emergencia.</p>}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Antecedentes de servicio</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => appendAnte({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
              </div>
              <div className="flex flex-col gap-3">
                {camposAnte.map((item, i) => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-4">
                    <Field><Label>Organismo (id)</Label><Input type="number" {...form.register(`antecedentes.${i}.organismoId`, { valueAsNumber: true })} /></Field>
                    <Field><Label>Fecha ingreso</Label><Input type="date" {...form.register(`antecedentes.${i}.fechaIngreso`)} /></Field>
                    <Field><Label>Fecha egreso</Label><Input type="date" {...form.register(`antecedentes.${i}.fechaEgreso`)} /></Field>
                    <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeAnte(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
                  </div>
                ))}
                {camposAnte.length === 0 && <p className="text-xs text-muted-foreground">Sin antecedentes registrados.</p>}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Contrato</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => appendContrato({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
              </div>
              <div className="flex flex-col gap-3">
                {camposContrato.map((item, i) => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-5">
                    <Field><Label>Nº contrato</Label><Input {...form.register(`contrato.${i}.nContrato`)} /></Field>
                    <Field><Label>Fecha ingreso</Label><Input type="date" {...form.register(`contrato.${i}.fechaIngreso`)} /></Field>
                    <Field><Label>Fecha culminación</Label><Input type="date" {...form.register(`contrato.${i}.fechaCulminacion`)} /></Field>
                    <Field><Label>Política</Label><CatalogSelect id={`ctrPol${i}`} value={form.watch(`contrato.${i}.politicaId`) ? String(form.watch(`contrato.${i}.politicaId`)) : undefined} onChange={(v) => form.setValue(`contrato.${i}.politicaId`, v)} options={catalogos?.politicas ?? []} placeholder="Seleccione política" /></Field>
                    <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeContrato(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
                  </div>
                ))}
                {camposContrato.length === 0 && <p className="text-xs text-muted-foreground">Sin contratos registrados.</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPending}>
                <UserPlus className="size-4" aria-hidden="true" /> {editando ? "Actualizar" : "Registrar"}
              </Button>
              {editando && <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Buscar / editar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={busquedaForm.handleSubmit(onBuscar)} className="flex items-end gap-2" noValidate>
            <Field>
              <Label htmlFor="busqueda">Búsqueda</Label>
              <Input id="busqueda" placeholder="Cédula o nombre" {...busquedaForm.register("busqueda")} />
            </Field>
            <Button type="submit" variant="outline" disabled={isPending}><Search className="size-4" aria-hidden="true" /> Buscar</Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cédula</TableHead>
              <TableHead>Nombre completo</TableHead>
              <TableHead>Sexo</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>APN</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : empleados.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">Sin empleados.</TableCell></TableRow>
            ) : (
              empleados.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.cedula}</TableCell>
                  <TableCell>{e.nombreCompleto}</TableCell>
                  <TableCell><Badge variant="secondary">{e.sexoNombre}</Badge></TableCell>
                  <TableCell>{e.correo ?? "—"}</TableCell>
                  <TableCell>{e.totalAnosApn}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {puedeVerDetalle && (
                        <Button variant="ghost" size="sm" onClick={() => onVerDetalle(e.cedula)} disabled={isPending}><Eye className="size-4" aria-hidden="true" /></Button>
                      )}
                      {puedeEditar && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => onBuscarParaEditar(e.cedula)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => onSubirFoto(e.cedula)} disabled={isPending}><Camera className="size-4" aria-hidden="true" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EmpleadoDetalleSheet
        open={detalleAbierto}
        onOpenChange={(open) => {
          setDetalleAbierto(open);
          if (!open) setViendoDetalle(null);
        }}
        detalle={viendoDetalle && catalogos ? construirDetalleExpediente(viendoDetalle, catalogos) : null}
        onExportarPdf={onExportarPdf}
        exportandoPdf={exportandoPdf}
      />
    </section>
  );
}
