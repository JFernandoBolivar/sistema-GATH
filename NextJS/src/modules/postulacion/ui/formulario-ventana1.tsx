"use client";

/**
 * Formulario de la Ventana 1 (datos básicos) con guardado de borrador y envío a Captación.
 * Para guardar solo hacen falta nombres y apellidos; para enviar, además fecha de nacimiento y sexo.
 */
import { useRef, useState, useTransition } from "react";
import { useForm, type Path, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Save, Send } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampoTelefono } from "@/shared/ui/components/campo-telefono";
import { RUTA_ACCESO_POSTULANTE } from "../domain/acceso-ruta";
import {
  camposFaltantesParaEnviar,
  CAMPO_FORMULARIO_POR_CLAVE,
  LIMITES_VENTANA1,
  OPCIONES_ESTADO_CIVIL,
  type ValoresVentana1,
} from "../domain/ventana1";
import {
  enviarACaptacionAction,
  guardarBorradorAction,
} from "../infrastructure/actions/postulacion-actions";
import { OpcionesRadio } from "./opciones-radio";
import { esquemaVentana1 } from "./schema/schema-ventana1";

const CAMPO_DE_FALTANTE: Record<string, Path<ValoresVentana1>> = {
  nombres: "nombres",
  apellidos: "apellidos",
  fecha_nacimiento: "fechaNacimiento",
  sexo: "sexo",
};

const ASTERISCO = (
  <span className="text-destructive" aria-hidden>
    {" "}
    *
  </span>
);

