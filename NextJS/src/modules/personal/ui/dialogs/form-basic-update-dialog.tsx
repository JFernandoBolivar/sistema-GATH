"use client";

import { useMemo, useState, useTransition } from "react";
import { CapturaFoto } from "@/shared/components/captura-foto/captura-foto";
import {
  ETIQUETA_CODIGO_CARNET_PATRIA,
  ETIQUETA_SERIAL_CARNET_PATRIA,
} from "@/shared/domain/etiquetas-carnet-patria";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
import { CampoTelefono } from "@/shared/ui/components/campo-telefono";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import type { VistaPreviaCorreccionCedula } from "../../domain/entities/correccion-cedula";
import {
  ejecutarCorreccionCedulaAction,
  verificarCorreccionCedulaAction,
} from "../../infrastructure/actions/correccion-cedula-actions";
import {
  actualizarEmpleadoAction,
  subirFotoEmpleadoAction,
} from "../../infrastructure/actions/personal-actions";
import { CORREO_MAX, NOMBRE_MAX } from "../schema/reglas-personas";
import { empleadoBasicoFormSchema } from "../schema/schema-empleado";
import { solicitudCedulaSchema } from "../schema/schema-correccion-cedula";
import { CampoDialogo, avisoDeFallo, mensajeDe } from "./campo-dialogo";
import { DialogoCorreccionCedula } from "./dialogo-correccion-cedula";

interface FormBasicUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
  /** Con el permiso `personal.corregir_cedula` la cédula se vuelve editable. */
  puedeCorregirCedula?: boolean;
  /** Se llama con la cédula nueva tras corregirla, para que el padre siga al trabajador. */
  onCedulaCorregida?: (cedulaNueva: string) => void;
}

function esFallo(r: unknown): r is { error: string; status?: number } {
  return typeof r === "object" && r !== null && "error" in r;
}

