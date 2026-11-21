import { camposDeVentana1 } from "../../domain/datos-ventana1";
import type { DetalleExpediente } from "../../domain/expediente";
import { formatearFechaHora } from "../../domain/formato";

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const vacio = valor === "No informado" || valor === "—";
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      <dd className={vacio ? "text-base italic text-muted-foreground" : "break-words text-base font-medium"}>{valor}</dd>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="mb-3 text-lg font-semibold">{titulo}</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/** Datos de la Ventana 1 y del expediente, en lenguaje legible. */
export function SeccionDatos({ detalle }: { detalle: DetalleExpediente }) {
  const { postulante, expediente } = detalle;
  const propuesta = expediente.propuesta;
  const hayPropuesta = Boolean(propuesta.cargoTexto || propuesta.oficinaTexto || propuesta.cargoId || propuesta.dependenciaId);
  return (
    <div className="flex flex-col gap-4">
      <Bloque titulo="Postulante">
        <Fila etiqueta="Cédula" valor={postulante.cedula} />
        <Fila etiqueta="Nombres y apellidos" valor={`${postulante.nombres} ${postulante.apellidos}`.trim()} />
        <Fila etiqueta="Correo" valor={postulante.correo || "No informado"} />
        <Fila etiqueta="Teléfono móvil" valor={postulante.telefonoMovil || "No informado"} />
      </Bloque>
      <Bloque titulo="Datos de la Ventana 1">
        {camposDeVentana1(detalle.datosVentana1).map((c) => (
          <Fila key={c.etiqueta} etiqueta={c.etiqueta} valor={c.valor} />
        ))}
      </Bloque>
      <Bloque titulo="Expediente">
        <Fila etiqueta="Apertura" valor={formatearFechaHora(expediente.fechaApertura)} />
        <Fila etiqueta="Vencimiento de la ventana" valor={formatearFechaHora(expediente.venceEl)} />
        {expediente.fechaCierre ? <Fila etiqueta="Cierre" valor={formatearFechaHora(expediente.fechaCierre)} /> : null}
        {expediente.observaciones ? <Fila etiqueta="Observaciones" valor={expediente.observaciones} /> : null}
      </Bloque>
      {hayPropuesta ? (
        <Bloque titulo="Propuesta de cargo y oficina">
          <Fila etiqueta="Cargo propuesto" valor={propuesta.cargoTexto || (propuesta.cargoId ? "Registrado en el catálogo de cargos" : "No informado")} />
          <Fila etiqueta="Oficina propuesta" valor={propuesta.oficinaTexto || (propuesta.dependenciaId ? "Registrada en la estructura organizativa" : "No informado")} />
        </Bloque>
      ) : null}
    </div>
  );
}
