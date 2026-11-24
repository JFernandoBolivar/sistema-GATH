"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { cuerpoTallas, tallasDesdeDatos, type CatalogosVentana2, type TallaCatalogo, type ValoresTallas } from "../../domain/ventana2";
import { crearEsquemaTallas } from "../schema/schema-ventana2";
import { CampoSelect } from "./campos";
import { hora, marcarErroresServidor, PieSeccion, TarjetaSeccion, validarEstricto, type GuardarSeccion } from "./comun";

interface Props {
  datos: Record<string, unknown>;
  catalogos: CatalogosVentana2;
  guardar: GuardarSeccion;
  onContinuar: () => void;
  onAnterior?: () => void;
  validarAlEntrar?: boolean;
}

const aOpciones = (l: readonly TallaCatalogo[]) => l.map((t) => ({ valor: String(t.id), texto: `${t.valor}${t.region ? ` (${t.region})` : ""}` }));

export function SeccionTallas({ datos, catalogos, guardar, onContinuar, onAnterior, validarAlEntrar }: Props) {
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardadoA, setGuardadoA] = useState<string | null>(null);
  const flexible = useMemo(() => crearEsquemaTallas({ estricto: false }), []);
  const estricto = useMemo(() => crearEsquemaTallas({ estricto: true }), []);
  const form = useForm<ValoresTallas>({
    resolver: zodResolver(flexible) as unknown as Resolver<ValoresTallas>,
    defaultValues: tallasDesdeDatos(datos),
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
      const r = await guardar({ tallas: cuerpoTallas(valores) });
      if (!r.ok) {
        setError(marcarErroresServidor(form, "tallas", r.errores) ? "Revisa los campos marcados en rojo." : r.mensaje);
        return;
      }
      setGuardadoA(hora(new Date()));
      if (avanzar) onContinuar();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
        <TarjetaSeccion titulo="Tus tallas" descripcion="Para tu dotación de uniforme. Elige la talla con la que te sientes cómodo.">
          <CampoSelect control={form.control} name="tallaCamisaId" etiqueta="Camisa" requerido opciones={aOpciones(catalogos.tallas.camisa)} />
          <CampoSelect control={form.control} name="tallaPantalonId" etiqueta="Pantalón" requerido opciones={aOpciones(catalogos.tallas.pantalon)} />
          <CampoSelect control={form.control} name="tallaZapatosId" etiqueta="Calzado" requerido opciones={aOpciones(catalogos.tallas.calzado)} />
          <CampoSelect control={form.control} name="tallaChaquetaId" etiqueta="Chaqueta" opciones={aOpciones(catalogos.tallas.chaqueta)} ayuda="Opcional." />
        </TarjetaSeccion>
        <PieSeccion onGuardar={() => void guardarSeccion(false)} onGuardarYSeguir={() => void guardarSeccion(true)} onAnterior={onAnterior} guardando={guardando} guardadoA={guardadoA} error={error} />
      </form>
    </Form>
  );
}
