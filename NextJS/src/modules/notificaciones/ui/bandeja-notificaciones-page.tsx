"use client";

import { useState, useTransition } from "react";
import useSWR, { useSWRConfig } from "swr";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/components/page-header";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import {
  listarNotificacionesAction,
  marcarLeidaAction,
  marcarTodasLeidasAction,
} from "../infrastructure/actions/notificaciones-actions";
import { NotificacionItem } from "./notificacion-item";
import { claveBandeja, desenvolver, esClaveDeNotificaciones } from "./notificaciones-swr";

const TAMANO_PAGINA = 20;

/** Bandeja completa de notificaciones del usuario: lista, marcar como leída y «ver más». */
interface Props {
  /** `true` dentro de un panel: sin encabezado de página (el panel pone su propio título). */
  enPanel?: boolean;
  /** Se llama al seguir el enlace de una notificación (p. ej. para cerrar el panel). */
  onNavegar?: () => void;
  puedeAbrirEnlace?: (enlace: string) => boolean;
}

export default function BandejaNotificacionesPage({
  enPanel = false,
  onNavegar,
  puedeAbrirEnlace,
}: Props = {}) {
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [limite, setLimite] = useState(TAMANO_PAGINA);
  const [pendiente, startTransition] = useTransition();
  const { mutate } = useSWRConfig();

  const { data, error, isLoading } = useSWR(
    claveBandeja(soloNoLeidas, limite),
    async () => desenvolver(await listarNotificacionesAction({ soloNoLeidas, limite })),
    { shouldRetryOnError: false },
  );

  const refrescar = () => mutate(esClaveDeNotificaciones);

  const marcarLeida = (id: string) =>
    startTransition(async () => {
      await marcarLeidaAction(id);
      await refrescar();
    });

  const marcarTodas = () =>
    startTransition(async () => {
      await marcarTodasLeidasAction();
      await refrescar();
    });

  const hayNoLeidas = data?.resultados.some((n) => !n.leida) ?? false;

  return (
    <div className="flex flex-col gap-6">
      {enPanel ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start"
          disabled={pendiente || !hayNoLeidas}
          onClick={marcarTodas}
        >
          <CheckCheck aria-hidden /> Marcar todas como leídas
        </Button>
      ) : (
        <PageHeader
          titulo="Notificaciones"
          descripcion="Aquí encuentra los avisos sobre sus trámites y solicitudes."
          accion={
            <Button
              type="button"
              size="lg"
              disabled={pendiente || !hayNoLeidas}
              onClick={marcarTodas}
            >
              <CheckCheck aria-hidden /> Marcar todas como leídas
            </Button>
          }
        />
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro de notificaciones">
        <Button
          type="button"
          variant={soloNoLeidas ? "outline" : "default"}
          aria-pressed={!soloNoLeidas}
          className="min-h-11"
          onClick={() => {
            setSoloNoLeidas(false);
            setLimite(TAMANO_PAGINA);
          }}
        >
          Todas
        </Button>
        <Button
          type="button"
          variant={soloNoLeidas ? "default" : "outline"}
          aria-pressed={soloNoLeidas}
          className="min-h-11"
          onClick={() => {
            setSoloNoLeidas(true);
            setLimite(TAMANO_PAGINA);
          }}
        >
          Solo no leídas
        </Button>
      </div>

      {isLoading ? (
        <VistaCargando mensaje="Cargando sus notificaciones…" />
      ) : error ? (
        <VistaError
          mensaje="No se pudieron cargar sus notificaciones."
          onReintentar={() => void refrescar()}
        />
      ) : !data?.resultados.length ? (
        <VistaVacia
          titulo={soloNoLeidas ? "No tiene notificaciones sin leer" : "No tiene notificaciones"}
          descripcion="Cuando haya novedades sobre sus solicitudes, las verá aquí."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3" aria-label="Lista de notificaciones">
            {data.resultados.map((n) => (
              <NotificacionItem
                key={n.id}
                notificacion={n}
                deshabilitado={pendiente}
                onMarcarLeida={marcarLeida}
                onNavegar={onNavegar}
                puedeAbrirEnlace={puedeAbrirEnlace}
              />
            ))}
          </ul>
          {data.total > data.resultados.length ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="self-center"
              onClick={() => setLimite((l) => l + TAMANO_PAGINA)}
            >
              Ver más ({data.total - data.resultados.length} restantes)
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
