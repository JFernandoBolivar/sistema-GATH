import { describe, it, expect } from 'vitest';
import {
  puede,
  patronesCandidatos,
  tienePermiso,
  puedeVerRuta,
  modulosAccesibles,
  moduloDePermiso,
  cumpleCondicion,
  puedeVerFeDeVidaPropia,
  puedeVerEntradaDeActivo,
} from './evaluador-iam';

describe('Evaluador IAM PBAC Frontend', () => {
  it('genera correctamente los patrones candidatos', () => {
    const candidatos = patronesCandidatos('personal.crear');
    expect(candidatos.has('*')).toBe(true);
    expect(candidatos.has('personal.*')).toBe(true);
    expect(candidatos.has('personal.crear')).toBe(true);
    expect(candidatos.has('cargos.*')).toBe(false);
  });

  it('autoriza por coincidencia exacta en allow', () => {
    const politica = { allow: ['personal.ver', 'personal.crear'], deny: [] };
    expect(puede(politica, 'personal.ver')).toBe(true);
    expect(puede(politica, 'personal.crear')).toBe(true);
    expect(puede(politica, 'personal.editar')).toBe(false);
  });

  it('autoriza mediante wildcard por módulo', () => {
    const politica = { allow: ['personal.*'], deny: [] };
    expect(puede(politica, 'personal.ver')).toBe(true);
    expect(puede(politica, 'personal.crear')).toBe(true);
    expect(puede(politica, 'cargos.ver')).toBe(false);
  });

  it('autoriza superadmin con wildcard global *', () => {
    const politica = { allow: ['*'], deny: [] };
    expect(puede(politica, 'personal.ver')).toBe(true);
    expect(puede(politica, 'identidad.eliminar_roles')).toBe(true);
  });

  it('aplica Deny prioritario sobre wildcard global', () => {
    const politica = { allow: ['*'], deny: ['identidad.eliminar_roles'] };
    expect(puede(politica, 'personal.ver')).toBe(true);
    expect(puede(politica, 'identidad.eliminar_roles')).toBe(false);
  });

  it('aplica Deny puntual sobre wildcard de módulo', () => {
    const politica = { allow: ['personal.*'], deny: ['personal.salud_ver'] };
    expect(puede(politica, 'personal.ver')).toBe(true);
    expect(puede(politica, 'personal.crear')).toBe(true);
    expect(puede(politica, 'personal.salud_ver')).toBe(false);
  });

  it('deniega por defecto en ausencia de política o código vacío (fail-closed)', () => {
    expect(puede(null, 'personal.ver')).toBe(false);
    expect(puede({ allow: [], deny: [] }, 'personal.ver')).toBe(false);
    expect(puede({ allow: ['*'], deny: [] }, '')).toBe(false);
  });
});

describe('tienePermiso (lista plana de codigos resuelta por el backend)', () => {
  it('autoriza por coincidencia exacta', () => {
    const permisos = ['personal.ver', 'pasivos.ver', 'familiares.ver'];
    expect(tienePermiso(permisos, 'personal.ver')).toBe(true);
    expect(tienePermiso(permisos, 'pasivos.ver')).toBe(true);
  });

  it('el perfil RECEPCIONISTA (solo *.ver) no tiene permisos de escritura', () => {
    const permisos = ['personal.ver', 'personal.ver_detalle', 'pasivos.ver', 'familiares.ver'];
    expect(tienePermiso(permisos, 'personal.crear')).toBe(false);
    expect(tienePermiso(permisos, 'personal.editar_personales')).toBe(false);
    expect(tienePermiso(permisos, 'personal.exportar_pdf')).toBe(false);
    expect(tienePermiso(permisos, 'pasivos.cambiar_condicion')).toBe(false);
    expect(tienePermiso(permisos, 'pasivos.exportar_pdf')).toBe(false);
    expect(tienePermiso(permisos, 'familiares.crear')).toBe(false);
    expect(tienePermiso(permisos, 'familiares.editar')).toBe(false);
    expect(tienePermiso(permisos, 'familiares.eliminar')).toBe(false);
  });

  it('el perfil RECEPCIONISTA sí puede ver el detalle completo (CC-APP-2026-08-001)', () => {
    const permisos = ['personal.ver', 'personal.ver_detalle', 'pasivos.ver', 'familiares.ver'];
    expect(tienePermiso(permisos, 'personal.ver_detalle')).toBe(true);
    expect(tienePermiso(permisos, 'pasivos.ver')).toBe(true);
    expect(tienePermiso(permisos, 'familiares.ver')).toBe(true);
  });

  it('autoriza mediante wildcard por modulo', () => {
    const permisos = ['personal.*'];
    expect(tienePermiso(permisos, 'personal.crear')).toBe(true);
    expect(tienePermiso(permisos, 'personal.editar_personales')).toBe(true);
    expect(tienePermiso(permisos, 'pasivos.ver')).toBe(false);
  });

  it('autoriza con wildcard global *', () => {
    expect(tienePermiso(['*'], 'pasivos.cambiar_condicion')).toBe(true);
  });

  it('deniega por defecto sin permisos o codigo vacio (fail-closed)', () => {
    expect(tienePermiso(null, 'personal.crear')).toBe(false);
    expect(tienePermiso(undefined, 'personal.crear')).toBe(false);
    expect(tienePermiso([], 'personal.crear')).toBe(false);
    expect(tienePermiso(['*'], '')).toBe(false);
  });
});