export default function FormBasicUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar Información Basica",
  puedeCorregirCedula = false,
  onCedulaCorregida,
}: FormBasicUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const carnetOriginal = empleado.carnetPatria ?? "";
  const schema = useMemo(() => empleadoBasicoFormSchema(carnetOriginal), [carnetOriginal]);
  type Entrada = z.input<typeof schema>;
  type Salida = z.output<typeof schema>;

  const form = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombres: empleado.nombres,
      apellidos: empleado.apellidos,
      fechaNacimiento: empleado.fechaNacimiento ?? "",
      sexoId: empleado.sexoId,
      correo: empleado.correo ?? "",
      correoAlternativo: empleado.correoAlternativo ?? "",
      telefonoMovil: empleado.telefonoMovil ?? "",
      telefonoHabitacion: empleado.telefonoHabitacion ?? "",
      carnetPatria: carnetOriginal,
      carnetPatriaSerial: empleado.carnetPatriaSerial ?? "",
      estadoCivilId: empleado.estadoCivilId ?? undefined,
      nacionalidadId: empleado.nacionalidadId ?? undefined,
    },
  });
  const { register, handleSubmit, setValue, watch } = form;
  const errores = form.formState.errors;

  const [cedulaEditada, setCedulaEditada] = useState(empleado.cedula);
  const [errorCedula, setErrorCedula] = useState<string | null>(null);
  const [previaCedula, setPreviaCedula] = useState<VistaPreviaCorreccionCedula | null>(null);
  const [datosPendientes, setDatosPendientes] = useState<Salida | null>(null);
  const [ejecutandoCedula, setEjecutandoCedula] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);

  const cedulaCambiada = puedeCorregirCedula && cedulaEditada.trim() !== empleado.cedula;

  const onSubmit = (data: Salida) => {
    if (cedulaCambiada) {
      void verificarCedula(data);
      return;
    }
    guardar(data, empleado.cedula);
  };

  /** Paso previo: la vista previa decide si se puede corregir y qué afecta. */
  const verificarCedula = async (data: Salida) => {
    setError(null);
    setErrorCedula(null);
    const valida = solicitudCedulaSchema.safeParse({
      cedulaActual: empleado.cedula,
      cedulaNueva: cedulaEditada,
    });
    if (!valida.success) {
      setErrorCedula(valida.error.issues[0]?.message ?? "Cédula no válida.");
      return;
    }
    setEjecutandoCedula(true);
    try {
      const r = await verificarCorreccionCedulaAction(valida.data);
      if (esFallo(r)) {
        setErrorCedula(r.error);
        return;
      }
      setDatosPendientes(data);
      setErrorConfirmacion(null);
      setPreviaCedula(r as VistaPreviaCorreccionCedula);
    } catch {
      setErrorCedula("No fue posible verificar la cédula. Intente de nuevo.");
    } finally {
      setEjecutandoCedula(false);
    }
  };

  /** Corrige la cédula y, solo si salió bien, guarda lo demás con la cédula nueva. */
  const confirmarCedula = async (motivo: string, confirmacion: string) => {
    if (!previaCedula || !datosPendientes) return;
    setEjecutandoCedula(true);
    setErrorConfirmacion(null);
    try {
      const r = await ejecutarCorreccionCedulaAction({
        cedulaActual: empleado.cedula,
        cedulaNueva: previaCedula.cedulaNueva,
        motivo,
        confirmacion,
      });
      if (esFallo(r)) {
        setErrorConfirmacion(r.error);
        return;
      }
    } catch {
      setErrorConfirmacion("No fue posible corregir la cédula. Intente de nuevo.");
      return;
    } finally {
      setEjecutandoCedula(false);
    }
    const nueva = previaCedula.cedulaNueva;
    const datos = datosPendientes;
    setPreviaCedula(null);
    setDatosPendientes(null);
    toast.success(`Cédula corregida a ${nueva}`);
    guardar(datos, nueva, true);
  };

  const guardar = (data: Salida, cedula: string, corregida = false) => {
    startTransition(async () => {
      setError(null);
      try {
        const correoAlternativo = data.correoAlternativo.trim();
        const payload = {
          nombres: data.nombres,
          apellidos: data.apellidos,
          fechaNacimiento: data.fechaNacimiento || undefined,
          sexoId: Number(data.sexoId),
          correo: data.correo || null,
          // "" borra el correo alternativo; solo se envía si cambió.
          ...(correoAlternativo !== (empleado.correoAlternativo ?? "")
            ? { correoAlternativo }
            : {}),
          telefonoMovil: data.telefonoMovil || null,
          telefonoHabitacion: data.telefonoHabitacion || null,
          // El código del carnet solo viaja si cambió (el del legado puede no cumplir el formato nuevo).
          ...(data.carnetPatria !== carnetOriginal
            ? { carnetPatria: data.carnetPatria || null }
            : {}),
          carnetPatriaSerial: data.carnetPatriaSerial || null,
          estadoCivilId: data.estadoCivilId ? Number(data.estadoCivilId) : null,
          ...(data.nacionalidadId ? { nacionalidadId: Number(data.nacionalidadId) } : {}),
        };

        const result = await actualizarEmpleadoAction(cedula, payload);
        if (result && typeof result === "object" && "error" in result) {
          const fallo = result as { error: string; errores?: Record<string, string[]> };
          const sinUbicar = aplicarErroresServidor(form, fallo.errores);
          setError(avisoDeFallo(fallo, sinUbicar));
          toast.error(fallo.error);
          if (corregida) onCedulaCorregida?.(cedula);
          return;
        }

        let avisoFoto: string | null = null;
        if (selectedFile) {
          const formData = new FormData();
          formData.append("file", selectedFile);
          const foto = await subirFotoEmpleadoAction(cedula, formData);
          if (foto && typeof foto === "object" && "error" in foto) {
            const falloFoto = foto as { error: string; errores?: Record<string, string[]> };
            avisoFoto = falloFoto.errores?.file?.[0] ?? falloFoto.error;
          }
        }

        if (avisoFoto) {
          toast.error(`Los datos se guardaron, pero la foto no se pudo subir: ${avisoFoto}`);
        } else {
          toast.success("Información básica actualizada exitosamente");
        }
        setOpen(false);
        if (corregida && onCedulaCorregida) onCedulaCorregida(cedula);
        else onGuardado();
      } catch {
        const msg = "Error al actualizar la información básica.";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl p-0">
        <DialogTitle className="sr-only">Actualizar Información Básica</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-xl">Actualizar Información Básica</CardTitle>
            <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
              <span className="font-semibold text-foreground">
                {empleado.nombres} {empleado.apellidos}
              </span>
              {!puedeCorregirCedula && (
                <span className="text-muted-foreground/60" aria-hidden="true">
                  ·
                </span>
              )}
              {!puedeCorregirCedula && (
                <span className="font-mono bg-muted text-foreground px-2 py-0.5 rounded text-xs">
                  Cédula {empleado.cedula}
                </span>
              )}
            </p>
          </CardHeader>

          <CardContent className="pt-4">
            {error && (
              <p role="alert" className="text-sm text-destructive mb-3">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="gap-6">
                <div className="border rounded-lg p-4 gap-3">
                  <CapturaFoto
                    etiqueta="Foto del Trabajador"
                    nombreArchivo="foto-trabajador.jpg"
                    disabled={isPending}
                    onChange={(foto) => setSelectedFile(foto)}
                  />
                </div>

                <div className="mt-6 flex flex-col gap-8">
                  <section className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Datos personales
                    </h3>
                    {puedeCorregirCedula && (
                      <CampoDialogo
                        id="cedula-editable"
                        label="Cédula"
                        error={errorCedula ?? undefined}
                      >
                        <Input
                          id="cedula-editable"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={9}
                          value={cedulaEditada}
                          aria-invalid={!!errorCedula || undefined}
                          onChange={(e) => {
                            setCedulaEditada(e.target.value);
                            setErrorCedula(null);
                          }}
                        />
                        {cedulaCambiada && !errorCedula && (
                          <p className="text-xs text-muted-foreground">
                            Al guardar se corregirá la cédula del trabajador (se pedirá
                            confirmación).
                          </p>
                        )}
                      </CampoDialogo>
                    )}
                    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                      <CampoDialogo
                        id="nombres"
                        label="Nombres *"
                        error={mensajeDe(errores.nombres)}
                      >
                        <Input
                          id="nombres"
                          placeholder="Juan Bernardo"
                          maxLength={NOMBRE_MAX}
                          aria-invalid={!!errores.nombres || undefined}
                          {...register("nombres")}
                        />
                      </CampoDialogo>
                      <CampoDialogo
                        id="apellidos"
                        label="Apellidos *"
                        error={mensajeDe(errores.apellidos)}
                      >
                        <Input
                          id="apellidos"
                          placeholder="Perez Gutierrez"
                          maxLength={NOMBRE_MAX}
                          aria-invalid={!!errores.apellidos || undefined}
                          {...register("apellidos")}
                        />
                      </CampoDialogo>
                      <CampoDialogo
                        id="fechaNacimiento"
                        label="Fecha de Nacimiento *"
                        error={mensajeDe(errores.fechaNacimiento)}
                      >
                        <Input
                          id="fechaNacimiento"
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          min="1900-01-01"
                          aria-invalid={!!errores.fechaNacimiento || undefined}
                          {...register("fechaNacimiento")}
                        />
                      </CampoDialogo>
                      <CampoDialogo
                        id="nacionalidadId"
                        label="Nacionalidad *"
                        error={mensajeDe(errores.nacionalidadId)}
                      >
                        <Select
                          value={watch("nacionalidadId") ? String(watch("nacionalidadId")) : ""}
                          onValueChange={(v) =>
                            setValue("nacionalidadId", Number(v), { shouldValidate: true })
                          }
                        >
                          <SelectTrigger
                            id="nacionalidadId"
                            className="w-full truncate"
                            aria-invalid={!!errores.nacionalidadId || undefined}
                          >
                            <SelectValue placeholder="V / E" />
                          </SelectTrigger>
                          <SelectContent>
                            {(catalogos?.nacionalidades ?? []).map((n) => (
                              <SelectItem key={n.id} value={String(n.id)}>
                                {n.codigo ? `${n.codigo} - ${n.nombre}` : n.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CampoDialogo>
                      <CampoDialogo id="sexoId" label="Sexo *" error={mensajeDe(errores.sexoId)}>
                        <Select
                          value={String(watch("sexoId") || "")}
                          onValueChange={(v) =>
                            setValue("sexoId", Number(v), { shouldValidate: true })
                          }
                        >
                          <SelectTrigger
                            id="sexoId"
                            className="w-full truncate"
                            aria-invalid={!!errores.sexoId || undefined}
                          >
                            <SelectValue placeholder="Seleccione un Genero" />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              catalogos?.sexos ?? [
                                { id: 1, nombre: "MASCULINO" },
                                { id: 2, nombre: "FEMENINO" },
                              ]
                            ).map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CampoDialogo>
                      <CampoDialogo
                        id="estadoCivilId"
                        label="Estado Civil *"
                        error={mensajeDe(errores.estadoCivilId)}
                      >
                        <Select
                          value={
                            watch("estadoCivilId") ? String(watch("estadoCivilId")) : undefined
                          }
                          onValueChange={(v) =>
                            setValue("estadoCivilId", Number(v), { shouldValidate: true })
                          }
                        >
                          <SelectTrigger id="estadoCivilId" className="w-full truncate">
                            <SelectValue placeholder="Seleccione Un Estado Civil" />
                          </SelectTrigger>
                          <SelectContent>
                            {(catalogos?.estadosCiviles ?? []).map((ec) => (
                              <SelectItem key={ec.id} value={String(ec.id)}>
                                {ec.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CampoDialogo>
                    </div>
                  </section>
                  <section className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">Contacto</h3>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-5">
                      <CampoDialogo
                        id="correo"
                        label="Correo institucional"
                        error={mensajeDe(errores.correo)}
                      >
                        <Input
                          id="correo"
                          type="email"
                          placeholder="usuario@conatel.gob.ve"
                          maxLength={CORREO_MAX}
                          aria-invalid={!!errores.correo || undefined}
                          {...register("correo")}
                        />
                      </CampoDialogo>
                      <CampoDialogo
                        id="correoAlternativo"
                        label="Correo alternativo"
                        error={mensajeDe(errores.correoAlternativo)}
                      >
                        <Input
                          id="correoAlternativo"
                          type="email"
                          placeholder="ejemplo@gmail.com"
                          maxLength={CORREO_MAX}
                          aria-invalid={!!errores.correoAlternativo || undefined}
                          {...register("correoAlternativo")}
                        />
                      </CampoDialogo>
                      <CampoDialogo
                        id="telefonoMovil"
                        label="Teléfono De Móvil"
                        error={mensajeDe(errores.telefonoMovil)}
                      >
                        <CampoTelefono
                          tipo="movil"
                          id="telefonoMovil"
                          value={watch("telefonoMovil")}
                          invalido={!!errores.telefonoMovil}
                          onChange={(v) => setValue("telefonoMovil", v, { shouldDirty: true })}
                        />
                      </CampoDialogo>
                      <CampoDialogo
                        id="telefonoHabitacion"
                        label="Teléfono De Habitación"
                        error={mensajeDe(errores.telefonoHabitacion)}
                      >
                        <CampoTelefono
                          id="telefonoHabitacion"
                          value={watch("telefonoHabitacion")}
                          invalido={!!errores.telefonoHabitacion}
                          onChange={(v) => setValue("telefonoHabitacion", v, { shouldDirty: true })}
                        />
                      </CampoDialogo>
                    </div>
                  </section>
                  <section className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">Documento</h3>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                      <CampoDialogo
                        id="carnetPatria"
                        label={ETIQUETA_CODIGO_CARNET_PATRIA}
                        error={mensajeDe(errores.carnetPatria)}
                      >
                        <Input
                          id="carnetPatria"
                          type="text"
                          inputMode="numeric"
                          placeholder="0000000000"
                          maxLength={30}
                          aria-invalid={!!errores.carnetPatria || undefined}
                          {...register("carnetPatria")}
                        />
                      </CampoDialogo>
                      <CampoDialogo
                        id="carnetPatriaSerial"
                        label={ETIQUETA_SERIAL_CARNET_PATRIA}
                        error={mensajeDe(errores.carnetPatriaSerial)}
                      >
                        <Input
                          id="carnetPatriaSerial"
                          type="text"
                          placeholder="Serial"
                          maxLength={30}
                          aria-invalid={!!errores.carnetPatriaSerial || undefined}
                          {...register("carnetPatriaSerial")}
                        />
                      </CampoDialogo>
                    </div>
                  </section>
                </div>

                <div className="flex gap-3 justify-end pt-8">
                  <Button className="w-full" disabled={isPending || ejecutandoCedula}>
                    {(isPending || ejecutandoCedula) && (
                      <Loader2 className="size-4 animate-spin mr-1" />
                    )}
                    Guardar
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
      <DialogoCorreccionCedula
        key={previaCedula?.cedulaNueva ?? "cerrado"}
        vistaPrevia={previaCedula}
        ejecutando={ejecutandoCedula}
        error={errorConfirmacion}
        onCancelar={() => {
          setPreviaCedula(null);
          setDatosPendientes(null);
        }}
        onConfirmar={confirmarCedula}
      />
    </Dialog>
  );
}