function hora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Caracas",
  }).format(fecha);
}

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <legend className="px-1 text-lg font-semibold">{titulo}</legend>
      {descripcion && <p className="-mt-1 mb-4 text-sm text-muted-foreground text-pretty">{descripcion}</p>}
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function FormularioVentana1({ inicial }: { inicial: ValoresVentana1 }) {
  const [guardando, guardar] = useTransition();
  const [enviando, enviar] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoA, setGuardadoA] = useState<string | null>(null);
  const hoy = useRef(new Date().toISOString().slice(0, 10)).current;

  const form = useForm<ValoresVentana1>({
    resolver: zodResolver(esquemaVentana1) as unknown as Resolver<ValoresVentana1>,
    defaultValues: inicial,
    // Se valida al escribir: un error se borra en cuanto el dato se completa. Con «onTouched» el
    // mensaje desaparecía al perder el foco, justo al tocar el siguiente campo, y la página se movía
    // bajo el dedo (en el teléfono el toque caía fuera del radio de «Sexo»).
    mode: "onChange",
  });

  function aplicarErrores(errores: Record<string, string[]> | undefined): boolean {
    let primero = true;
    let alguno = false;
    for (const [clave, mensajes] of Object.entries(errores ?? {})) {
      const campo = (CAMPO_FORMULARIO_POR_CLAVE[clave] ?? clave) as Path<ValoresVentana1>;
      if (!(campo in form.getValues()) && !campo.includes(".")) continue;
      form.setError(campo, { message: mensajes[0] }, { shouldFocus: primero });
      primero = false;
      alguno = true;
    }
    return alguno;
  }

  function resultadoConError(r: { mensaje: string; errores?: Record<string, string[]>; sesionCaida?: boolean }) {
    if (r.sesionCaida) {
      window.location.href = `${RUTA_ACCESO_POSTULANTE}?motivo=sesion`;
      return;
    }
    if (!aplicarErrores(r.errores)) setError(r.mensaje);
    else setError("Revisa los campos marcados en rojo.");
  }

  function guardarBorrador() {
    setError(null);
    void form.handleSubmit((valores) => {
      guardar(async () => {
        const r = await guardarBorradorAction(valores);
        if (!r.ok) return resultadoConError(r);
        setGuardadoA(hora(new Date()));
      });
    }, () => setError("Revisa los campos marcados en rojo."))();
  }

  async function pedirEnvio() {
    setError(null);
    const valido = await form.trigger();
    const faltan = camposFaltantesParaEnviar(form.getValues());
    faltan.forEach((c, i) =>
      form.setError(
        CAMPO_DE_FALTANTE[c],
        { message: c === "sexo" ? "Elige una opción para poder enviar." : "Este dato es obligatorio para enviar." },
        { shouldFocus: i === 0 },
      ),
    );
    if (!valido || faltan.length > 0) {
      setError("Antes de enviar completa los datos marcados con asterisco (*).");
      return;
    }
    setConfirmar(true);
  }

  function confirmarEnvio() {
    setConfirmar(false);
    enviar(async () => {
      // En éxito la acción redirige a la pantalla de «Recibido»; solo regresa si algo falló.
      const r = await enviarACaptacionAction(form.getValues());
      if (r && !r.ok) resultadoConError(r);
    });
  }

  const ocupado = guardando || enviando;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-5" noValidate>
        <p className="text-sm text-muted-foreground">
          Los campos con asterisco (*) son obligatorios para enviar. Puedes guardar tu avance
          en cualquier momento y seguir después.
        </p>

        <Seccion titulo="Tus datos">
          <FormField
            control={form.control}
            name="nombres"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombres{ASTERISCO}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="given-name" maxLength={LIMITES_VENTANA1.nombres} className="h-11 text-base" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="apellidos"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellidos{ASTERISCO}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="family-name" maxLength={LIMITES_VENTANA1.apellidos} className="h-11 text-base" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fechaNacimiento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de nacimiento{ASTERISCO}</FormLabel>
                <FormControl>
                  <Input {...field} type="date" max={hoy} min="1900-01-01" autoComplete="bday" className="h-11 text-base" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sexo"
            render={({ field }) => (
              <FormItem>
                <FormLabel id="etiqueta-sexo">Sexo{ASTERISCO}</FormLabel>
                <FormControl>
                  <OpcionesRadio value={field.value} onChange={field.onChange} etiquetadoPor="etiqueta-sexo" opciones={[["F", "Femenino"], ["M", "Masculino"]]} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nacionalidad"
            render={({ field }) => (
              <FormItem>
                <FormLabel id="etiqueta-nacionalidad">Nacionalidad</FormLabel>
                <FormControl>
                  <OpcionesRadio value={field.value} onChange={field.onChange} etiquetadoPor="etiqueta-nacionalidad" opciones={[["V", "Venezolana"], ["E", "Extranjera"]]} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="estadoCivil"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado civil</FormLabel>
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-11 w-full text-base">
                      <SelectValue placeholder="Elige una opción" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {OPCIONES_ESTADO_CIVIL.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </Seccion>

        <Seccion titulo="Cómo contactarte" descripcion="Para que Captación pueda comunicarse contigo.">
          <FormField
            control={form.control}
            name="telefonoMovil"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono celular</FormLabel>
                <FormControl>
                  <CampoTelefono
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    tipo="movil"
                    invalido={!!form.formState.errors.telefonoMovil}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefonoAlterno"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Otro teléfono</FormLabel>
                <FormControl>
                  <CampoTelefono
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    tipo="cualquiera"
                    invalido={!!form.formState.errors.telefonoAlterno}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="correo"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Correo electrónico</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={LIMITES_VENTANA1.correo}
                    placeholder="nombre@correo.com"
                    className="h-11 text-base"
                  />
                </FormControl>
                <FormDescription>Opcional. Usa uno que revises con frecuencia.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="direccionHabitacion"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Dirección de habitación</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    autoComplete="street-address"
                    maxLength={LIMITES_VENTANA1.direccion}
                    className="text-base"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Seccion>

        <Seccion
          titulo="En caso de emergencia"
          descripcion="Una persona de confianza a quien podamos llamar si hace falta. Es opcional."
        >
          <FormField
            control={form.control}
            name="contactoEmergencia.nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre completo</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={LIMITES_VENTANA1.contactoNombre} className="h-11 text-base" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactoEmergencia.parentesco"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parentesco</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={LIMITES_VENTANA1.contactoParentesco}
                    placeholder="Ej. Madre, hermano, amiga"
                    className="h-11 text-base"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactoEmergencia.telefono"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <CampoTelefono
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    tipo="cualquiera"
                    invalido={!!form.formState.errors.contactoEmergencia?.telefono}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Seccion>

        {error && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-xl sm:border sm:shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-h-5 text-sm text-muted-foreground" role="status" aria-live="polite">
              {guardadoA && (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Avance guardado a las {guardadoA}
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Button type="button" variant="outline" size="lg" onClick={guardarBorrador} disabled={ocupado}>
                <Save aria-hidden />
                {guardando ? "Guardando…" : "Guardar avance"}
              </Button>
              <Button type="button" size="lg" onClick={() => void pedirEnvio()} disabled={ocupado}>
                <Send aria-hidden />
                {enviando ? "Enviando…" : "Enviar a Captación"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar tu información a Captación?</AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              Revisa que tus datos estén correctos. Al enviarlos, tu sesión se cerrará por seguridad y Captación te
              contactará. Si necesitan algo más, te lo harán saber.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Todavía no</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEnvio}>Sí, enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
