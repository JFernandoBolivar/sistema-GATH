/**
 * Implementación del repositorio de Carnetización usando la API REST (O44 - E3).
 */
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import { carnetizacionApi } from "../http/carnetizacion-api";
import {
  carnetApiAEntidad,
  empleadoApiADatosCarnet,
  estadisticasCarnetApiAEntidad,
  plantillaCarnetApiAEntidad,
  plantillaMotorApiAEntidad,
  tipoCredencialApiAEntidad,
  elementoBibliotecaApiAEntidad,
  campoCredencialApiAEntidad,
  fichaQrApiAEntidad,
  paginaApiAEntidad,
} from "../mappers/mapper-carnetizacion";

export const repoCarnetizacionApi: RepoCarnetizacion = {
  async listarCarnets(cedula) {
    const raw = await carnetizacionApi.getCarnets(cedula);
    return raw.map(carnetApiAEntidad);
  },

  async emitirCarnet(empleadoCedula, motivoId, observaciones, plantillaId) {
    const raw = await carnetizacionApi.emitir(empleadoCedula, motivoId, observaciones, plantillaId);
    return carnetApiAEntidad(raw);
  },

  async validarPorHash(securityHash) {
    const res = await carnetizacionApi.validarPorHash(securityHash);
    return {
      esValido: res.es_valido,
      mensaje: res.mensaje,
      carnet: res.carnet ? carnetApiAEntidad(res.carnet) : null,
    };
  },

  async validarPorId(carnetId) {
    const res = await carnetizacionApi.validarPorId(carnetId);
    return {
      esValido: res.es_valido,
      mensaje: res.mensaje,
      carnet: res.carnet ? carnetApiAEntidad(res.carnet) : null,
    };
  },

  async listarPlantillas() {
    const raw = await carnetizacionApi.getPlantillas();
    return raw.map(plantillaCarnetApiAEntidad);
  },

  async crearPlantilla(nombre, imagen, activar) {
    const raw = await carnetizacionApi.crearPlantilla(nombre, imagen, activar);
    return plantillaCarnetApiAEntidad(raw);
  },

  async activarPlantilla(plantillaId) {
    const raw = await carnetizacionApi.activarPlantilla(plantillaId);
    return plantillaCarnetApiAEntidad(raw);
  },

  async descargarPdf(carnetId) {
    return carnetizacionApi.descargarPdf(carnetId);
  },

  async revocarCarnet(carnetId) {
    return carnetApiAEntidad(await carnetizacionApi.revocar(carnetId));
  },

  async obtenerEstadisticas() {
    return estadisticasCarnetApiAEntidad(await carnetizacionApi.getEstadisticas());
  },

  async obtenerDatosEmpleado(cedula) {
    const raw = await carnetizacionApi.getEmpleado(cedula);
    return raw ? empleadoApiADatosCarnet(raw) : null;
  },

  // --- Motor de Plantillas y Catálogo (O44 - E3) ---
  async listarTiposCredencial(grupo) {
    const raw = await carnetizacionApi.getTiposCredencial(grupo);
    return raw.map(tipoCredencialApiAEntidad);
  },

  async obtenerSugerenciasReglasColor() {
    return carnetizacionApi.getSugerenciasReglasColor();
  },

  async listarPlantillasMotor(tipo, estado, activas) {
    const raw = await carnetizacionApi.getPlantillasMotor(tipo, estado, activas);
    return raw.map(plantillaMotorApiAEntidad);
  },

  async listarPlantillasMotorPagina(tipo, params) {
    const raw = await carnetizacionApi.getPlantillasMotorPagina(tipo, params);
    return paginaApiAEntidad(raw, plantillaMotorApiAEntidad);
  },

  async listarFondosFijos(params) {
    const raw = await carnetizacionApi.getFondosFijos(params);
    return paginaApiAEntidad(raw, plantillaCarnetApiAEntidad);
  },

  async eliminarFondoFijo(id) {
    await carnetizacionApi.eliminarFondoFijo(id);
  },

  async obtenerPlantillaMotor(id) {
    const raw = await carnetizacionApi.getPlantillaMotor(id);
    return plantillaMotorApiAEntidad(raw);
  },

  async crearPlantillaBorrador(input) {
    const raw = await carnetizacionApi.crearPlantillaBorrador(input as unknown as Record<string, unknown>);
    return plantillaMotorApiAEntidad(raw);
  },

  async actualizarPlantillaBorrador(id, input) {
    const raw = await carnetizacionApi.actualizarPlantillaBorrador(id, input as unknown as Record<string, unknown>);
    return plantillaMotorApiAEntidad(raw);
  },

  async eliminarPlantillaMotor(id) {
    await carnetizacionApi.eliminarPlantillaMotor(id);
  },

  async publicarPlantilla(id, activar = true) {
    const raw = await carnetizacionApi.publicarPlantillaMotor(id, activar);
    return plantillaMotorApiAEntidad(raw);
  },

  async activarPlantillaMotor(id) {
    const raw = await carnetizacionApi.activarPlantillaMotor(id);
    return plantillaMotorApiAEntidad(raw);
  },

  async listarVersionesPlantilla(raizId) {
    const raw = await carnetizacionApi.getVersionesPlantilla(raizId);
    return raw.map(plantillaMotorApiAEntidad);
  },

  async obtenerPlantillaActiva(tipo = "trabajador", criterio = "todos", valor = "*") {
    const raw = await carnetizacionApi.getPlantillaActiva(tipo, criterio, valor);
    return plantillaMotorApiAEntidad(raw);
  },

  // --- Biblioteca de Medios (O44 - E4) ---
  async listarBiblioteca(categoria) {
    const raw = await carnetizacionApi.getBiblioteca(categoria);
    return raw.map(elementoBibliotecaApiAEntidad);
  },

  async listarBibliotecaPagina(categoria, params) {
    const raw = await carnetizacionApi.getBibliotecaPagina(categoria, params);
    return paginaApiAEntidad(raw, elementoBibliotecaApiAEntidad);
  },

  async subirElementoBiblioteca(nombre, categoria, archivo, descripcion) {
    const formData = new FormData();
    formData.append("nombre", nombre);
    formData.append("categoria", categoria);
    formData.append("archivo", archivo);
    if (descripcion) {
      formData.append("descripcion", descripcion);
    }
    const raw = await carnetizacionApi.subirElementoBiblioteca(formData);
    return elementoBibliotecaApiAEntidad(raw);
  },

  async eliminarElementoBiblioteca(id) {
    return carnetizacionApi.eliminarElementoBiblioteca(id);
  },

  // --- Registro de Campos Autorizados y Personalizados (O44 - E5) ---
  async listarCampos(tipo = "trabajador") {
    const raw = await carnetizacionApi.getCampos(tipo);
    return raw.map(campoCredencialApiAEntidad);
  },

  async crearCampoPersonalizado(campo) {
    const raw = await carnetizacionApi.crearCampoPersonalizado(campo as unknown as Record<string, unknown>);
    return campoCredencialApiAEntidad(raw);
  },

  async actualizarCampoPersonalizado(codigo, campo) {
    const raw = await carnetizacionApi.actualizarCampoPersonalizado(codigo, campo as unknown as Record<string, unknown>);
    return campoCredencialApiAEntidad(raw);
  },

  async eliminarCampoPersonalizado(codigo) {
    return carnetizacionApi.eliminarCampoPersonalizado(codigo);
  },

  // --- QR y Privacidad por Dato (O44 - E9) ---
  async consultarFichaQr(securityHash) {
    const raw = await carnetizacionApi.consultarFichaQr(securityHash);
    return fichaQrApiAEntidad(raw);
  },

  async consultarSaludEmergencia(securityHash) {
    const raw = await carnetizacionApi.consultarSaludEmergencia(securityHash);
    return fichaQrApiAEntidad(raw);
  },

  async obtenerPreferenciasPrivacidad() {
    return carnetizacionApi.getPreferenciasPrivacidad();
  },

  async guardarPreferenciasPrivacidad(preferencias) {
    return carnetizacionApi.guardarPreferenciasPrivacidad(preferencias);
  },
};
