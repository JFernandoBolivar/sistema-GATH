import type { CatalogoVariables } from "../entities/plantilla";

export const CATALOGO: CatalogoVariables = {
  procesos: [
    {
      codigo: "ingreso_ventana2",
      etiqueta: "Datos complementarios",
      descripcion: "Datos y documentos del ingreso de personal.",
      grupo: "ingreso",
      grupos_variables: ["Identificación", "Colecciones"],
    },
    {
      codigo: "ingreso_contratacion",
      etiqueta: "Contratación",
      descripcion: "Documentos que se generan al contratar al trabajador.",
      grupo: "ingreso",
      grupos_variables: ["Identificación"],
    },
    {
      codigo: "punto_cuenta:cambio_oficina",
      etiqueta: "Punto de Cuenta: cambio de oficina",
      descripcion: "Punto de cuenta que se emite al cambiar de oficina.",
      grupo: "punto_cuenta",
      grupos_variables: ["Identificación"],
    },
    {
      codigo: "punto_cuenta:cambio_nivel",
      etiqueta: "Punto de Cuenta: cambio de nivel",
      descripcion: "Punto de cuenta que se emite al cambiar de nivel.",
      grupo: "punto_cuenta",
      grupos_variables: ["Identificación"],
    },
    {
      codigo: "bajo_demanda",
      etiqueta: "Bajo demanda",
      descripcion: "Documento genérico generado a solicitud de un usuario autorizado.",
      grupo: "bajo_demanda",
      grupos_variables: ["Identificación", "Colecciones"],
    },
  ],
  variables: [
    { clave: "nombres", etiqueta: "Nombres", descripcion: "Nombres del trabajador", grupo: "Identificación", tipo: "texto", ejemplo: "JUAN" },
    { clave: "sexo", etiqueta: "Sexo", descripcion: "MASCULINO o FEMENINO", grupo: "Identificación", tipo: "texto", ejemplo: "MASCULINO" },
    { clave: "fecha_nacimiento", etiqueta: "Fecha de nacimiento", descripcion: "", grupo: "Identificación", tipo: "fecha", ejemplo: "01/01/1990" },
    { clave: "foto", etiqueta: "Foto", descripcion: "", grupo: "Identificación", tipo: "imagen", ejemplo: "" },
    {
      clave: "familiares",
      etiqueta: "Familiares",
      descripcion: "Carga familiar",
      grupo: "Colecciones",
      tipo: "coleccion",
      ejemplo: [],
      columnas: [
        { clave: "nombre_completo", etiqueta: "Nombre", ejemplo: "A" },
        { clave: "parentesco", etiqueta: "Parentesco", ejemplo: "HIJO" },
      ],
    },
  ],
  tipos_bloque: [],
  tipos_campo_overlay: [],
  tipos_campo_propio: [],
  modos: ["formulario", "pdf_overlay"],
  firmantes: ["postulante", "conatel", "ambos"],
  limites: { max_bytes_fondo: 15728640, max_bytes_logo: 2097152 },
};
