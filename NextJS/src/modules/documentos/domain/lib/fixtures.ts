import type { CatalogoVariables } from "../entities/plantilla";

export const CATALOGO: CatalogoVariables = {
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
  momentos: ["ventana2", "contratacion", "otro"],
  firmantes: ["postulante", "conatel", "ambos"],
  limites: { max_bytes_fondo: 15728640, max_bytes_logo: 2097152 },
};
