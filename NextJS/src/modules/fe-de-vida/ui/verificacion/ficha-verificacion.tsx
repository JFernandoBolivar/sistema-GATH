import Image from "next/image";
import Link from "next/link";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import type { ResultadoVerificacion } from "../../application/use-cases/verificar-constancia";
import type { ConstanciaVerificadaEntity } from "../../domain/entities/verificacion-constancia";
import { formatearSoloFecha } from "../comun/formato";

export const TEXTOS_VERIFICACION = {
  institucion: "Comisión Nacional de Telecomunicaciones (CONATEL)",
  titulo: "Constancia de Comparecencia o Fe de Vida",
  valida: "Constancia válida",
  invalida: "Constancia no encontrada o inválida",
  nota: "Compare estos datos con el documento impreso.",
  invalidaAyuda:
    "El código no corresponde a una constancia vigente. Si tiene el documento impreso, comuníquese con Bienestar Social de CONATEL.",
} as const;

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      <dd className="break-words text-lg font-semibold text-foreground">{valor}</dd>
    </div>
  );
}

function Sello({ valida }: { valida: boolean }) {
  return valida ? (
    <StatusBadge
      tono="success"
      icono={CircleCheck}
      texto={TEXTOS_VERIFICACION.valida}
      className="w-full justify-center px-4 py-3 text-lg"
    />
  ) : (
    <StatusBadge
      tono="danger"
      icono={CircleX}
      texto={TEXTOS_VERIFICACION.invalida}
      className="w-full justify-center px-4 py-3 text-center text-lg"
    />
  );
}

function DatosConstancia({ c }: { c: ConstanciaVerificadaEntity }) {
  return (
    <dl className="rounded-xl border border-border bg-card px-4">
      <Dato etiqueta="N.° de constancia" valor={c.numero} />
      <Dato etiqueta="Fecha de emisión" valor={formatearSoloFecha(c.emitidaEn)} />
      <Dato etiqueta="Nombre y apellido" valor={c.nombreCompleto} />
      <Dato etiqueta="Cédula de identidad" valor={c.cedula} />
    </dl>
  );
}

function Certificantes({ c }: { c: ConstanciaVerificadaEntity }) {
  if (c.certificantes.length === 0) return null;
  return (
    <section aria-labelledby="titulo-certificantes" className="flex flex-col gap-2">
      <h2 id="titulo-certificantes" className="text-base font-semibold text-foreground">
        Funcionario(s) que certifica(n)
      </h2>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre y apellido</TableHead>
              <TableHead>Cédula de identidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.certificantes.map((f) => (
              <TableRow key={`${f.cedula}-${f.nombre}`}>
                <TableCell className="whitespace-normal">{f.nombre}</TableCell>
                <TableCell>{f.cedula}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

/**
 * Ficha que se abre al escanear el QR de la constancia: encabezado institucional, sello de estado,
 * datos y nota de cotejo. Con `interna` suma los certificantes y el enlace a la solicitud. Nunca
 * ofrece la descarga del PDF.
 */
export function FichaVerificacion({ resultado }: { resultado: ResultadoVerificacion }) {
  const constancia = resultado.tipo === "valida" ? resultado.constancia : null;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 py-6 sm:py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/logoOAC.png"
          alt="Logotipo de CONATEL"
          width={96}
          height={96}
          priority
          className="h-20 w-auto dark:brightness-110"
        />
        <p className="text-base font-semibold text-foreground">{TEXTOS_VERIFICACION.institucion}</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {TEXTOS_VERIFICACION.titulo}
        </h1>
        {constancia ? (
          <p className="text-base text-muted-foreground">{constancia.procesoNombre}</p>
        ) : null}
      </header>

      {resultado.tipo === "error" ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-warning"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-base font-medium">{resultado.mensaje}</p>
        </div>
      ) : (
        <div role="status">
          <Sello valida={resultado.tipo === "valida"} />
        </div>
      )}

      {resultado.tipo === "invalida" ? (
        <p className="text-center text-base text-muted-foreground">
          {TEXTOS_VERIFICACION.invalidaAyuda}
        </p>
      ) : null}

      {constancia ? (
        <>
          <DatosConstancia c={constancia} />
          <p className="text-center text-sm text-muted-foreground">{TEXTOS_VERIFICACION.nota}</p>
          {resultado.tipo === "valida" && resultado.interna ? (
            <>
              <Certificantes c={constancia} />
              {constancia.solicitudId ? (
                <Link
                  href={`/personal/fe-de-vida/${constancia.solicitudId}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-base font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Ver solicitud
                </Link>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
