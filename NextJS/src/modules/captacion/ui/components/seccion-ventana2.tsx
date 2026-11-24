import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { DetalleExpediente } from "../../domain/expediente";
import { ventana2Legible } from "../../domain/ventana2-legible";

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const vacio = valor === "No informado";
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      <dd className={vacio ? "italic text-muted-foreground" : "break-words font-medium"}>{valor}</dd>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="mb-3 text-lg font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

const Rejilla = ({ filas }: { filas: { etiqueta: string; valor: string }[] }) => (
  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{filas.map((f) => <Fila key={f.etiqueta} {...f} />)}</dl>
);

/** Datos de la Ventana 2 en lenguaje legible (ids ya traducidos a nombre por el backend) y lo que aún falta. */
export function SeccionVentana2({ detalle }: { detalle: DetalleExpediente }) {
  const v = ventana2Legible(detalle.datosVentana2Legible);
  const faltantes = detalle.ventana2Faltantes ?? [];
  if (v.vacia) {
    return (
      <section className="rounded-xl border border-dashed bg-card p-6 text-center text-muted-foreground">
        El postulante todavía no ha llenado la Ventana 2.
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {faltantes.length > 0 ? (
        <section className="rounded-xl border border-warning/40 bg-warning-soft p-4" data-testid="ventana2-faltantes">
          <h3 className="flex items-center gap-2 font-semibold"><AlertCircle className="size-5" aria-hidden /> Falta {faltantes.length} {faltantes.length === 1 ? "dato" : "datos"}</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">{faltantes.map((f) => <li key={`${f.campo}-${f.mensaje}`}>{f.mensaje}</li>)}</ul>
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-xl border border-success/40 bg-success-soft p-3 text-sm font-medium text-success"><CheckCircle2 className="size-5" aria-hidden /> La Ventana 2 está completa.</p>
      )}
      <Bloque titulo="Familiares">
        {v.sinFamiliares ? (
          <p>El postulante declaró que no tiene carga familiar.</p>
        ) : v.familiares.length === 0 ? (
          <p className="italic text-muted-foreground">No informado</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {v.familiares.map((f, i) => (
              <li key={i} className="rounded-lg border p-3">
                <p className="mb-2 font-semibold">{f.titulo}</p>
                <Rejilla filas={f.filas} />
              </li>
            ))}
          </ul>
        )}
      </Bloque>
      <Bloque titulo="Vivienda">{v.vivienda.length ? <Rejilla filas={v.vivienda} /> : <p className="italic text-muted-foreground">No informado</p>}</Bloque>
      <Bloque titulo="Salud">{v.salud.length ? <Rejilla filas={v.salud} /> : <p className="italic text-muted-foreground">No informado</p>}</Bloque>
      <Bloque titulo="Tallas">{v.tallas.length ? <Rejilla filas={v.tallas} /> : <p className="italic text-muted-foreground">No informado</p>}</Bloque>
    </div>
  );
}
