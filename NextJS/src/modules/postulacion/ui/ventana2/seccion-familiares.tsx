"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch, type Control, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Plus, Trash2, UsersRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  cuerpoFamiliares,
  FAMILIAR_VACIO,
  familiaresDesdeDatos,
  LIMITES_VENTANA2,
  MAX_FAMILIARES,
  parentescoAdmiteSinCedula,
  reglaCedulaFamiliar,
  type CatalogosVentana2,
  type ValoresFamiliares,
} from "../../domain/ventana2";
import { crearEsquemaFamiliares } from "../schema/schema-ventana2";
import { CampoOpciones, CampoSelect, CampoTexto } from "./campos";
import { hora, marcarErroresServidor, PieSeccion, validarEstricto, type GuardarSeccion } from "./comun";

interface Props {
  datos: Record<string, unknown>;
  catalogos: CatalogosVentana2;
  guardar: GuardarSeccion;
  onContinuar: () => void;
  onAnterior?: () => void;
  validarAlEntrar?: boolean;
}

function TarjetaFamiliar({
  indice,
  control,
  catalogos,
  hoy,
  onQuitar,
}: {
  indice: number;
  control: Control<ValoresFamiliares>;
  catalogos: CatalogosVentana2;
  hoy: Date;
  onQuitar: () => void;
}) {
  const f = useWatch({ control, name: `familiares.${indice}` });
  const parentesco = catalogos.parentescos.find((p) => String(p.id) === f?.parentescoId);
  const regla = reglaCedulaFamiliar(parentesco, f?.fechaNacimiento ?? "", hoy);
  const sinCedula = !(f?.cedula ?? "").trim();
  const mostrarOrden = regla.requiereOrden && sinCedula;
  const hoyIso = hoy.toISOString().slice(0, 10);
  const titulo = [f?.primerNombre, f?.primerApellido].filter(Boolean).join(" ");

  let ayudaCedula: string;
  if (parentescoAdmiteSinCedula(parentesco)) {
    ayudaCedula = `Los hijos menores de ${regla.edadLimite} años pueden no tener cédula: déjala vacía e indica el orden de nacimiento.`;
  } else if (parentesco) {
    ayudaCedula = "Obligatoria para este parentesco.";
  } else {
    ayudaCedula = "Elige primero el parentesco para saber si es obligatoria.";
  }

  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm sm:p-5" data-testid="tarjeta-familiar">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-base font-semibold">
          Familiar {indice + 1}
          {titulo && <span className="font-normal text-muted-foreground"> · {titulo}</span>}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onQuitar} aria-label={`Quitar al familiar ${indice + 1}`} className="text-destructive">
          <Trash2 aria-hidden /> Quitar
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto control={control} name={`familiares.${indice}.primerNombre`} etiqueta="Primer nombre" requerido maxLength={LIMITES_VENTANA2.nombre} autoComplete="off" />
        <CampoTexto control={control} name={`familiares.${indice}.segundoNombre`} etiqueta="Segundo nombre" maxLength={LIMITES_VENTANA2.nombre} autoComplete="off" />
        <CampoTexto control={control} name={`familiares.${indice}.primerApellido`} etiqueta="Primer apellido" requerido maxLength={LIMITES_VENTANA2.nombre} autoComplete="off" />
        <CampoTexto control={control} name={`familiares.${indice}.segundoApellido`} etiqueta="Segundo apellido" maxLength={LIMITES_VENTANA2.nombre} autoComplete="off" />
        <CampoSelect
          control={control}
          name={`familiares.${indice}.parentescoId`}
          etiqueta="Parentesco"
          requerido
          opciones={catalogos.parentescos.map((p) => ({ valor: String(p.id), texto: p.nombre }))}
        />
        <CampoTexto control={control} name={`familiares.${indice}.fechaNacimiento`} etiqueta="Fecha de nacimiento" requerido type="date" max={hoyIso} min="1900-01-01" />
        <CampoOpciones
          control={control}
          name={`familiares.${indice}.sexoId`}
          etiqueta="Sexo"
          requerido
          idEtiqueta={`etiqueta-sexo-familiar-${indice}`}
          opciones={catalogos.sexos.map((s) => [String(s.id), s.nombre] as const)}
        />
        <CampoOpciones
          control={control}
          name={`familiares.${indice}.dependeEconomicamente`}
          etiqueta="¿Depende económicamente de ti?"
          requerido
          idEtiqueta={`etiqueta-depende-familiar-${indice}`}
          opciones={[["si", "Sí"], ["no", "No"]]}
        />
        <CampoTexto
          control={control}
          name={`familiares.${indice}.cedula`}
          etiqueta="Cédula"
          maxLength={LIMITES_VENTANA2.cedula}
          autoCapitalize="characters"
          autoComplete="off"
          ayuda={ayudaCedula}
          className={mostrarOrden ? undefined : "sm:col-span-2"}
        />
        {mostrarOrden && (
          <CampoTexto
            control={control}
            name={`familiares.${indice}.ordenHijo`}
            etiqueta="Orden de nacimiento"
            requerido
            inputMode="numeric"
            maxLength={2}
            placeholder="Ej. 1"
            ayuda="1 si es tu hijo mayor, 2 si es el siguiente, y así."
          />
        )}
      </div>
    </li>
  );
}