describe('Acceso por ruta (A8)', () => {
  it('rutas sin módulo mapeado quedan abiertas a toda sesión', () => {
    expect(puedeVerRuta([], '/inicio')).toBe(true);
    expect(puedeVerRuta([], '/dashboard')).toBe(true);
    expect(puedeVerRuta([], '/')).toBe(true);
  });

  it('exige el permiso de entrada del módulo (fail-closed)', () => {
    expect(puedeVerRuta(['personal.ver'], '/personal/lista')).toBe(true);
    expect(puedeVerRuta(['pasivos.ver'], '/personal')).toBe(false);
    expect(puedeVerRuta(null, '/personal')).toBe(false);
    expect(puedeVerRuta(undefined, '/reportes/exportar')).toBe(false);
  });

  it('ignora query, hash, mayúsculas y barra final', () => {
    expect(puedeVerRuta(['cargos.ver'], '/Cargos/?q=1#x')).toBe(true);
    expect(puedeVerRuta([], '/Cargos/?q=1')).toBe(false);
  });

  it('basta uno de los permisos de entrada y respeta comodines', () => {
    expect(puedeVerRuta(['identidad.crear_usuarios'], '/usuarios')).toBe(true);
    expect(puedeVerRuta(['autogestion.censo_ver_propio'], '/autogestion')).toBe(true);
    expect(puedeVerRuta(['*'], '/usuarios')).toBe(true);
    expect(puedeVerRuta(['personal.*'], '/personal')).toBe(true);
  });

  it('cubre las rutas nuevas de bienestar, fe de vida y notificaciones', () => {
    expect(puedeVerRuta(['bienestar.ver_solicitudes'], '/bienestar')).toBe(true);
    expect(puedeVerRuta(['fe_de_vida.solicitar'], '/fe-de-vida')).toBe(true);
    expect(puedeVerRuta(['fe_de_vida.solicitar'], '/bienestar')).toBe(false);
    expect(puedeVerRuta(['notificaciones.ver_propias'], '/notificaciones')).toBe(true);
  });

  it('deriva el módulo de un código y los módulos accesibles', () => {
    expect(moduloDePermiso('Fe_De_Vida.revisar')).toBe('fe_de_vida');
    expect(modulosAccesibles(['personal.ver', 'reportes.ver'])).toEqual(['personal', 'reportes']);
    expect(modulosAccesibles([])).toEqual([]);
  });
});

describe("condición del trabajador", () => {
  it("cumpleCondicion: sin exigencia pasa; con exigencia compara y falla cerrado", () => {
    expect(cumpleCondicion(undefined, null)).toBe(true);
    expect(cumpleCondicion("PASIVO", "pasivo")).toBe(true);
    expect(cumpleCondicion("PASIVO", "ACTIVO")).toBe(false);
    expect(cumpleCondicion("ACTIVO", "SIN_ASIGNACION")).toBe(false);
    expect(cumpleCondicion("ACTIVO", undefined)).toBe(false);
  });
  it("fe de vida: permiso Y condición PASIVO", () => {
    expect(puedeVerFeDeVidaPropia(["fe_de_vida.solicitar"], "PASIVO")).toBe(true);
    expect(puedeVerFeDeVidaPropia(["fe_de_vida.solicitar"], "ACTIVO")).toBe(false);
    expect(puedeVerFeDeVidaPropia([], "PASIVO")).toBe(false);
  });
  it("entradas de activos: permiso Y condición ACTIVO", () => {
    const p = ["autogestion.censo_ver_propio"];
    expect(puedeVerEntradaDeActivo(p, "autogestion.censo_ver_propio", "ACTIVO")).toBe(true);
    expect(puedeVerEntradaDeActivo(p, "autogestion.censo_ver_propio", "PASIVO")).toBe(false);
  });
});
