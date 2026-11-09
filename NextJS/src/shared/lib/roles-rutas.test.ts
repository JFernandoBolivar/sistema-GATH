import { describe, expect, it } from "vitest";

import { filtrarMenuPorPermisos } from "./permiso-menu";
import { puedeVerRuta } from "./evaluador-iam";

/**
 * D6: regresión rol → rutas/opciones. Los conjuntos de permisos son los que
 * entrega el seed (`seed_permisos`) para cada rol, recortados a los códigos que
 * intervienen en la navegación. La decisión siempre es por permiso, nunca por
 * el nombre del rol: si mañana cambia la matriz de un rol, cambian sus accesos.
 */
type MenuItem = { label: string; permiso?: string; condicion?: "ACTIVO" | "PASIVO" };

const MENU: MenuItem[] = [
  { label: "Inicio" },
  { label: "Usuarios", permiso: "identidad.ver_usuarios" },
  { label: "Personal", permiso: "personal.ver" },
  { label: "Cargos", permiso: "cargos.ver" },
  { label: "Familiares", permiso: "familiares.ver" },
  { label: "Organización", permiso: "organizacion.ver" },
  { label: "Movimientos", permiso: "movimientos.ver" },
  { label: "Pasivos", permiso: "pasivos.ver" },
  { label: "Carnetización", permiso: "carnetizacion.ver" },
  { label: "Autogestión", permiso: "autogestion.ver_propio" },
  { label: "Fe de vida (revisión)", permiso: "fe_de_vida.revisar" },
  { label: "Fe de vida", permiso: "fe_de_vida.solicitar", condicion: "PASIVO" },
  { label: "Bienestar Social", permiso: "bienestar.ver_solicitudes" },
  { label: "Reportes", permiso: "reportes.ver" },
  { label: "Catálogos", permiso: "catalogos.ver" },
  { label: "Auditoría", permiso: "auditoria.ver_logs" },
  { label: "Configuración", permiso: "configuracion.editar" },
  { label: "Notificaciones", permiso: "notificaciones.ver_propias" },
];

const PERMISOS_NAVEGACION = MENU.flatMap((item) => (item.permiso ? [item.permiso] : []));

const ROLES = {
  ADMINISTRADOR: [
    ...PERMISOS_NAVEGACION,
    "identidad.crear_usuarios", "identidad.editar_usuarios", "identidad.crear_roles",
    "personal.crear", "familiares.crear", "cargos.crear",
  ],
  ANALISTA: [
    "personal.ver", "personal.crear", "familiares.ver", "familiares.crear",
    "organizacion.ver", "cargos.ver", "cargos.crear",
    "movimientos.ver", "pasivos.ver", "carnetizacion.ver", "reportes.ver",
    "catalogos.ver", "identidad.ver_usuarios", "identidad.ver_roles",
    "autogestion.ver_propio", "autogestion.censo_ver_todos",
    "notificaciones.ver_propias",
  ],
  RECEPCIONISTA: [
    "personal.ver", "familiares.ver", "pasivos.ver",
    "autogestion.ver_propio", "notificaciones.ver_propias",
  ],
  "BIENESTAR SOCIAL": [
    "personal.ver", "familiares.ver", "pasivos.ver", "reportes.ver",
    "autogestion.ver_propio", "autogestion.censo_ver_todos",
    "notificaciones.ver_propias",
  ],
  ADMIN_BIENESTAR: [
    "personal.ver", "familiares.ver", "pasivos.ver", "reportes.ver",
    "autogestion.ver_propio", "autogestion.censo_ver_todos",
    "bienestar.ver_solicitudes", "fe_de_vida.ver_panel", "fe_de_vida.revisar",
    "fe_de_vida.ver_cobertura", "notificaciones.ver_propias",
  ],
  ANALISTA_BIENESTAR: [
    "personal.ver", "familiares.ver", "pasivos.ver", "reportes.ver",
    "autogestion.ver_propio", "autogestion.censo_ver_todos",
    "bienestar.ver_solicitudes", "fe_de_vida.ver_panel", "fe_de_vida.revisar",
    "fe_de_vida.ver_cobertura", "notificaciones.ver_propias",
  ],
  AUTOGESTION: [
    "catalogos.ver", "autogestion.ver_propio", "autogestion.censo_ver_propio",
    "fe_de_vida.solicitar", "notificaciones.ver_propias",
  ],
  JEFE_RRHH: [
    "personal.ver", "movimientos.ver", "pasivos.ver", "reportes.ver",
    "identidad.ver_usuarios", "identidad.ver_roles", "autogestion.ver_propio",
    "fe_de_vida.ver_cobertura", "notificaciones.ver_propias",
  ],
  AUDITOR: [
    "identidad.ver_usuarios", "identidad.ver_roles",
    "auditoria.ver_logs", "notificaciones.ver_propias",
  ],
} as const;

