import { describe, it, expect } from 'vitest';
import { puede, patronesCandidatos } from './evaluador-iam';

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
