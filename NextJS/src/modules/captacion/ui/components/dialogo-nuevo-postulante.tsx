"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CampoTelefono } from "@/shared/ui/components/campo-telefono";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import type { AltaPostulanteResultado, ResultadoAccion } from "../../domain/expediente";
import {
  esquemaNuevoPostulante,
  LIMITES_POSTULANTE,
  VALORES_INICIALES_POSTULANTE,
  type ValoresNuevoPostulante,
} from "../../domain/postulante-schema";
import { ENTREGA_CORREO, ENTREGA_PERSONA, entregaEfectiva, type TipoEntrega } from "../../domain/entrega";
import { PanelCredencial } from "./panel-credencial";
import { SelectorEntrega } from "./selector-entrega";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Se llama al terminar el alta (para refrescar la bandeja). */
  onCreado?: (resultado: AltaPostulanteResultado) => void;
  crear: (datos: {
    cedula: string;
    nombres: string;
    apellidos: string;
    correo?: string;
    telefonoMovil?: string;
    entrega?: TipoEntrega;
  }) => Promise<ResultadoAccion<AltaPostulanteResultado>>;
}

/**
 * «Nuevo postulante»: formulario validado y, al crear, la credencial en un panel destacado que se muestra
 * UNA sola vez. Mientras se ve la credencial el diálogo no se cierra por accidente.
 */
export function DialogoNuevoPostulante({ abierto, onCerrar, onCreado, crear }: Props) {
  const [alta, setAlta] = useState<AltaPostulanteResultado | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [entrega, setEntrega] = useState<TipoEntrega>(ENTREGA_PERSONA);
  const [pendiente, iniciar] = useTransition();

  const form = useForm<ValoresNuevoPostulante>({
    resolver: zodResolver(esquemaNuevoPostulante),
    defaultValues: VALORES_INICIALES_POSTULANTE,
  });
  const correoEscrito = useWatch({ control: form.control, name: "correo" });

  function cerrar() {
    // La credencial se descarta del estado: no hay forma de volver a verla.
    setAlta(null);
    setErrorGeneral(null);
    setEntrega(ENTREGA_PERSONA);
    form.reset(VALORES_INICIALES_POSTULANTE);
    onCerrar();
  }

  function enviar(valores: ValoresNuevoPostulante) {
    setErrorGeneral(null);
    iniciar(async () => {
      const r = await crear({
        cedula: valores.cedula.trim(),
        nombres: valores.nombres.trim(),
        apellidos: valores.apellidos.trim(),
        correo: valores.correo.trim() || undefined,
        telefonoMovil: valores.telefonoMovil?.trim() || undefined,
        entrega: entregaEfectiva(entrega, valores.correo),
      });
      if (!r.ok) {
        const sinUbicar = aplicarErroresServidor(form, r.errores);
        setErrorGeneral(r.errores && sinUbicar.length === 0 ? "Revise los campos marcados en rojo." : r.error);
        return;
      }
      setAlta(r.data);
      onCreado?.(r.data);
    });
  }

  const conCredencial = alta !== null;

  return (
    <Dialog open={abierto} onOpenChange={(a) => (!a && !conCredencial ? cerrar() : undefined)}>
      <DialogContent
        className="sm:max-w-xl"
        showCloseButton={!conCredencial}
        onEscapeKeyDown={(e) => conCredencial && e.preventDefault()}
        onInteractOutside={(e) => conCredencial && e.preventDefault()}
      >
        {alta ? (
          <>
            <DialogHeader>
              <DialogTitle>Postulante creado</DialogTitle>
              <DialogDescription>
                Expediente <strong>{alta.numero}</strong>.{" "}
                {alta.credencial.enlace ? "Le enviamos el enlace para que cree su contraseña." : "Entregue estos datos de acceso al postulante."}
              </DialogDescription>
            </DialogHeader>
            <PanelCredencial credencial={alta.credencial} esReingreso={alta.esReingreso} onEntendido={cerrar} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5" aria-hidden />
                Nuevo postulante
              </DialogTitle>
              <DialogDescription>
                Registre a la persona y elija cómo entregarle el acceso: en persona o con un enlace por correo.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
                <FormField
                  control={form.control}
                  name="cedula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cédula de identidad *</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="numeric" autoComplete="off" maxLength={10} placeholder="Solo números" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="nombres"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombres *</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" maxLength={LIMITES_POSTULANTE.nombres} />
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
                        <FormLabel>Apellidos *</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" maxLength={LIMITES_POSTULANTE.apellidos} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="correo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" autoComplete="off" maxLength={LIMITES_POSTULANTE.correo} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefonoMovil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono móvil (opcional)</FormLabel>
                      <FormControl>
                        <CampoTelefono
                          tipo="movil"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          invalido={Boolean(form.formState.errors.telefonoMovil)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <SelectorEntrega
                  valor={entregaEfectiva(entrega, correoEscrito)}
                  onCambio={setEntrega}
                  correo={correoEscrito}
                  ayudaSinCorreo="Escriba un correo válido arriba para poder enviarle el enlace."
                  disabled={pendiente}
                />
                {errorGeneral ? (
                  <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
                    {errorGeneral}
                  </p>
                ) : null}
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button type="button" variant="outline" onClick={cerrar} disabled={pendiente}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={pendiente}>
                    {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    {entregaEfectiva(entrega, correoEscrito) === ENTREGA_CORREO ? "Crear y enviar enlace" : "Crear postulante"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
