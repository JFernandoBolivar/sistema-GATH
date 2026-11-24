"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { cuerpoVivienda, LIMITES_VENTANA2, viviendaDesdeDatos, type CatalogosVentana2, type ValoresVivienda } from "../../domain/ventana2";
import { crearEsquemaVivienda } from "../schema/schema-ventana2";
import { CampoSelect, CampoTexto } from "./campos";
import { ASTERISCO, hora, marcarErroresServidor, PieSeccion, TarjetaSeccion, validarEstricto, type GuardarSeccion } from "./comun";

interface Props {
  datos: Record<string, unknown>;
  catalogos: CatalogosVentana2;
  guardar: GuardarSeccion;
  /** Pide al formulario madre los municipios de un estado y las parroquias de un municipio. */
  cargarGeografia: (estadoId?: number, municipioId?: number) => Promise<boolean>;
  onContinuar: () => void;
  onAnterior?: () => void;
  validarAlEntrar?: boolean;
}

const aOpciones = (lista: ReadonlyArray<{ id: number; nombre: string }>) => lista.map((o) => ({ valor: String(o.id), texto: o.nombre }));

export function SeccionVivienda({ datos, catalogos, guardar, cargarGeografia, onContinuar, onAnterior, validarAlEntrar }: Props) {
  const [guardando, iniciar] = useTransition();
  const [cargandoGeo, setCargandoGeo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoA, setGuardadoA] = useState<string | null>(null);
  const flexible = useMemo(() => crearEsquemaVivienda({ estricto: false }), []);
  const estricto = useMemo(() => crearEsquemaVivienda({ estricto: true }), []);

  const form = useForm<ValoresVivienda>({
    resolver: zodResolver(flexible) as unknown as Resolver<ValoresVivienda>,
    defaultValues: viviendaDesdeDatos(datos),
    mode: "onChange",
  });

  useEffect(() => {
    if (validarAlEntrar) validarEstricto(form, estricto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alCambiarEstado(valor: string) {
    form.setValue("municipioId", "");
    form.setValue("parroquiaId", "");
    setCargandoGeo(true);
    const ok = await cargarGeografia(Number(valor), undefined);
    setCargandoGeo(false);
    if (!ok) setError("No pudimos cargar los municipios. Inténtalo de nuevo.");
  }

  async function alCambiarMunicipio(valor: string) {
    form.setValue("parroquiaId", "");
    setCargandoGeo(true);
    const ok = await cargarGeografia(Number(form.getValues("estadoId")), Number(valor));
    setCargandoGeo(false);
    if (!ok) setError("No pudimos cargar las parroquias. Inténtalo de nuevo.");
  }

  async function guardarSeccion(avanzar: boolean) {
    setError(null);
    if (avanzar) {
      if (!validarEstricto(form, estricto)) {
        setError("Completa los datos marcados en rojo para continuar.");
        return;
      }
    } else if (!(await form.trigger())) {
      setError("Revisa los campos marcados en rojo.");
      return;
    }
    const valores = form.getValues();
    iniciar(async () => {
      const r = await guardar({ vivienda: cuerpoVivienda(valores) });
      if (!r.ok) {
        setError(marcarErroresServidor(form, "vivienda", r.errores) ? "Revisa los campos marcados en rojo." : r.mensaje);
        return;
      }
      setGuardadoA(hora(new Date()));
      if (avanzar) onContinuar();
    });
  }

  const estadoElegido = form.watch("estadoId");
  const municipioElegido = form.watch("municipioId");

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
        <TarjetaSeccion titulo="Tu vivienda" descripcion="Dónde vives hoy. Lo usamos para tu ficha de trabajador.">
          <CampoSelect
            control={form.control}
            name="condicionViviendaId"
            etiqueta="Tipo y tenencia de la vivienda"
            requerido
            className="sm:col-span-2"
            opciones={aOpciones(catalogos.condicionesVivienda)}
          />
          <CampoSelect control={form.control} name="estadoId" etiqueta="Estado" requerido opciones={aOpciones(catalogos.estados)} onCambio={(v) => void alCambiarEstado(v)} />
          <CampoSelect
            control={form.control}
            name="municipioId"
            etiqueta="Municipio"
            requerido
            deshabilitado={!estadoElegido || cargandoGeo}
            placeholder={estadoElegido ? "Elige el municipio" : "Elige primero el estado"}
            opciones={aOpciones(catalogos.municipios)}
            onCambio={(v) => void alCambiarMunicipio(v)}
          />
          <CampoSelect
            control={form.control}
            name="parroquiaId"
            etiqueta="Parroquia"
            requerido
            className="sm:col-span-2"
            deshabilitado={!municipioElegido || cargandoGeo}
            placeholder={municipioElegido ? "Elige la parroquia" : "Elige primero el municipio"}
            opciones={aOpciones(catalogos.parroquias)}
          />
          <FormField
            control={form.control}
            name="direccionExacta"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Dirección exacta{ASTERISCO}</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} autoComplete="street-address" maxLength={LIMITES_VENTANA2.direccion} className="text-base" />
                </FormControl>
                <FormDescription>Calle, edificio o casa, punto de referencia.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <CampoTexto control={form.control} name="ciudadRegion" etiqueta="Ciudad o región" maxLength={LIMITES_VENTANA2.ciudad} className="sm:col-span-2" ayuda="Opcional." />
        </TarjetaSeccion>
        <p className="sr-only" aria-live="polite">
          {cargandoGeo ? "Cargando opciones…" : ""}
        </p>
        <PieSeccion
          onGuardar={() => void guardarSeccion(false)}
          onGuardarYSeguir={() => void guardarSeccion(true)}
          onAnterior={onAnterior}
          guardando={guardando}
          guardadoA={guardadoA}
          error={error}
        />
      </form>
    </Form>
  );
}

