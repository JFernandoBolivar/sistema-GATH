/**
 * Adaptador de repositorio de usuarios (Regla R4). Implementa el puerto
 * `RepoUsuarios` combinando HTTP + mapper.
 */
import type {
  RepoUsuarios,
  UsuarioRegistrarInput,
  UsuarioEditarInput,
  GuardarOverridesInput,
  UsuarioDetalleEntity,
  MatrizPermisosEntity,
  PaginaUsuariosEntity,
} from "../../domain/ports/repo-usuarios";
import { usuariosApi, type UsuarioDetalleApiItem, type MatrizPermisosApi } from "../http/usuarios-api";
import { mapperUsuario } from "../mappers/mapper-usuario";
import { mapperPermiso } from "../mappers/mapper-catalogo";

function mapperDetalle(raw: UsuarioDetalleApiItem): UsuarioDetalleEntity {
  return {
    usuario: mapperUsuario(raw),
    permisos: {
      rolId: raw.permisos.rol_id,
      rolNombre: raw.permisos.rol_nombre,
      rolNombreVisible: raw.permisos.rol_nombre_visible ?? raw.permisos.rol_nombre,
      delRol: raw.permisos.del_rol ?? [],
      allow: raw.permisos.allow ?? [],
      deny: raw.permisos.deny ?? [],
      efectivos: raw.permisos.efectivos ?? [],
      version: raw.permisos.version ?? 1,
    },
  };
}

function mapperMatriz(raw: MatrizPermisosApi): MatrizPermisosEntity {
  return {
    filas: raw.filas.map((f) => ({ codigo: f.codigo, nombre: f.nombre, modulo: f.modulo })),
    roles: raw.roles.map((r) => ({
      rolId: r.rol_id,
      nombre: r.nombre,
      nombreVisible: r.nombre_visible || r.nombre,
      codigos: r.codigos,
    })),
  };
}

export const repoUsuariosApi: RepoUsuarios = {
  async getAll(filtros): Promise<PaginaUsuariosEntity> {
    const pagina = await usuariosApi.getUsuarios(filtros);
    return {
      resultados: pagina.resultados.map(mapperUsuario),
      total: pagina.total,
      pagina: pagina.pagina,
      tamano: pagina.tamano,
      totalPaginas: pagina.total_paginas,
    };
  },

  async obtenerDetalle(id) {
    return mapperDetalle(await usuariosApi.obtenerDetalle(id));
  },

  async crear(input: UsuarioRegistrarInput) {
    const row = await usuariosApi.registrar({
      cedula: input.cedula,
      password: input.password,
      rol_id: input.rolId,
    });
    return mapperUsuario(row);
  },

  async editar(id: number, input: UsuarioEditarInput) {
    const row = await usuariosApi.editar(id, {
      rol_id: input.rolId,
      motivo: input.motivo,
    });
    return mapperUsuario(row);
  },

  async cambiarEstado(id: number, isActive: boolean, motivo: string) {
    const row = await usuariosApi.cambiarEstado(id, { is_active: isActive, motivo });
    return mapperUsuario(row);
  },

  async restablecerAcceso(id: number, motivo: string) {
    const row = await usuariosApi.restablecerAcceso(id, motivo);
    return mapperUsuario(row);
  },

  async cambiarCorreoAcceso(input) {
    const resultado = await usuariosApi.cambiarCorreoAcceso(input.cedula, {
      fuente: input.fuente,
      correo: input.correo,
      motivo: input.motivo,
    });
    return {
      correo: resultado.correo,
      cuentaCreada: resultado.cuenta_creada,
      avisado: resultado.avisado,
    };
  },

  async guardarOverrides(id: number, input: GuardarOverridesInput) {
    return mapperDetalle(await usuariosApi.guardarOverrides(id, input));
  },

  async matriz() {
    return mapperMatriz(await usuariosApi.matriz());
  },

  async guardarMatriz(rolId: number, permisos: string[], motivo: string) {
    return mapperMatriz(await usuariosApi.guardarMatriz(rolId, permisos, motivo));
  },

  async listarPermisos() {
    const rows = await usuariosApi.getPermisos();
    return rows.map(mapperPermiso);
  },
};