export function SeccionFamiliares({ datos, catalogos, guardar, onContinuar, onAnterior, validarAlEntrar }: Props) {
  const [hoy] = useState(() => new Date());
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardadoA, setGuardadoA] = useState<string | null>(null);
  const flexible = useMemo(() => crearEsquemaFamiliares(catalogos.parentescos, { estricto: false, hoy }), [catalogos.parentescos, hoy]);
  const estricto = useMemo(() => crearEsquemaFamiliares(catalogos.parentescos, { estricto: true, hoy }), [catalogos.parentescos, hoy]);

  const form = useForm<ValoresFamiliares>({
    resolver: zodResolver(flexible) as unknown as Resolver<ValoresFamiliares>,
    defaultValues: familiaresDesdeDatos(datos),
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "familiares" });
  const sinFamiliares = useWatch({ control: form.control, name: "sinFamiliares" });
  const errores = form.formState.errors;

  useEffect(() => {
    if (validarAlEntrar) validarEstricto(form, estricto);
    // Solo al llegar desde la lista de pendientes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const r = await guardar(cuerpoFamiliares(valores));
      if (!r.ok) {
        setError(marcarErroresServidor(form, "familiares", r.errores) ? "Revisa los campos marcados en rojo." : r.mensaje);
        return;
      }
      setGuardadoA(hora(new Date()));
      if (avanzar) onContinuar();
    });
  }

  const mensajeLista = errores.familiares?.message ?? errores.familiares?.root?.message;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UsersRound className="size-5 text-primary" aria-hidden /> Tu grupo familiar
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Registra a las personas que dependen de ti o que forman parte de tu carga familiar (hasta {MAX_FAMILIARES}). Si no tienes, marca la casilla.
          </p>
          <div className="mt-4 flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
            <Checkbox
              id="sin-familiares"
              checked={sinFamiliares}
              disabled={fields.length > 0}
              onCheckedChange={(v) => {
                form.setValue("sinFamiliares", v === true, { shouldDirty: true, shouldValidate: true });
                form.clearErrors("familiares");
              }}
              className="mt-0.5 size-5"
            />
            <div className="min-w-0">
              <Label htmlFor="sin-familiares" className="cursor-pointer text-base font-medium">
                No tengo carga familiar
              </Label>
              {fields.length > 0 && <p className="text-sm text-muted-foreground">Quita a los familiares de la lista para marcar esta opción.</p>}
            </div>
          </div>
          {errores.sinFamiliares?.message && <p className="mt-2 text-sm text-destructive">{errores.sinFamiliares.message}</p>}
        </section>

        {!sinFamiliares && (
          <>
            {fields.length === 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
                <p className="text-pretty">Todavía no has agregado familiares. Usa el botón «Agregar familiar» o marca «No tengo carga familiar».</p>
              </div>
            )}
            <ul className="flex flex-col gap-4" aria-label="Familiares">
              {fields.map((campo, i) => (
                <TarjetaFamiliar key={campo.id} indice={i} control={form.control} catalogos={catalogos} hoy={hoy} onQuitar={() => remove(i)} />
              ))}
            </ul>
            {mensajeLista && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {mensajeLista}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto sm:self-start"
              disabled={fields.length >= MAX_FAMILIARES}
              onClick={() => {
                form.clearErrors("familiares");
                append({ ...FAMILIAR_VACIO });
              }}
            >
              <Plus aria-hidden /> Agregar familiar
            </Button>
          </>
        )}

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
