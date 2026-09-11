import { describe, it, expect } from 'vitest';
import { puede, patronesCandidatos, tienePermiso } from './evaluador-iam';

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
    const permisos = ['personal.ver', 'pasivos.ver', 'familiares.ver'];
    expect(tienePermiso(permisos, 'personal.crear')).toBe(false);
    expect(tienePermiso(permisos, 'personal.editar_personales')).toBe(false);
    expect(tienePermiso(permisos, 'pasivos.cambiar_condicion')).toBe(false);
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
