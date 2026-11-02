/**
 * Motor de evaluación de políticas de autorización IAM / PBAC (estilo AWS) en Frontend.
 *
 * Reglas de Evaluación:
 * 1. Explicit Deny: Si el código coincide con algún patrón en `deny`, el resultado es `false`.
 * 2. Explicit Allow: Si el código coincide con algún patrón en `allow`, el resultado es `true`.
 * 3. Implicit Deny: Si no hay coincidencia, el resultado es `false` (fail-closed).
 */

export interface PoliticaAccesoDTO {
  allow: string[];
  deny: string[];
}

export function patronesCandidatos(codigoRequerido: string): Set<string> {
  const normalizado = codigoRequerido.trim().toLowerCase();
  const candidatos = new Set<string>(['*', normalizado]);
  if (normalizado.includes('.')) {
    const modulo = normalizado.split('.')[0];
    candidatos.add(`${modulo}.*`);
  }
  return candidatos;
}

export function puede(
  politica: PoliticaAccesoDTO | null | undefined,
  codigoRequerido: string
): boolean {
  if (!politica || !codigoRequerido || !codigoRequerido.trim()) {
    return false;
  }

  const candidatos = patronesCandidatos(codigoRequerido);
  const allowSet = new Set((politica.allow || []).map((x) => x.trim().toLowerCase()));
  const denySet = new Set((politica.deny || []).map((x) => x.trim().toLowerCase()));

  // 1. Regla AWS: Deny explícito tiene prioridad máxima
  for (const patron of candidatos) {
    if (denySet.has(patron)) {
      return false;
    }
  }

  // 2. Concesión explícita
  for (const patron of candidatos) {
    if (allowSet.has(patron)) {
      return true;
    }
  }

  // 3. Denegación implícita
  return false;
}

/**
 * Evalúa un código de permiso contra la lista PLANA de códigos efectivos ya
 * resueltos que expone la sesión (`session.user.permisos: string[]`, tal
 * como la sirve `/api/v1/identidad/auth/me/`: el backend ya resolvió
 * allow/deny en `resolver_permisos` y solo entrega los códigos concedidos).
 * A diferencia de `puede()` (que evalúa una `PoliticaAccesoDTO` sin
 * resolver), esta función es la que deben usar los componentes `ui/` de los
 * módulos: mismos patrones de coincidencia (exacto, `modulo.*`, `*`),
 * fail-closed igual que `puede()`.
 */
export function tienePermiso(
  permisos: string[] | null | undefined,
  codigoRequerido: string
): boolean {
  if (!permisos || !codigoRequerido || !codigoRequerido.trim()) {
    return false;
  }

  const candidatos = patronesCandidatos(codigoRequerido);
  const concedidos = new Set(permisos.map((x) => x.trim().toLowerCase()));

  for (const patron of candidatos) {
    if (concedidos.has(patron)) {
      return true;
    }
  }

  return false;
}

/**
 * Condición del trabajador (dato derivado en servidor, `/auth/me/` →
 * `condicion_trabajador`): ser activo o pasivo NO es un rol ni un permiso. Un único rol
 * AUTOGESTION sirve a ambos; la condición decide qué entradas se muestran.
 */
export type CondicionTrabajador = "ACTIVO" | "PASIVO";

/**
 * ¿Cumple la sesión la condición exigida por una entrada? Sin condición exigida: sí.
 * Con condición exigida y condición desconocida/SIN_ASIGNACION: no (fail-closed).
 */
export function cumpleCondicion(
  requerida: CondicionTrabajador | undefined,
  condicionTrabajador: string | null | undefined,
): boolean {
  if (!requerida) return true;
  return (condicionTrabajador ?? "").trim().toUpperCase() === requerida;
}

/** Fe de vida del pasivo: permiso `fe_de_vida.solicitar` Y condición PASIVO. */
export function puedeVerFeDeVidaPropia(
  permisos: string[] | null | undefined,
  condicionTrabajador: string | null | undefined,
): boolean {
  return (
    tienePermiso(permisos, "fe_de_vida.solicitar") && cumpleCondicion("PASIVO", condicionTrabajador)
  );
}

