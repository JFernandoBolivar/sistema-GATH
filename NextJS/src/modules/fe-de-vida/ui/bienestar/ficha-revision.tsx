import { FilePlus2, PencilLine, TriangleAlert } from "lucide-react";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import type { DatoRevision, FilaRevision, MarcaCambio, SeccionRevision, TablaRevision } from "./modelo-revision";

/** Insignia del cambio: lleva ícono y texto (nunca solo color). */
function InsigniaCambio({ tipo }: { tipo: "nuevo" | "modificado" }) {
  return tipo === "nuevo" ? (
    <StatusBadge texto="Nuevo" tono="info" icono={FilePlus2} className="px-2 py-0.5 text-xs" />
  ) : (
    <StatusBadge texto="Modificado" tono="warning" icono={PencilLine} className="px-2 py-0.5 text-xs" />
  );
}

function Dato({ dato }: { dato: DatoRevision }) {
  const marca: MarcaCambio | undefined = dato.marca;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm font-medium text-muted-foreground">{dato.etiqueta}</dt>
      <dd className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          {dato.valor ? (
            <span className="break-words text-base font-medium text-foreground">{dato.valor}</span>
          ) : (
            <span className="text-base text-muted-foreground">Sin dato</span>
          )}
          {marca ? <InsigniaCambio tipo={marca.tipo} /> : null}
        </span>
        {marca?.tipo === "modificado" ? (
          <span className="break-words text-sm text-muted-foreground">Antes: {marca.anterior}</span>
        ) : null}
        {dato.conflicto ? (
          <span className="flex items-start gap-1.5 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            La ficha cambió después de esta propuesta.
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function Fila({ fila }: { fila: FilaRevision }) {
  return (
    <tr className="border-t align-top">
      {fila.celdas.map((celda, i) => (
        <td key={i} className="px-3 py-2 text-base">
          {celda ? <span className="break-words">{celda}</span> : <span className="text-muted-foreground">—</span>}
          {i === 0 && fila.marca ? (
            <span className="mt-1 flex flex-col gap-1">
              <InsigniaCambio tipo={fila.marca} />
              {fila.detalles.map((d) => (
                <span key={d} className="break-words text-sm text-muted-foreground">
                  {d}
                </span>
              ))}
            </span>
          ) : null}
        </td>
      ))}
    </tr>
  );
}

function Tabla({ tabla }: { tabla: TablaRevision }) {
  const id = `fv-tabla-${tabla.id}`;
  return (
    <div className="flex flex-col gap-2">
      <h3 id={id} className="text-base font-semibold">
        {tabla.titulo}
      </h3>
      {tabla.filas.length === 0 ? (
        <p className="text-base text-muted-foreground">{tabla.vacio}</p>
      ) : (
        <div
          role="region"
          aria-labelledby={id}
          tabIndex={0}
          className="overflow-x-auto rounded-md border focus-visible:outline-2 focus-visible:outline-ring"
        >
          <table aria-labelledby={id} className="w-full min-w-[32rem] text-left">
            <thead className="bg-muted text-sm text-muted-foreground">
              <tr>
                {tabla.columnas.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((f) => (
                <Fila key={f.id} fila={f} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Secciones de solo lectura de la ficha del pasivo con lo que declara en el acta. */
export function FichaRevision({ secciones }: { secciones: readonly SeccionRevision[] }) {
  return (
    <div className="flex flex-col gap-4">
      {secciones.map((s) => (
        <section
          key={s.id}
          aria-labelledby={`fv-sec-${s.id}`}
          className="flex flex-col gap-4 rounded-lg border bg-card p-4"
        >
          <h2 id={`fv-sec-${s.id}`} className="text-lg font-semibold">
            {s.titulo}
          </h2>
          {s.datos.length > 0 ? (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {s.datos.map((d) => (
                <Dato key={d.clave} dato={d} />
              ))}
            </dl>
          ) : null}
          {s.tablas.map((t) => (
            <Tabla key={t.id} tabla={t} />
          ))}
        </section>
      ))}
    </div>
  );
}
