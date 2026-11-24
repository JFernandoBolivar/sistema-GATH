import type { Puesto } from "../../domain/solicitud";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className={valor ? "break-words text-sm font-medium" : "text-sm italic text-muted-foreground"}>{valor || "—"}</dd>
    </div>
  );
}

/** Datos de un puesto (código, cargo y unidad), de solo lectura. */
export function FichaPuesto({ puesto }: { puesto: Puesto }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-lg font-bold" data-testid="puesto-codigo">
        {puesto.codigo}
      </p>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Dato etiqueta="Cargo" valor={puesto.cargo.nombre} />
        <Dato etiqueta="Cargo específico" valor={puesto.cargoEspecifico.nombre} />
        <Dato etiqueta="Dirección general" valor={puesto.direccionGeneral.nombre} />
        <Dato etiqueta="Dirección de línea" valor={puesto.direccionLinea.nombre} />
        <Dato etiqueta="Coordinación" valor={puesto.coordinacion.nombre} />
        <Dato etiqueta="Dependencia" valor={puesto.dependencia.nombre} />
        <Dato etiqueta="Nómina" valor={puesto.tipoNomina.nombre} />
      </dl>
    </div>
  );
}