/** Entradas exclusivas de activos (censo propio, solicitud de carnet): permiso Y condición ACTIVO. */
export function puedeVerEntradaDeActivo(
  permisos: string[] | null | undefined,
  codigoPermiso: string,
  condicionTrabajador: string | null | undefined,
): boolean {
  return tienePermiso(permisos, codigoPermiso) && cumpleCondicion("ACTIVO", condicionTrabajador);
}

/**
 * Acceso por ruta (Etapa A8, insumo de la etapa D): cada módulo de primer nivel
 * declara los permisos "de entrada" (basta uno) y el primer segmento de la URL
 * se mapea al módulo. Una ruta fuera del mapa (inicio, dashboard, login…) no
 * exige permiso: queda abierta a cualquier sesión autenticada. La decisión
 * final de seguridad sigue en el backend (`HasPermission`); esto solo evita
 * mostrar navegación o rutas que el backend rechazaría.
 */
export const RUTA_A_MODULO: Record<string, string> = {
  personal: 'personal',
  pasivos: 'pasivos',
  cargos: 'cargos',
  carnetizacion: 'carnetizacion',
  catalogos: 'catalogos',
  configuracion: 'configuracion',
  familiares: 'familiares',
  movimientos: 'movimientos',
  organizacion: 'organizacion',
  reportes: 'reportes',
  usuarios: 'identidad',
  autogestion: 'autogestion',
  notificaciones: 'notificaciones',
  bienestar: 'bienestar',
  'fe-de-vida': 'fe_de_vida',
  auditoria: 'auditoria',
  retroalimentacion: 'bienestar',
};

/**
 * Reglas por prefijo para subrutas cuyo permiso NO es el del módulo padre
 * (`/personal/fe-de-vida` no se abre con `personal.ver`, sino con los permisos
 * de revisión/cobertura de fe de vida). Se evalúan antes que el módulo.
 */
export interface ReglaRuta {
  prefijo: string;
  /** Basta uno de los códigos. */
  permisos: string[];
  /** Condición del trabajador exigida además del permiso (opcional). */
  condicion?: CondicionTrabajador;
}

export const REGLAS_RUTA: ReglaRuta[] = [
  { prefijo: 'personal/censo', permisos: ['autogestion.censo_ver_todos'] },
  { prefijo: 'pasivos/consultar', permisos: ['pasivos.ver'] },
  { prefijo: 'pasivos/reportes', permisos: ['reportes.ver'] },
  { prefijo: 'pasivos/registrar', permisos: ['pasivos.crear'] },
  { prefijo: 'pasivos/familiares/registrar', permisos: ['familiares.crear'] },
  { prefijo: 'pasivos/familiares/consultar', permisos: ['familiares.ver'] },
  { prefijo: 'pasivos/egreso-pasivo', permisos: ['pasivos.cambiar_condicion'] },
  {
    prefijo: 'pasivos/fe-de-vida',
    permisos: [
      'fe_de_vida.revisar',
      'fe_de_vida.gestionar_procesos',
      'fe_de_vida.ver_cobertura',
      'fe_de_vida.ver_panel',
    ],
  },
  // Rutas de acción: el módulo basta para consultar, pero crear/editar exige
  // su código propio (la opción del menú ya se oculta sin él).
  { prefijo: 'usuarios/roles/registrar', permisos: ['identidad.crear_roles'] },
  { prefijo: 'usuarios/roles', permisos: ['identidad.ver_roles'] },
  { prefijo: 'usuarios/registrar', permisos: ['identidad.crear_usuarios'] },
  { prefijo: 'usuarios/modificar', permisos: ['identidad.editar_usuarios'] },
  { prefijo: 'usuarios/matriz', permisos: ['identidad.ver_roles'] },
  { prefijo: 'personal/registrar', permisos: ['personal.crear'] },
  { prefijo: 'familiares/registrar', permisos: ['familiares.crear'] },
  { prefijo: 'cargos/crear-codigo', permisos: ['cargos.crear'] },
  {
    prefijo: 'autogestion/consultar',
    permisos: ['autogestion.censo_ver_todos'],
  },
  {
    prefijo: 'autogestion/metricas',
    permisos: ['autogestion.censo_ver_todos'],
  },
  {
    prefijo: 'personal/fe-de-vida',
    permisos: [
      'fe_de_vida.revisar',
      'fe_de_vida.gestionar_procesos',
      'fe_de_vida.ver_cobertura',
      'fe_de_vida.ver_panel',
    ],
  },
  {
    prefijo: 'personal/bienestar',
    permisos: ['bienestar.ver_solicitudes'],
  },
  {
    prefijo: 'autogestion/fe-de-vida',
    permisos: ['fe_de_vida.solicitar'],
    condicion: 'PASIVO',
  },
];

