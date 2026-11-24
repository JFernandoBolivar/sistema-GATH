"use client";

import { useState, useTransition } from "react";
/* eslint-disable @next/next/no-img-element */
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Pencil, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { FaltanteDTO } from "../../application/dtos/postulacion-dto";
import { resumirVentana2 } from "../../domain/ventana2-resumen";
import { seccionDeFaltante, type CatalogosVentana2, type SeccionVentana2 } from "../../domain/ventana2";
import { enviarVentana2Action } from "../../infrastructure/actions/postulacion-actions";

interface Props {
  datos: Record<string, unknown>;
  catalogos: CatalogosVentana2;
  faltantes: FaltanteDTO[];
  tieneFoto: boolean;
  fotoVersion: string;
  onIrA: (s: SeccionVentana2, desdeFaltante?: boolean) => void;
  onAnterior: () => void;
  onFaltantes: (f: FaltanteDTO[]) => void;
  onSesionCaida: () => void;
}

function Bloque({ titulo, seccion, onIrA, children }: { titulo: string; seccion: SeccionVentana2; onIrA: Props["onIrA"]; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{titulo}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => onIrA(seccion)} aria-label={`Editar ${titulo}`}>
          <Pencil aria-hidden /> Editar
        </Button>
      </div>
      {children}
    </section>
  );
}

const Filas = ({ filas }: { filas: { etiqueta: string; valor: string }[] }) => (
  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
    {filas.map((f) => (
      <div key={f.etiqueta} className="min-w-0">
        <dt className="text-xs text-muted-foreground">{f.etiqueta}</dt>
        <dd className={f.valor ? "break-words text-sm font-medium" : "text-sm italic text-muted-foreground"}>{f.valor || "Sin indicar"}</dd>
      </div>
    ))}
  </dl>
);

const ListaResumen = ({ items, vacio }: { items: { titulo: string; detalle: string }[]; vacio: string }) =>
  items.length === 0 ? (
    <p className="text-sm italic text-muted-foreground">{vacio}</p>
  ) : (
    <ul className="flex flex-col gap-2">
      {items.map((x, i) => (
        <li key={i} className="text-sm">
          <span className="font-medium">{x.titulo}</span>
          {x.detalle && <span className="block text-muted-foreground">{x.detalle}</span>}
        </li>
      ))}
    </ul>
  );

export function SeccionRevisar({ datos, catalogos, faltantes, tieneFoto, fotoVersion, onIrA, onAnterior, onFaltantes, onSesionCaida }: Props) {
  const [hoy] = useState(() => new Date());
  const resumen = resumirVentana2(datos, catalogos, hoy);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, enviar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const completo = faltantes.length === 0;

  function confirmarEnvio() {
    setConfirmar(false);
    setError(null);
    enviar(async () => {
      const r = await enviarVentana2Action();
      if (r && !r.ok) {
        if (r.sesionCaida) return onSesionCaida();
        if (r.faltantes) onFaltantes(r.faltantes);
        setError(r.mensaje);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {completo ? (
        <Alert className="border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <CheckCircle2 aria-hidden />
          <AlertDescription className="text-emerald-900 dark:text-emerald-100">Todo está listo. Revisa el resumen y envía tus datos.</AlertDescription>
        </Alert>
      ) : (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" aria-label="Pendientes" data-testid="lista-faltantes">
          <h3 className="flex items-center gap-2 font-semibold">
            <AlertCircle className="size-5" aria-hidden /> Te falta completar {faltantes.length} {faltantes.length === 1 ? "dato" : "datos"}
          </h3>
          <p className="mb-2 text-sm">Toca un pendiente para ir directo a esa sección.</p>
          <ul className="flex flex-col gap-1.5">
            {faltantes.map((f) => (
              <li key={`${f.campo}-${f.mensaje}`}>
                <button type="button" onClick={() => onIrA(seccionDeFaltante(f), true)} className="min-h-11 w-full rounded-md border border-amber-300/70 bg-background/70 px-3 py-2 text-left text-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {f.mensaje}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Bloque titulo="Familiares" seccion="familiares" onIrA={onIrA}>
        {resumen.sinFamiliares ? (
          <p className="text-sm">Declaraste que no tienes carga familiar.</p>
        ) : resumen.familiares.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Sin indicar</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {resumen.familiares.map((f, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{f.titulo}</span>
                {f.detalle && <span className="block text-muted-foreground">{f.detalle}</span>}
              </li>
            ))}
          </ul>
        )}
      </Bloque>
      <Bloque titulo="Vivienda" seccion="vivienda" onIrA={onIrA}><Filas filas={resumen.vivienda} /></Bloque>
      <Bloque titulo="Salud" seccion="salud" onIrA={onIrA}><Filas filas={resumen.salud} /></Bloque>
      <Bloque titulo="Tallas" seccion="tallas" onIrA={onIrA}><Filas filas={resumen.tallas} /></Bloque>
      <Bloque titulo="Estudios" seccion="estudios" onIrA={onIrA}>
        <ListaResumen items={resumen.estudios} vacio="Sin indicar" />
      </Bloque>
      <Bloque titulo="Cursos" seccion="cursos" onIrA={onIrA}>
        <ListaResumen items={resumen.cursos} vacio={resumen.sinCursos ? "Declaraste que no tienes cursos." : "No registraste cursos."} />
      </Bloque>
      <Bloque titulo="Experiencia en la Administración Pública" seccion="experiencia" onIrA={onIrA}>
        <ListaResumen items={resumen.antecedentes} vacio={resumen.sinAntecedentes ? "Declaraste que no has trabajado en la Administración Pública." : "No registraste experiencia."} />
        {resumen.trabajoAntesEnConatel && <p className="mt-2 text-sm"><span className="text-muted-foreground">¿Trabajaste antes en CONATEL? </span><span className="font-medium">{resumen.trabajoAntesEnConatel}</span></p>}
      </Bloque>
      <Bloque titulo="Idiomas y RIF" seccion="idiomas" onIrA={onIrA}>
        <ListaResumen items={resumen.idiomas} vacio={resumen.sinIdiomas ? "Declaraste que no dominas otros idiomas." : "No registraste idiomas."} />
        <p className="mt-2 text-sm"><span className="text-muted-foreground">RIF: </span><span className={resumen.rif ? "font-medium" : "italic text-muted-foreground"}>{resumen.rif || "No indicado"}</span></p>
      </Bloque>
      <Bloque titulo="Foto de carnet" seccion="foto" onIrA={onIrA}>
        {tieneFoto ? <img src={`/postulacion/foto?v=${encodeURIComponent(fotoVersion)}`} alt="Tu foto de carnet" className="size-28 rounded-lg border object-cover" /> : <p className="text-sm italic text-muted-foreground">Sin foto</p>}
      </Bloque>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border sm:shadow-sm">
        <Button type="button" variant="ghost" size="sm" onClick={onAnterior} disabled={enviando} className="self-start">
          <ArrowLeft aria-hidden /> Anterior
        </Button>
        <Button type="button" size="lg" onClick={() => setConfirmar(true)} disabled={!completo || enviando}>
          {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {enviando ? "Enviando…" : "Enviar mis datos"}
        </Button>
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar tus datos?</AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              Captación hará la revisión final de tu expediente. Al enviarlos, tu sesión se cerrará por seguridad. Si falta algo, te lo harán saber.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Todavía no</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEnvio}>Sí, enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