function visibles(permisos: readonly string[], condicion = "ACTIVO") {
  return filtrarMenuPorPermisos([...MENU], [...permisos], condicion).map((i) => i.label);
}

describe("D6 — rutas y menú por permisos (roles del seed)", () => {
  it("ADMINISTRADOR ve todos los módulos y rutas", () => {
    expect(visibles(ROLES.ADMINISTRADOR, "PASIVO")).toEqual(MENU.map((m) => m.label));
    for (const ruta of [
      "/usuarios", "/personal", "/cargos", "/familiares", "/organizacion",
      "/movimientos", "/pasivos", "/carnetizacion", "/autogestion",
      "/reportes", "/catalogos", "/auditoria", "/configuracion",
      "/retroalimentacion", "/usuarios/registrar", "/usuarios/roles/registrar",
      "/personal/registrar", "/personal/fe-de-vida", "/personal/bienestar",
      "/autogestion/fe-de-vida",
    ]) {
      expect(puedeVerRuta([...ROLES.ADMINISTRADOR], ruta, "PASIVO"), ruta).toBe(true);
    }
  });

  it("ANALISTA ve la operación de RRHH y no auditoría/configuración", () => {
    expect(visibles(ROLES.ANALISTA)).toEqual([
      "Inicio", "Usuarios", "Personal", "Cargos", "Familiares", "Organización",
      "Movimientos", "Pasivos", "Carnetización", "Autogestión", "Reportes",
      "Catálogos", "Notificaciones",
    ]);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/personal")).toBe(true);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/usuarios")).toBe(true);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/auditoria")).toBe(false);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/configuracion")).toBe(false);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/personal/fe-de-vida")).toBe(false);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/autogestion/fe-de-vida")).toBe(false);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/usuarios/roles")).toBe(true);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/usuarios/registrar")).toBe(false);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/usuarios/modificar")).toBe(false);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/usuarios/roles/registrar")).toBe(false);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/personal/registrar")).toBe(true);
    expect(puedeVerRuta([...ROLES.ANALISTA], "/retroalimentacion")).toBe(false);
  });

  it("RECEPCIONISTA solo consulta personal, pasivos, familiares y autogestión", () => {
    expect(visibles(ROLES.RECEPCIONISTA)).toEqual([
      "Inicio", "Personal", "Familiares", "Pasivos", "Autogestión", "Notificaciones",
    ]);
    expect(puedeVerRuta([...ROLES.RECEPCIONISTA], "/personal")).toBe(true);
    expect(puedeVerRuta([...ROLES.RECEPCIONISTA], "/usuarios")).toBe(false);
    expect(puedeVerRuta([...ROLES.RECEPCIONISTA], "/reportes")).toBe(false);
    expect(puedeVerRuta([...ROLES.RECEPCIONISTA], "/auditoria")).toBe(false);
    expect(puedeVerRuta([...ROLES.RECEPCIONISTA], "/personal/registrar")).toBe(false);
    expect(puedeVerRuta([...ROLES.RECEPCIONISTA], "/retroalimentacion")).toBe(false);
  });

  it("BIENESTAR SOCIAL no ve administración, cargos, movimientos ni Fe de vida", () => {
    expect(visibles(ROLES["BIENESTAR SOCIAL"])).toEqual([
      "Inicio", "Personal", "Familiares", "Pasivos", "Autogestión", "Reportes",
      "Notificaciones",
    ]);
    expect(puedeVerRuta([...ROLES["BIENESTAR SOCIAL"]], "/usuarios")).toBe(false);
    expect(puedeVerRuta([...ROLES["BIENESTAR SOCIAL"]], "/movimientos")).toBe(false);
    expect(puedeVerRuta([...ROLES["BIENESTAR SOCIAL"]], "/personal/fe-de-vida")).toBe(false);
    expect(puedeVerRuta([...ROLES["BIENESTAR SOCIAL"]], "/personal/bienestar")).toBe(false);
  });

  it("ADMIN_BIENESTAR y ANALISTA_BIENESTAR ven el panel de Fe de vida y no administración", () => {
    for (const rol of ["ADMIN_BIENESTAR", "ANALISTA_BIENESTAR"] as const) {
      const labels = visibles(ROLES[rol]);
      expect(labels).toEqual([
        "Inicio", "Personal", "Familiares", "Pasivos", "Autogestión",
        "Fe de vida (revisión)", "Bienestar Social", "Reportes", "Notificaciones",
      ]);
      expect(labels).not.toContain("Usuarios");
      expect(puedeVerRuta([...ROLES[rol]], "/personal/fe-de-vida")).toBe(true);
      expect(puedeVerRuta([...ROLES[rol]], "/personal/bienestar")).toBe(true);
      expect(puedeVerRuta([...ROLES[rol]], "/autogestion/fe-de-vida")).toBe(false);
      expect(puedeVerRuta([...ROLES[rol]], "/usuarios")).toBe(false);
      expect(puedeVerRuta([...ROLES[rol]], "/configuracion")).toBe(false);
    }
  });

  it("AUTOGESTION solo entra a su portal; Fe de vida propia exige PASIVO", () => {
    expect(visibles(ROLES.AUTOGESTION, "ACTIVO")).toEqual([
      "Inicio", "Autogestión", "Catálogos", "Notificaciones",
    ]);
    expect(visibles(ROLES.AUTOGESTION, "PASIVO")).toContain("Fe de vida");
    expect(puedeVerRuta([...ROLES.AUTOGESTION], "/autogestion", "ACTIVO")).toBe(true);
    expect(puedeVerRuta([...ROLES.AUTOGESTION], "/autogestion/fe-de-vida", "ACTIVO")).toBe(false);
    expect(puedeVerRuta([...ROLES.AUTOGESTION], "/autogestion/fe-de-vida", "PASIVO")).toBe(true);
    expect(puedeVerRuta([...ROLES.AUTOGESTION], "/personal/fe-de-vida", "PASIVO")).toBe(false);
    expect(puedeVerRuta([...ROLES.AUTOGESTION], "/usuarios", "PASIVO")).toBe(false);
    expect(puedeVerRuta([...ROLES.AUTOGESTION], "/personal", "PASIVO")).toBe(false);
  });

  it("JEFE_RRHH ve movimiento/reportes y cobertura, sin administración", () => {
    expect(visibles(ROLES.JEFE_RRHH)).toEqual([
      "Inicio", "Usuarios", "Personal", "Movimientos", "Pasivos", "Autogestión",
      "Reportes", "Notificaciones",
    ]);
    expect(puedeVerRuta([...ROLES.JEFE_RRHH], "/reportes")).toBe(true);
    expect(puedeVerRuta([...ROLES.JEFE_RRHH], "/personal/fe-de-vida")).toBe(true);
    expect(puedeVerRuta([...ROLES.JEFE_RRHH], "/configuracion")).toBe(false);
    expect(puedeVerRuta([...ROLES.JEFE_RRHH], "/auditoria")).toBe(false);
  });

  it("AUDITOR solo lectura de usuarios/roles y bitácora", () => {
    expect(visibles(ROLES.AUDITOR)).toEqual([
      "Inicio", "Usuarios", "Auditoría", "Notificaciones",
    ]);
    expect(puedeVerRuta([...ROLES.AUDITOR], "/auditoria")).toBe(true);
    expect(puedeVerRuta([...ROLES.AUDITOR], "/usuarios/roles")).toBe(true);
    expect(puedeVerRuta([...ROLES.AUDITOR], "/usuarios/registrar")).toBe(false);
    expect(puedeVerRuta([...ROLES.AUDITOR], "/personal")).toBe(false);
    expect(puedeVerRuta([...ROLES.AUDITOR], "/configuracion")).toBe(false);
    expect(puedeVerRuta([...ROLES.AUDITOR], "/autogestion")).toBe(false);
  });
});