export const PERMISOS_DE_ENTRADA: Record<string, string[]> = {
  personal: ['personal.ver'],
  pasivos: ['pasivos.ver'],
  cargos: ['cargos.ver'],
  carnetizacion: ['carnetizacion.ver'],
  catalogos: ['catalogos.ver'],
  configuracion: ['configuracion.editar'],
  familiares: ['familiares.ver'],
  movimientos: ['movimientos.ver'],
  organizacion: ['organizacion.ver'],
  reportes: ['reportes.ver'],
  identidad: [
    'identidad.ver_usuarios',
    'identidad.crear_usuarios',
    'identidad.editar_usuarios',
    'identidad.ver_roles',
  ],
  autogestion: [
    'autogestion.ver_propio',
    'autogestion.censo_ver_propio',
    'autogestion.censo_ver_todos',
  ],
  notificaciones: ['notificaciones.ver_propias'],
  bienestar: ['bienestar.ver_solicitudes'],
  fe_de_vida: ['fe_de_vida.solicitar', 'fe_de_vida.ver_propia', 'fe_de_vida.ver_panel'],
  auditoria: ['auditoria.ver_logs'],
};

/** Módulo de un código de permiso (`personal.ver` → `personal`). */
export function moduloDePermiso(codigo: string): string {
  return codigo.trim().toLowerCase().split('.')[0] ?? '';
}

/** Módulos a los que la sesión tiene acceso de entrada. */
export function modulosAccesibles(permisos: string[] | null | undefined): string[] {
  return Object.keys(PERMISOS_DE_ENTRADA).filter((modulo) =>
    PERMISOS_DE_ENTRADA[modulo].some((codigo) => tienePermiso(permisos, codigo)),
  );
}

/** ¿Puede la sesión abrir esta ruta? Fail-closed en módulos mapeados; abierta si no hay módulo. */
export function puedeVerRuta(
  permisos: string[] | null | undefined,
  ruta: string,
  condicionTrabajador?: string | null,
): boolean {
  const limpia = ruta.split(/[?#]/)[0].toLowerCase();
  const segmentos = limpia.split('/').filter(Boolean);
  const segmento = segmentos[0];
  if (!segmento) return true;
  // La bandeja de notificaciones cuelga de la ruta del módulo, pero su
  // permiso es propio y lo tienen también perfiles sin acceso al módulo.
  if (segmentos[1] === 'notificaciones') {
    return tienePermiso(permisos, 'notificaciones.ver_propias');
  }
  // Subrutas con permiso propio (fe de vida de personal, bandeja de Bienestar,
  // fe de vida del pasivo). La más específica se evalúa antes del módulo.
  const rutaCompleta = segmentos.join('/');
  const regla = REGLAS_RUTA.find(
    (r) => rutaCompleta === r.prefijo || rutaCompleta.startsWith(`${r.prefijo}/`),
  );
  if (regla) {
    return (
      cumpleCondicion(regla.condicion, condicionTrabajador) &&
      regla.permisos.some((codigo) => tienePermiso(permisos, codigo))
    );
  }
  const modulo = RUTA_A_MODULO[segmento];
  if (!modulo) return true;
  // Fe de vida propia: el permiso de solicitud solo aplica a PASIVO; el
  // personal de Bienestar entra por sus permisos de panel/revisión.
  if (modulo === 'fe_de_vida') {
    const personalBienestar =
      tienePermiso(permisos, 'fe_de_vida.ver_panel') ||
      tienePermiso(permisos, 'fe_de_vida.revisar');
    if (personalBienestar) return true;
    return (
      tienePermiso(permisos, 'fe_de_vida.solicitar') &&
      cumpleCondicion('PASIVO', condicionTrabajador)
    );
  }
  return (PERMISOS_DE_ENTRADA[modulo] ?? []).some((codigo) => tienePermiso(permisos, codigo));
}
