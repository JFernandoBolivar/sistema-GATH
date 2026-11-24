"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { cuerpoSalud, saludDesdeDatos, type CatalogosVentana2, type ValoresSalud } from "../../domain/ventana2";
import { crearEsquemaSalud } from "../schema/schema-ventana2";
import { CampoSelect } from "./campos";
import { ChipsMultiples } from "./chips-multiples";
import { hora, marcarErroresServidor, PieSeccion, TarjetaSeccion, validarEstricto, type GuardarSeccion } from "./comun";

interface Props {
  datos: Record<string, unknown>;
  catalogos: CatalogosVentana2;
  guardar: GuardarSeccion;
  onContinuar: () => void;
  onAnterior?: () => void;
  validarAlEntrar?: boolean;
}

export function SeccionSalud({ datos, catalogos, guardar, onContinuar, onAnterior, validarAlEntrar }: Props) {
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardadoA, setGuardadoA] = useState<string | null>(null);
  const flexible = useMemo(() => crearEsquemaSalud({ estricto: false }), []);
  const estricto = useMemo(() => crearEsquemaSalud({ estricto: true }), []);
  const form = useForm<ValoresSalud>({
    resolver: zodResolver(flexible) as unknown as Resolver<ValoresSalud>,
    defaultValues: saludDesdeDatos(datos),
    mode: "onChange",
  });

  useEffect(() => {
    if (validarAlEntrar) validarEstricto(form, estricto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarSeccion(avanzar: boolean) {
    setError(null);
    if (avanzar && !validarEstricto(form, estricto)) {
      setError("Completa los datos marcados en rojo para continuar.");
      return;
    }
    const valores = form.getValues();
    iniciar(async () => {
      const r = await guardar({ salud: cuerpoSalud(valores) });
      if (!r.ok) {
        setError(marcarErroresServidor(form, "salud", r.errores) ? "Revisa los campos marcados en rojo." : r.mensaje);
        return;
      }
      setGuardadoA(hora(new Date()));
      if (avanzar) onContinuar();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
        <TarjetaSeccion titulo="Tu salud" descripcion="Esta información es confidencial y ayuda a cuidarte en caso de emergencia. Si no aplica, déjala sin marcar.">
          <CampoSelect
            control={form.control}
            name="grupoSanguineoId"
            etiqueta="Grupo sanguíneo"
            requerido
            className="sm:col-span-2"
            opciones={catalogos.gruposSanguineos.map((g) => ({ valor: String(g.id), texto: g.nombre }))}
          />
          <Controller control={form.control} name="alergias" render={({ field }) => <ChipsMultiples etiqueta="Alergias" opciones={catalogos.alergias} value={field.value} onChange={field.onChange} />} />
          <Controller
            control={form.control}
            name="patologiasCronicas"
            render={({ field }) => <ChipsMultiples etiqueta="Enfermedades crónicas" opciones={catalogos.patologiasCronicas} value={field.value} onChange={field.onChange} />}
          />
          <Controller
            control={form.control}
            name="discapacidades"
            render={({ field }) => <ChipsMultiples etiqueta="Discapacidades" opciones={catalogos.discapacidades} value={field.value} onChange={field.onChange} />}
          />
        </TarjetaSeccion>
        <PieSeccion onGuardar={() => void guardarSeccion(false)} onGuardarYSeguir={() => void guardarSeccion(true)} onAnterior={onAnterior} guardando={guardando} guardadoA={guardadoA} error={error} />
      </form>
    </Form>
  );
}
